<?php

namespace App\Http\Controllers;

use App\Exports\InvoiceRecapExport;
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
    public function index(Request $request): Response
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
            ->when($status, fn ($q) => $q->where('invoices.status', $status))
            ->when($clientIds, fn ($q) => $q->whereIn('invoices.billed_to_id', $clientIds));

        $this->applyPeriodFilter($query, $month, $dateFrom, $dateTo, 'invoices.issue_date');

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
                'issue_date' => $invoice->issue_date,
                'due_date' => $invoice->due_date,
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
                ->when($withStatus && $status, fn ($qq) => $qq->where('invoices.status', $status))
                ->when($clientIds, fn ($qq) => $qq->whereIn('invoices.billed_to_id', $clientIds));
            $this->applyPeriodFilter($q, $month, $dateFrom, $dateTo, 'invoices.issue_date');

            return $q;
        };

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
        ];

        $clients = Client::orderBy('name')
            ->get(['id', 'name'])
            ->map(fn ($c) => ['label' => $c->name, 'value' => $c->id]);

        // Rollback-eligible invoice IDs: highest sequence per year-month among sent invoices
        $rollbackableIds = Invoice::where('status', 'sent')
            ->whereNotNull('invoice_number')
            ->where('invoice_number', 'LIKE', '%/INV/%')
            ->get(['id', 'invoice_number', 'issue_date'])
            ->groupBy(fn ($inv) => date('Y-m', strtotime($inv->issue_date)))
            ->map(fn ($group) => $group->sortByDesc(fn ($inv) => (int) explode('/INV/', $inv->invoice_number)[0])->first())
            ->pluck('id')
            ->values()
            ->all();

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
            'rollbackableIds' => $rollbackableIds,
            'customTemplates' => $customTemplates,
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
            ->when($status, fn ($q) => $q->where('invoices.status', $status))
            ->when($clientIds, fn ($q) => $q->whereIn('invoices.billed_to_id', $clientIds))
            // Draft & cancelled invoices are not realised revenue, so they never
            // count toward the recap's omzet / HPP / profit / PPh figures.
            ->whereNotIn('invoices.status', ['draft', 'cancelled']);

        $this->applyPeriodFilter($query, $month, $dateFrom, $dateTo, 'invoices.issue_date');

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
        if (filled($dateFrom) || filled($dateTo)) {
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

    public function show(Invoice $invoice): JsonResponse
    {
        $invoice->load(['client', 'items', 'payments.bankAccount']);

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
            'client' => [
                'id' => $invoice->client->id,
                'name' => $invoice->client->name,
                'email' => $invoice->client->email,
                'NPWP' => $invoice->client->NPWP,
                'address' => $invoice->client->address,
            ],
            'items' => $invoice->items->map(fn ($item) => [
                'id' => $item->id,
                'client_id' => $item->client_id,
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
            ]),
        ]);
    }

    public function create(): Response
    {
        $clients = Client::where('status', 'Active')
            ->orderBy('name')
            ->get(['id', 'name', 'email'])
            ->map(fn ($c) => ['id' => $c->id, 'name' => $c->name, 'email' => $c->email]);

        $services = Service::orderBy('name')
            ->get(['id', 'name', 'price', 'type'])
            ->map(fn ($s) => ['id' => $s->id, 'name' => $s->name, 'price' => $s->price, 'type' => $s->type]);

        $nextSeq = Invoice::getMaxSequenceFromDb(now()) + 1;
        $companyInitials = Invoice::extractCompanyInitials(
            optional(CompanyProfile::first())->name ?? 'SPI'
        ) ?: 'SPI';

        return Inertia::render('invoices/create', [
            'clients' => $clients,
            'services' => $services,
            'nextSeq' => $nextSeq,
            'companyInitials' => $companyInitials,
        ]);
    }

    public function store(StoreInvoiceRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        DB::transaction(function () use ($validated) {
            $subtotal = 0;
            $parsedItems = [];

            foreach ($validated['items'] as $item) {
                $quantity = (float) $item['quantity'];
                $unitPrice = (int) $item['unit_price'];
                $amount = (int) round($unitPrice * $quantity);
                $cogsAmount = (int) ($item['cogs_amount'] ?? 0);

                $parsedItems[] = [
                    'client_id' => $item['client_id'] ?? $validated['client_id'],
                    'service_name' => $item['service_name'],
                    'quantity' => $quantity,
                    'unit' => $item['unit'] ?? 'pcs',
                    'unit_price' => $unitPrice,
                    'amount' => $amount,
                    'cogs_amount' => $cogsAmount,
                    'is_tax_deposit' => (bool) ($item['is_tax_deposit'] ?? false),
                ];

                $subtotal += $amount;
            }

            $discountType = $validated['discount_type'] ?? 'fixed';
            $discountValue = (int) ($validated['discount_value'] ?? 0);
            $discountAmount = $discountType === 'percentage'
                ? (int) round($subtotal * $discountValue / 100)
                : $discountValue;

            $totalAmount = max(0, $subtotal - $discountAmount);

            $invoice = Invoice::create([
                'billed_to_id' => $validated['client_id'],
                'subtotal' => $subtotal,
                'discount_amount' => $discountAmount,
                'discount_type' => $discountType,
                'discount_value' => $discountValue,
                'discount_reason' => $validated['discount_reason'] ?? null,
                'total_amount' => $totalAmount,
                'issue_date' => $validated['issue_date'],
                'due_date' => $validated['due_date'],
                'status' => 'draft',
            ]);

            foreach ($parsedItems as $itemData) {
                InvoiceItem::create(array_merge($itemData, ['invoice_id' => $invoice->id]));
            }
        });

        return redirect()->route('invoices.index')->with('success', 'Invoice berhasil dibuat.');
    }

    public function edit(Invoice $invoice): Response
    {
        $invoice->load(['items']);

        $clients = Client::where('status', 'Active')
            ->orderBy('name')
            ->get(['id', 'name', 'email'])
            ->map(fn ($c) => ['id' => $c->id, 'name' => $c->name, 'email' => $c->email]);

        $services = Service::orderBy('name')
            ->get(['id', 'name', 'price', 'type'])
            ->map(fn ($s) => ['id' => $s->id, 'name' => $s->name, 'price' => $s->price, 'type' => $s->type]);

        return Inertia::render('invoices/edit', [
            'invoice' => [
                'id' => $invoice->id,
                'invoice_number' => $invoice->invoice_number,
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
            'clients' => $clients,
            'services' => $services,
        ]);
    }

    public function update(UpdateInvoiceRequest $request, Invoice $invoice): RedirectResponse
    {
        $validated = $request->validated();

        DB::transaction(function () use ($validated, $invoice) {
            $subtotal = 0;
            $parsedItems = [];

            foreach ($validated['items'] as $item) {
                $quantity = (float) $item['quantity'];
                $unitPrice = (int) $item['unit_price'];
                $amount = (int) round($unitPrice * $quantity);
                $cogsAmount = (int) ($item['cogs_amount'] ?? 0);

                $parsedItems[] = [
                    'invoice_id' => $invoice->id,
                    'client_id' => $item['client_id'] ?? $validated['client_id'],
                    'service_name' => $item['service_name'],
                    'quantity' => $quantity,
                    'unit' => $item['unit'] ?? 'pcs',
                    'unit_price' => $unitPrice,
                    'amount' => $amount,
                    'cogs_amount' => $cogsAmount,
                    'is_tax_deposit' => (bool) ($item['is_tax_deposit'] ?? false),
                ];

                $subtotal += $amount;
            }

            $discountType = $validated['discount_type'] ?? 'fixed';
            $discountValue = (int) ($validated['discount_value'] ?? 0);
            $discountAmount = $discountType === 'percentage'
                ? (int) round($subtotal * $discountValue / 100)
                : $discountValue;

            $totalAmount = max(0, $subtotal - $discountAmount);

            $invoice->update([
                'billed_to_id' => $validated['client_id'],
                'subtotal' => $subtotal,
                'discount_amount' => $discountAmount,
                'discount_type' => $discountType,
                'discount_value' => $discountValue,
                'discount_reason' => $validated['discount_reason'] ?? null,
                'total_amount' => $totalAmount,
                'issue_date' => $validated['issue_date'],
                'due_date' => $validated['due_date'],
            ]);

            $invoice->items()->delete();
            foreach ($parsedItems as $itemData) {
                InvoiceItem::create($itemData);
            }
        });

        return redirect()->route('invoices.index')->with('success', 'Invoice berhasil diperbarui.');
    }

    public function destroy(Invoice $invoice): RedirectResponse
    {
        if ($invoice->payments()->exists()) {
            return redirect()->back()->with('error', 'Invoice yang sudah memiliki pembayaran tidak dapat dihapus. Hapus pembayarannya terlebih dahulu.');
        }

        DB::transaction(function () use ($invoice) {
            $invoice->items()->delete();
            $invoice->delete();
        });

        return redirect()->back()->with('success', 'Invoice berhasil dihapus.');
    }

    public function send(SendInvoiceRequest $request, Invoice $invoice): RedirectResponse
    {

        if ($invoice->status !== 'draft') {
            return redirect()->back()->with('error', 'Hanya invoice draft yang dapat dikirim.');
        }

        $invoice->update([
            'invoice_number' => $request->invoice_number,
            'status' => 'sent',
        ]);

        return redirect()->back()->with('success', 'Invoice berhasil dikirim: '.$request->invoice_number);
    }

    public function rollback(Invoice $invoice): RedirectResponse
    {
        if ($invoice->status !== 'sent') {
            return redirect()->back()->with('error', 'Hanya invoice yang sudah terkirim yang bisa di-rollback.');
        }

        if (! Invoice::isInvoiceLatestInMonth($invoice)) {
            return redirect()->back()->with('error', 'Hanya invoice terbaru di bulan ini yang bisa di-rollback.');
        }

        $invoice->update(['invoice_number' => null, 'status' => 'draft']);

        return redirect()->back()->with('success', 'Invoice berhasil dikembalikan ke draft.');
    }
}
