<?php

namespace App\Http\Controllers;

use App\Exports\InvoiceRecapExport;
use App\Http\Requests\InvoicePreviewRequest;
use App\Http\Requests\SendInvoiceRequest;
use App\Http\Requests\StoreInvoiceRequest;
use App\Http\Requests\UpdateInvoiceRequest;
use App\Models\Client;
use App\Models\CompanyProfile;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Payment;
use App\Models\PdfTemplate;
use App\Models\Service;
use App\Services\InvoicePrintService;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class InvoiceController extends Controller
{
    /**
     * Daftar invoice. Dipakai juga oleh show() agar /invoices/{id} merender daftar yang sama
     * dengan drawer detail langsung terbuka ($selectedInvoiceId).
     */
    public function index(Request $request, ?int $selectedInvoiceId = null): Response
    {
        $search = $request->input('search');
        $status = $request->input('status');
        $clientIds = array_filter((array) $request->input('client_ids', []), fn ($v) => $v !== '' && $v !== null);
        $month = $request->input('month', now()->format('Y-m'));
        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');
        $perPage = (int) $request->input('per_page', 25);
        $sort = $request->input('sort', 'issue_date');
        $direction = $request->input('direction', 'desc');

        $query = Invoice::query()
            ->join('clients', 'invoices.billed_to_id', '=', 'clients.id')
            ->leftJoin(
                DB::raw('(SELECT invoice_id, COALESCE(SUM(amount), 0) as amount_paid FROM payments GROUP BY invoice_id) as p'),
                'invoices.id', '=', 'p.invoice_id'
            )
            ->select([
                'invoices.*',
                'clients.name as client_name',
                'clients.type as client_type',
                DB::raw('COALESCE(p.amount_paid, 0) as amount_paid'),
            ])
            ->when($search, fn ($q) => $q->where(function ($query) use ($search) {
                $query->where('invoices.invoice_number', 'like', "%{$search}%")
                    ->orWhere('clients.name', 'like', "%{$search}%");
            }))
            ->when($clientIds, fn ($q) => $q->whereIn('invoices.billed_to_id', $clientIds));

        $this->applyStatusFilter($query, $status);
        if ($status !== 'overdue') {
            $this->applyPeriodFilter($query, $month, $dateFrom, $dateTo, 'invoices.issue_date');
        }

        match ($sort) {
            'client_name' => $query->orderBy('clients.name', $direction),
            default => $query->orderBy("invoices.{$sort}", $direction),
        };

        $invoices = $query->paginate($perPage)->withQueryString()
            ->through(fn ($invoice) => [
                'id' => $invoice->id,
                'invoice_number' => $invoice->invoice_number,
                'client_name' => $invoice->client_name,
                'client_type' => $invoice->client_type,
                'issue_date' => $invoice->issue_date?->format('Y-m-d'),
                'due_date' => $invoice->due_date?->format('Y-m-d'),
                'total_amount' => $invoice->total_amount,
                'amount_paid' => (int) $invoice->amount_paid,
                'amount_remaining' => $invoice->total_amount - (int) $invoice->amount_paid,
                'status' => $invoice->status,
                'faktur' => $invoice->faktur,
            ]);

        // Stat cards follow every active filter, including the status tab, so
        // the totals always describe the rows on screen. Tab counts are the one
        // exception ($withStatus = false): they keep the period/client/search
        // scope but ignore status, otherwise every other tab would read 0.
        $filtered = function (bool $withStatus = true) use ($search, $status, $clientIds, $month, $dateFrom, $dateTo) {
            $q = Invoice::query()
                ->join('clients', 'invoices.billed_to_id', '=', 'clients.id')
                ->when($search, fn ($qq) => $qq->where(function ($w) use ($search) {
                    $w->where('invoices.invoice_number', 'like', "%{$search}%")
                        ->orWhere('clients.name', 'like', "%{$search}%");
                }))
                ->when($clientIds, fn ($qq) => $qq->whereIn('invoices.billed_to_id', $clientIds));
            if ($withStatus) {
                $this->applyStatusFilter($q, $status);
            }
            if (! ($withStatus && $status === 'overdue')) {
                $this->applyPeriodFilter($q, $month, $dateFrom, $dateTo, 'invoices.issue_date');
            }

            return $q;
        };

        // "Perlu ditagih": lintas bulan (abaikan periode & tab status), tetap ikut klien/pencarian.
        $overdueQuery = Invoice::query()
            ->join('clients', 'invoices.billed_to_id', '=', 'clients.id')
            ->when($search, fn ($qq) => $qq->where(function ($w) use ($search) {
                $w->where('invoices.invoice_number', 'like', "%{$search}%")
                    ->orWhere('clients.name', 'like', "%{$search}%");
            }))
            ->when($clientIds, fn ($qq) => $qq->whereIn('invoices.billed_to_id', $clientIds));
        $this->applyStatusFilter($overdueQuery, 'overdue');
        $overdueIds = $overdueQuery->pluck('invoices.id');
        $overdueAmount = max(0, (int) Invoice::whereIn('id', $overdueIds)->sum('total_amount')
            - (int) Payment::whereIn('invoice_id', $overdueIds)->sum('amount'));

        // Revenue/profit/count exclude drafts (match Listing.php behaviour).
        $statsIds = $filtered()->whereNotIn('invoices.status', ['draft', 'cancelled'])->pluck('invoices.id');

        $basicStats = DB::table('invoices')
            ->whereIn('id', $statsIds)
            ->selectRaw('COUNT(*) as invoice_count, COALESCE(SUM(total_amount), 0) as total_revenue')
            ->first();

        $itemStats = DB::table('invoice_items')
            ->whereIn('invoice_id', $statsIds)
            ->selectRaw('COALESCE(SUM(CASE WHEN is_tax_deposit = 0 THEN cogs_amount ELSE 0 END), 0) as total_cogs')
            ->first();

        // Total payments received on the filtered invoices (follows the active
        // period/client/search scope, excludes draft & cancelled).
        $totalPaid = (int) Payment::whereIn('invoice_id', $statsIds)->sum('amount');

        $totalRevenue = (int) $basicStats->total_revenue;
        $totalCogs = (int) $itemStats->total_cogs;

        // Outstanding within the active filters: billed minus paid on unpaid invoices.
        $outstandingIds = $filtered()->whereIn('invoices.status', ['sent', 'partially_paid'])->pluck('invoices.id');
        $billed = (int) Invoice::whereIn('id', $outstandingIds)->sum('total_amount');
        $paidOnOutstanding = (int) Payment::whereIn('invoice_id', $outstandingIds)->sum('amount');
        $totalOutstanding = max(0, $billed - $paidOnOutstanding);

        // Per-status tab counts within the same filtered scope (minus status).
        $statusCounts = $filtered(false)
            ->selectRaw('invoices.status as status, COUNT(*) as c')
            ->groupBy('invoices.status')
            ->pluck('c', 'status');

        $stats = [
            'invoice_count' => (int) $basicStats->invoice_count,
            'total_revenue' => $totalRevenue,
            'total_cogs' => $totalCogs,
            'gross_profit' => $totalRevenue - $totalCogs,
            'total_paid' => $totalPaid,
            'total_outstanding' => $totalOutstanding,
            'outstanding_count' => $outstandingIds->count(),
            'draft_count' => (int) ($statusCounts['draft'] ?? 0),
            'sent_count' => (int) ($statusCounts['sent'] ?? 0),
            'partially_paid_count' => (int) ($statusCounts['partially_paid'] ?? 0),
            'paid_count' => (int) ($statusCounts['paid'] ?? 0),
            'overdue_count' => $overdueIds->count(),
            'overdue_amount' => $overdueAmount,
        ];

        $clients = Client::orderBy('name')
            ->get(['id', 'name'])
            ->map(fn ($c) => ['label' => $c->name, 'value' => $c->id]);

        $customTemplates = PdfTemplate::query()
            ->orderByDesc('is_default')
            ->orderBy('name')
            ->get()
            ->map(fn (PdfTemplate $t) => [
                'id' => $t->id,
                'name' => $t->name,
                'isDefault' => (bool) $t->is_default,
            ]);

        return Inertia::render('invoices/index', [
            'invoices' => $invoices,
            'stats' => $stats,
            'clients' => $clients,
            'customTemplates' => $customTemplates,
            'selectedInvoiceId' => $selectedInvoiceId,
            'filters' => [
                'search' => $search,
                'status' => $status,
                'client_ids' => array_values(array_map('intval', $clientIds)),
                'month' => $month,
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
                'per_page' => $perPage,
                'sort' => $sort,
                'direction' => $direction,
            ],
        ]);
    }

    /**
     * Filter tab status. "overdue" = terkirim/sebagian yang jatuh temponya sudah lewat
     * (penanda, bukan status tersimpan).
     *
     * @param  Builder<Invoice>  $query
     */
    private function applyStatusFilter($query, ?string $status): void
    {
        if ($status === 'overdue') {
            $query->whereIn('invoices.status', ['sent', 'partially_paid'])
                ->whereDate('invoices.due_date', '<', today());
        } elseif (filled($status)) {
            $query->where('invoices.status', $status);
        }
    }

    /**
     * Apply the issue-date period filter. A date range (date_from/date_to)
     * takes precedence over the month filter when either bound is present,
     * so a range silently overrides a month value that is still set.
     *
     * @param  Builder<Invoice>  $query
     */
    private function applyPeriodFilter($query, ?string $month, ?string $dateFrom, ?string $dateTo, string $column = 'issue_date'): void
    {
        if (filled($dateFrom) || filled($dateTo)) {
            $query->when(filled($dateFrom), fn ($q) => $q->whereDate($column, '>=', $dateFrom))
                ->when(filled($dateTo), fn ($q) => $q->whereDate($column, '<=', $dateTo));
        } elseif (filled($month)) {
            $query->whereYear($column, substr($month, 0, 4))
                ->whereMonth($column, substr($month, 5, 2));
        }
    }

    /**
     * Build the recap dataset (filtered invoice rows + summary) shared by the
     * Excel and PDF exports. Honours the same filters as the index listing.
     *
     * @return array{rows: Collection<int, array<string, mixed>>, summary: array<string, mixed>, period: string}
     */
    private function buildRecapData(Request $request): array
    {
        $search = $request->input('search');
        $status = $request->input('status');
        $clientIds = array_filter((array) $request->input('client_ids', []), fn ($v) => $v !== '' && $v !== null);
        $month = $request->input('month', now()->format('Y-m'));
        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');
        $sort = $request->input('sort', 'issue_date');
        $direction = $request->input('direction', 'desc');

        $query = Invoice::query()
            ->join('clients', 'invoices.billed_to_id', '=', 'clients.id')
            ->leftJoin(
                DB::raw('(SELECT invoice_id, COALESCE(SUM(amount), 0) as amount_paid FROM payments GROUP BY invoice_id) as p'),
                'invoices.id', '=', 'p.invoice_id'
            )
            ->leftJoin(
                DB::raw('(SELECT invoice_id, COALESCE(SUM(cogs_amount), 0) as total_cogs FROM invoice_items GROUP BY invoice_id) as ic'),
                'invoices.id', '=', 'ic.invoice_id'
            )
            ->select([
                'invoices.*',
                'clients.name as client_name',
                DB::raw('COALESCE(p.amount_paid, 0) as amount_paid'),
                DB::raw('COALESCE(ic.total_cogs, 0) as total_cogs'),
            ])
            ->when($search, fn ($q) => $q->where(function ($query) use ($search) {
                $query->where('invoices.invoice_number', 'like', "%{$search}%")
                    ->orWhere('clients.name', 'like', "%{$search}%");
            }))
            ->when($clientIds, fn ($q) => $q->whereIn('invoices.billed_to_id', $clientIds))
            // Draft & cancelled invoices are not realised revenue, so they never
            // count toward the recap's omzet / HPP / profit / PPh figures.
            ->whereNotIn('invoices.status', ['draft', 'cancelled']);

        // Aturan filter sama persis dengan daftar: "Perlu ditagih" lintas bulan.
        $this->applyStatusFilter($query, $status);
        if ($status !== 'overdue') {
            $this->applyPeriodFilter($query, $month, $dateFrom, $dateTo, 'invoices.issue_date');
        }

        match ($sort) {
            'client_name' => $query->orderBy('clients.name', $direction),
            default => $query->orderBy("invoices.{$sort}", $direction),
        };

        $rows = $query->get()->map(function ($invoice) {
            $omzet = (int) $invoice->total_amount;
            $hpp = (int) $invoice->total_cogs;

            return [
                'invoice_number' => $invoice->invoice_number,
                'client_name' => $invoice->client_name,
                'issue_date' => $invoice->issue_date?->format('Y-m-d'),
                'due_date' => $invoice->due_date?->format('Y-m-d'),
                'total_amount' => $omzet,
                'hpp' => $hpp,
                'profit' => $omzet - $hpp,            // gross profit = omzet − HPP
                'pph_final' => (int) round($omzet * 0.005), // PP 55/2022 final: 0,5% × omzet
                'amount_paid' => (int) $invoice->amount_paid,
                'amount_remaining' => $omzet - (int) $invoice->amount_paid,
                'status' => $invoice->status,
            ];
        });

        $summary = [
            'count' => $rows->count(),
            'total_amount' => $rows->sum('total_amount'),
            'total_hpp' => $rows->sum('hpp'),
            'total_profit' => $rows->sum('profit'),
            'total_pph_final' => $rows->sum('pph_final'),
            'total_paid' => $rows->sum('amount_paid'),
            'total_outstanding' => $rows->sum('amount_remaining'),
        ];

        // Human-readable period label for the report header. A date range
        // overrides the month, matching the listing's filter precedence.
        if ($status === 'overdue') {
            $period = 'Perlu ditagih (lewat jatuh tempo, semua periode)';
        } elseif (filled($dateFrom) || filled($dateTo)) {
            $period = trim(($dateFrom ?: '…').' s/d '.($dateTo ?: '…'));
        } else {
            $period = $month
                ? Carbon::parse($month.'-01')->isoFormat('MMMM Y')
                : 'Semua Periode';
        }

        return ['rows' => $rows, 'summary' => $summary, 'period' => $period];
    }

    public function exportExcel(Request $request): BinaryFileResponse
    {
        $data = $this->buildRecapData($request);
        $filename = 'rekap-invoice-'.now()->format('Ymd-His').'.xlsx';

        return Excel::download(new InvoiceRecapExport($data['rows'], $data['summary'], $data['period']), $filename);
    }

    public function exportPdf(Request $request): HttpResponse
    {
        $data = $this->buildRecapData($request);
        $company = CompanyProfile::first();

        $pdf = Pdf::loadView('pdf.invoice-recap', [
            'rows' => $data['rows'],
            'summary' => $data['summary'],
            'period' => $data['period'],
            'company' => $company,
        ])->setPaper('a4', 'landscape');

        return $pdf->download('rekap-invoice-'.now()->format('Ymd-His').'.pdf');
    }

    /** /invoices/{id}: daftar invoice dengan drawer detail terbuka (drawer mengambil datanya sendiri). */
    public function show(Request $request, string $invoice): Response
    {
        return $this->index($request, (int) $invoice);
    }

    public function data(Invoice $invoice): JsonResponse
    {
        $invoice->load(['client', 'items.client', 'payments.bankAccount']);

        return response()->json([
            'id' => $invoice->id,
            'invoice_number' => $invoice->invoice_number,
            'next_invoice_number' => $invoice->status === 'draft'
                ? Invoice::generateInvoiceNumber($invoice->issue_date, $invoice->billed_to_id)
                : null,
            'status' => $invoice->status,
            'issue_date' => $invoice->issue_date?->format('Y-m-d'),
            'due_date' => $invoice->due_date?->format('Y-m-d'),
            'subtotal' => $invoice->subtotal,
            'discount_amount' => $invoice->discount_amount,
            'discount_type' => $invoice->discount_type,
            'discount_value' => $invoice->discount_value,
            'discount_reason' => $invoice->discount_reason,
            'total_amount' => $invoice->total_amount,
            'amount_paid' => $invoice->amount_paid,
            'amount_remaining' => $invoice->amount_remaining,
            'faktur' => $invoice->faktur,
            'rollbackable' => $invoice->status === 'sent' && Invoice::isLatestInNumberingPeriod($invoice),
            'custom_templates' => PdfTemplate::query()->orderByDesc('is_default')->orderBy('name')->get()
                ->map(fn (PdfTemplate $t) => ['id' => $t->id, 'name' => $t->name, 'isDefault' => (bool) $t->is_default]),
            'created_at' => $invoice->created_at?->toIso8601String(),
            'updated_at' => $invoice->updated_at?->toIso8601String(),
            'client' => [
                'id' => $invoice->client->id,
                'name' => $invoice->client->name,
                'type' => $invoice->client->type,
                'email' => $invoice->client->email,
                'NPWP' => $invoice->client->NPWP,
                'address' => $invoice->client->address,
            ],
            'items' => $invoice->items->map(fn ($item) => [
                'id' => $item->id,
                'client_id' => $item->client_id,
                'client_name' => $item->client?->name,
                'service_name' => $item->service_name,
                'quantity' => (float) $item->quantity,
                'unit' => $item->unit,
                'unit_price' => $item->unit_price,
                'amount' => $item->amount,
                'cogs_amount' => $item->cogs_amount,
                'is_tax_deposit' => $item->is_tax_deposit,
            ]),
            'payments' => $invoice->payments->map(fn ($payment) => [
                'id' => $payment->id,
                'amount' => $payment->amount,
                'payment_date' => $payment->payment_date?->format('Y-m-d'),
                'payment_method' => $payment->payment_method,
                'bank_account_id' => $payment->bank_account_id,
                'bank_account_name' => $payment->bankAccount
                    ? $payment->bankAccount->account_name.' ('.$payment->bankAccount->bank_name.')'
                    : null,
                'reference_number' => $payment->reference_number,
                'attachment_name' => $payment->attachment_name,
                'attachment_url' => $payment->attachment_url,
                'created_at' => $payment->created_at?->toIso8601String(),
            ]),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('invoices/create', $this->formOptions());
    }

    /**
     * Pilihan klien & layanan untuk editor invoice.
     *
     * @return array{clients: Collection<int, array<string, mixed>>, services: Collection<int, array<string, mixed>>}
     */
    private function formOptions(?int $includeClientId = null): array
    {
        return [
            'clients' => Client::where('status', 'Active')
                ->when($includeClientId, fn ($q) => $q->orWhere('id', $includeClientId))
                ->orderBy('name')
                ->get(['id', 'name', 'email', 'NPWP', 'type'])
                ->map(fn ($c) => ['id' => $c->id, 'name' => $c->name, 'email' => $c->email, 'npwp' => $c->NPWP, 'type' => $c->type]),
            'services' => Service::orderBy('name')
                ->get(['id', 'name', 'price', 'type'])
                ->map(fn ($s) => ['id' => $s->id, 'name' => $s->name, 'price' => $s->price, 'type' => $s->type]),
        ];
    }

    public function store(StoreInvoiceRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        $publish = $request->boolean('publish');

        $invoice = DB::transaction(function () use ($validated, $publish) {
            ['attributes' => $attributes, 'items' => $items] = $this->buildInvoiceData($validated);

            $invoice = Invoice::create([...$attributes, 'status' => 'draft']);
            $invoice->items()->createMany($items);

            if ($publish) {
                $this->publish($invoice);
            }

            return $invoice;
        });

        return redirect()->route('invoices.show', $invoice)->with('success', $publish
            ? 'Invoice diterbitkan: '.$invoice->invoice_number
            : 'Invoice disimpan sebagai draft.');
    }

    /**
     * Hitung atribut invoice & baris item dari input editor. Dipakai store, update, dan pratinjau
     * sehingga angka di pratinjau selalu sama dengan yang tersimpan.
     *
     * @param  array<string, mixed>  $validated
     * @return array{attributes: array<string, mixed>, items: list<array<string, mixed>>}
     */
    private function buildInvoiceData(array $validated): array
    {
        $subtotal = 0;
        $items = [];

        foreach ($validated['items'] ?? [] as $item) {
            $quantity = (float) ($item['quantity'] ?? 0);
            $unitPrice = (int) ($item['unit_price'] ?? 0);
            $amount = (int) round($unitPrice * $quantity);

            $items[] = [
                'client_id' => $item['client_id'] ?? $validated['client_id'] ?? null,
                'service_name' => $item['service_name'] ?? '',
                'quantity' => $quantity,
                'unit' => $item['unit'] ?? 'pcs',
                'unit_price' => $unitPrice,
                'amount' => $amount,
                'cogs_amount' => (int) ($item['cogs_amount'] ?? 0),
                'is_tax_deposit' => (bool) ($item['is_tax_deposit'] ?? false),
            ];

            $subtotal += $amount;
        }

        $discountType = $validated['discount_type'] ?? 'fixed';
        $discountValue = (int) ($validated['discount_value'] ?? 0);
        $discountAmount = $discountType === 'percentage'
            ? (int) round($subtotal * $discountValue / 100)
            : $discountValue;

        return [
            'attributes' => [
                'billed_to_id' => $validated['client_id'] ?? null,
                'subtotal' => $subtotal,
                'discount_amount' => $discountAmount,
                'discount_type' => $discountType,
                'discount_value' => $discountValue,
                'discount_reason' => $validated['discount_reason'] ?? null,
                'total_amount' => max(0, $subtotal - $discountAmount),
                'issue_date' => $validated['issue_date'] ?? null,
                'due_date' => $validated['due_date'] ?? null,
            ],
            'items' => $items,
        ];
    }

    /** Beri nomor berikutnya & ubah draft menjadi terkirim (dipakai "Simpan & terbitkan"). */
    private function publish(Invoice $invoice): void
    {
        $invoice->update([
            'invoice_number' => Invoice::generateInvoiceNumber($invoice->issue_date, $invoice->billed_to_id),
            'status' => 'sent',
        ]);
    }

    /**
     * Pratinjau langsung editor: PDF dari data yang belum disimpan, lewat jalur render yang sama
     * dengan unduhan (InvoicePrintService::renderPdf). Nomor (tersimpan atau perkiraan) dikirim
     * lewat header X-Invoice-Number.
     */
    public function preview(InvoicePreviewRequest $request): HttpResponse
    {
        $validated = $request->validated();
        ['attributes' => $attributes, 'items' => $items] = $this->buildInvoiceData($validated);

        $clients = Client::whereIn('id', array_filter([$attributes['billed_to_id'], ...array_column($items, 'client_id')]))
            ->get()
            ->keyBy('id');
        $billedTo = $clients->get($attributes['billed_to_id']) ?? new Client(['name' => '—']);

        $number = isset($validated['invoice_id']) ? Invoice::find($validated['invoice_id'])?->invoice_number : null;
        if (! $number && $attributes['billed_to_id'] && $attributes['issue_date']) {
            $number = Invoice::generateInvoiceNumber(Carbon::parse($attributes['issue_date']), $attributes['billed_to_id']);
        }

        $invoice = new Invoice([
            ...$attributes,
            'issue_date' => $attributes['issue_date'] ?? today(),
            'due_date' => $attributes['due_date'] ?? today(),
        ]);
        $invoice->invoice_number = $number;
        $invoice->setRelation('client', $billedTo);
        $invoice->setRelation('payments', collect());
        $invoice->setRelation('items', collect($items)->map(fn (array $item) => (new InvoiceItem($item))
            ->setRelation('client', $clients->get($item['client_id']) ?? $billedTo)));

        $pdf = (new InvoicePrintService)->renderPdf(
            $invoice,
            null,
            null,
            $validated['template'] ?? 'kisantra-invoice',
            isset($validated['highlight']) ? (int) $validated['highlight'] : null,
        );

        return response($pdf->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="pratinjau-invoice.pdf"',
            'X-Invoice-Number' => $number ?? '',
        ]);
    }

    public function edit(Invoice $invoice): Response
    {
        $invoice->load(['items']);

        return Inertia::render('invoices/edit', [
            ...$this->formOptions($invoice->billed_to_id),
            'invoice' => [
                'id' => $invoice->id,
                'invoice_number' => $invoice->invoice_number,
                'status' => $invoice->status,
                'client_id' => $invoice->billed_to_id,
                'issue_date' => $invoice->issue_date?->format('Y-m-d'),
                'due_date' => $invoice->due_date?->format('Y-m-d'),
                'discount_type' => $invoice->discount_type ?? 'fixed',
                'discount_value' => $invoice->discount_value ?? 0,
                'discount_reason' => $invoice->discount_reason,
                'items' => $invoice->items->map(fn ($item) => [
                    'client_id' => $item->client_id,
                    'service_name' => $item->service_name,
                    'quantity' => (float) $item->quantity,
                    'unit' => $item->unit,
                    'unit_price' => $item->unit_price,
                    'cogs_amount' => $item->cogs_amount,
                    'is_tax_deposit' => $item->is_tax_deposit,
                ]),
            ],
        ]);
    }

    public function update(UpdateInvoiceRequest $request, Invoice $invoice): RedirectResponse
    {
        $validated = $request->validated();
        $publish = $request->boolean('publish') && $invoice->status === 'draft';

        DB::transaction(function () use ($validated, $invoice, $publish) {
            ['attributes' => $attributes, 'items' => $items] = $this->buildInvoiceData($validated);

            $invoice->update($attributes);
            $invoice->items()->delete();
            $invoice->items()->createMany($items);

            if ($publish) {
                $this->publish($invoice);
            }
        });

        return redirect()->route('invoices.show', $invoice)->with('success', $publish
            ? 'Invoice diterbitkan: '.$invoice->invoice_number
            : 'Invoice berhasil diperbarui.');
    }

    public function destroy(Request $request, Invoice $invoice): JsonResponse|RedirectResponse
    {
        if ($invoice->payments()->exists()) {
            return $this->actionResult($request, false, 'Invoice yang sudah memiliki pembayaran tidak dapat dihapus. Hapus pembayarannya terlebih dahulu.');
        }

        DB::transaction(function () use ($invoice) {
            $invoice->items()->delete();
            $invoice->delete();
        });

        return $this->actionResult($request, true, 'Invoice berhasil dihapus.');
    }

    public function send(SendInvoiceRequest $request, Invoice $invoice): JsonResponse|RedirectResponse
    {
        if ($invoice->status !== 'draft') {
            return $this->actionResult($request, false, 'Hanya invoice draft yang dapat dikirim.');
        }

        $invoice->update([
            'invoice_number' => $request->invoice_number,
            'status' => 'sent',
        ]);

        return $this->actionResult($request, true, 'Invoice diterbitkan: '.$request->invoice_number);
    }

    public function rollback(Request $request, Invoice $invoice): JsonResponse|RedirectResponse
    {
        if ($invoice->status !== 'sent') {
            return $this->actionResult($request, false, 'Hanya invoice yang sudah terkirim yang bisa di-rollback.');
        }

        if (! Invoice::isLatestInNumberingPeriod($invoice)) {
            return $this->actionResult($request, false, 'Hanya invoice dengan nomor urut terakhir di periodenya yang bisa di-rollback.');
        }

        $invoice->update(['invoice_number' => null, 'status' => 'draft']);

        return $this->actionResult($request, true, 'Invoice berhasil dikembalikan ke draft.');
    }

    /**
     * Drawer detail memanggil aksi lewat fetch (JSON) agar halaman di belakang modal tidak berganti;
     * halaman lain tetap mendapat redirect back + flash.
     */
    private function actionResult(Request $request, bool $ok, string $message): JsonResponse|RedirectResponse
    {
        if ($request->expectsJson()) {
            return response()->json(['message' => $message], $ok ? 200 : 422);
        }

        return redirect()->back()->with($ok ? 'success' : 'error', $message);
    }
}
