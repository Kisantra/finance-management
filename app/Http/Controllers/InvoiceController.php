<?php

namespace App\Http\Controllers;

use App\Exports\InvoiceRecapExport;
use App\Exports\InvoiceRecapJsmExport;
use App\Http\Requests\InvoicePreviewRequest;
use App\Http\Requests\NextInvoiceNumberRequest;
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
use App\Services\CompanyInvoiceTemplate;
use App\Services\InvoiceNumberService;
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
                DB::raw('(SELECT invoice_id, COALESCE(SUM(amount), 0) as amount_paid, COALESCE(SUM(foreign_amount), 0) as foreign_paid FROM payments GROUP BY invoice_id) as p'),
                'invoices.id', '=', 'p.invoice_id'
            )
            ->select([
                'invoices.*',
                'clients.name as client_name',
                'clients.type as client_type',
                DB::raw('COALESCE(p.amount_paid, 0) as amount_paid'),
                DB::raw('COALESCE(p.foreign_paid, 0) as foreign_paid_sum'),
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
                'document_type' => $invoice->document_type,
                'client_name' => $invoice->client_name,
                'client_type' => $invoice->client_type,
                'issue_date' => $invoice->issue_date?->format('Y-m-d'),
                'due_date' => $invoice->due_date?->format('Y-m-d'),
                'total_amount' => $invoice->total_amount,
                'amount_paid' => (int) $invoice->amount_paid,
                'amount_remaining' => $this->remainingOf($invoice),
                'currency' => $invoice->currency ?? Invoice::CURRENCY_IDR,
                'total_foreign' => $invoice->total_foreign !== null ? (float) $invoice->total_foreign : null,
                'foreign_remaining' => $invoice->isForeign()
                    ? max(0, Invoice::cents($invoice->total_foreign) - Invoice::cents($invoice->foreign_paid_sum)) / 100
                    : null,
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
        $overdueAmount = Invoice::outstandingTotal($overdueIds);

        // Revenue/profit/count exclude drafts (match Listing.php behaviour).
        $statsIds = $filtered()->whereNotIn('invoices.status', ['draft', 'cancelled'])->pluck('invoices.id');

        $basicStats = DB::table('invoices')
            ->whereIn('id', $statsIds)
            ->selectRaw('COUNT(*) as invoice_count, COALESCE(SUM(total_amount), 0) as total_revenue, COALESCE(SUM(ppn_amount), 0) as total_ppn, COALESCE(SUM(pph_amount), 0) as total_pph, COALESCE(SUM(CASE WHEN ppn_amount > 0 THEN 1 ELSE 0 END), 0) as ppn_invoice_count')
            ->first();

        $itemStats = DB::table('invoice_items')
            ->whereIn('invoice_id', $statsIds)
            ->selectRaw('COALESCE(SUM(CASE WHEN is_tax_deposit = 0 THEN cogs_amount ELSE 0 END), 0) as total_cogs, COALESCE(SUM(CASE WHEN is_tax_deposit = 1 THEN amount ELSE 0 END), 0) as total_tax_deposit')
            ->first();

        // Total payments received on the filtered invoices (follows the active
        // period/client/search scope, excludes draft & cancelled).
        $totalPaid = (int) Payment::whereIn('invoice_id', $statsIds)->sum('amount');

        $totalRevenue = (int) $basicStats->total_revenue;
        $totalCogs = (int) $itemStats->total_cogs;

        // Outstanding within the active filters: billed minus paid on unpaid invoices.
        $outstandingIds = $filtered()->whereIn('invoices.status', ['sent', 'partially_paid'])->pluck('invoices.id');
        $totalOutstanding = Invoice::outstandingTotal($outstandingIds);

        // Per-status tab counts within the same filtered scope (minus status).
        $statusCounts = $filtered(false)
            ->selectRaw('invoices.status as status, COUNT(*) as c')
            ->groupBy('invoices.status')
            ->pluck('c', 'status');

        $stats = [
            'invoice_count' => (int) $basicStats->invoice_count,
            'total_revenue' => $totalRevenue,
            'total_cogs' => $totalCogs,
            'total_ppn' => (int) $basicStats->total_ppn,
            'ppn_invoice_count' => (int) $basicStats->ppn_invoice_count,
            // PPN dan titipan (titipan pajak klien, talangan Debit Note) ikut ditagih (total_revenue)
            // tetapi bukan laba; potongan PPh 23 tidak ikut ditagih tetapi tetap pendapatan (kredit
            // pajak) — sama dengan laba kotor di drawer & editor.
            'total_tax_deposit' => (int) $itemStats->total_tax_deposit,
            'total_pph' => (int) $basicStats->total_pph,
            'gross_profit' => $totalRevenue + (int) $basicStats->total_pph - (int) $basicStats->total_ppn - (int) $itemStats->total_tax_deposit - $totalCogs,
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
            // Kartu PPN tetap tampil selama PKP walau periode ini belum punya invoice ber-PPN.
            'ppnEnabled' => (bool) CompanyProfile::current()?->is_pkp,
            'clients' => $clients,
            'customTemplates' => $customTemplates,
            'companyTemplate' => CompanyInvoiceTemplate::option(),
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
     * Sisa tagihan baris daftar/rekap dari kolom agregat query (`amount_paid`, `foreign_paid_sum`), sama dengan
     * accessor Invoice::amount_remaining: tagihan USD = sisa USD × kurs invoice, tidak minus bila kurs naik.
     */
    private function remainingOf(Invoice $invoice): int
    {
        if (! $invoice->isForeign()) {
            return (int) $invoice->total_amount - (int) $invoice->getAttributes()['amount_paid'];
        }

        $sisa = max(0, Invoice::cents($invoice->total_foreign) - Invoice::cents($invoice->foreign_paid_sum)) / 100;

        return (int) round($sisa * (float) $invoice->exchange_rate);
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
     * @return array{rows: Collection<int, array<string, mixed>>, summary: array<string, mixed>, period: string, client_ids: array<int, mixed>}
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
                DB::raw('(SELECT invoice_id, COALESCE(SUM(amount), 0) as amount_paid, COALESCE(SUM(foreign_amount), 0) as foreign_paid FROM payments GROUP BY invoice_id) as p'),
                'invoices.id', '=', 'p.invoice_id'
            )
            ->leftJoin(
                DB::raw('(SELECT invoice_id, COALESCE(SUM(cogs_amount), 0) as total_cogs, COALESCE(SUM(CASE WHEN is_tax_deposit = 1 THEN amount ELSE 0 END), 0) as total_tax_deposit FROM invoice_items GROUP BY invoice_id) as ic'),
                'invoices.id', '=', 'ic.invoice_id'
            )
            ->select([
                'invoices.*',
                'clients.name as client_name',
                DB::raw('COALESCE(p.amount_paid, 0) as amount_paid'),
                DB::raw('COALESCE(p.foreign_paid, 0) as foreign_paid_sum'),
                DB::raw('COALESCE(ic.total_cogs, 0) as total_cogs'),
                DB::raw('COALESCE(ic.total_tax_deposit, 0) as total_tax_deposit'),
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

        $invoices = $query->get();
        $ids = $invoices->pluck('id');
        // Untuk template JSM: nama layanan per invoice & tanggal bayar terakhir (2 query, bukan per baris).
        $itemNames = InvoiceItem::whereIn('invoice_id', $ids)->where('is_tax_deposit', false)->orderBy('id')->get(['invoice_id', 'service_name'])
            ->groupBy('invoice_id')
            ->map(fn ($items) => $items->pluck('service_name')->filter()->unique()->implode(', '));
        $lastPayments = Payment::whereIn('invoice_id', $ids)
            ->selectRaw('invoice_id, MAX(payment_date) as last_payment_date')
            ->groupBy('invoice_id')
            ->pluck('last_payment_date', 'invoice_id');

        $rows = $invoices->map(function ($invoice) use ($itemNames, $lastPayments) {
            $ppn = (int) $invoice->ppn_amount;
            $titipan = (int) $invoice->total_tax_deposit;
            // PPN (titipan negara) dan titipan pajak klien / talangan Debit Note ikut ditagih tetapi
            // bukan omzet, sehingga juga bukan dasar PPh final. Potongan PPh 23 sebaliknya tidak
            // ditransfer klien tetapi tetap omzet.
            $omzet = (int) $invoice->total_amount + (int) $invoice->pph_amount - $ppn - $titipan;
            $hpp = (int) $invoice->total_cogs;

            return [
                'invoice_number' => $invoice->invoice_number,
                'document_type' => $invoice->document_type,
                'client_name' => $invoice->client_name,
                'issue_date' => $invoice->issue_date?->format('Y-m-d'),
                'due_date' => $invoice->due_date?->format('Y-m-d'),
                'total_amount' => $omzet,
                // Yang ditagih sebelum PPN (omzet + titipan) — "Total Invoice" rekap JSM, agar
                // Total Invoice + PPN tetap sama dengan tagihannya.
                'total_before_ppn' => $omzet + $titipan,
                'titipan' => $titipan,
                'ppn' => $ppn,
                // null = invoice sebelum fitur PPN (tanpa data PPN); 0 = tanpa PPN.
                'ppn_rate' => $invoice->ppn_rate !== null ? (float) $invoice->ppn_rate : null,
                'hpp' => $hpp,
                'profit' => $omzet - $hpp,            // gross profit = omzet − HPP
                'pph_final' => (int) round($omzet * 0.005), // PP 55/2022 final: 0,5% × omzet
                'amount_paid' => (int) $invoice->amount_paid,
                'amount_remaining' => $this->remainingOf($invoice),
                'status' => $invoice->status,
                'invoice_sequence' => $invoice->invoice_sequence,
                'items_description' => $itemNames[$invoice->id] ?? '',
                'last_payment_date' => $lastPayments[$invoice->id] ?? null,
            ];
        });

        $summary = [
            'count' => $rows->count(),
            'total_amount' => $rows->sum('total_amount'),
            'total_ppn' => $rows->sum('ppn'),
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
                : __('Semua Periode');
        }

        return ['rows' => $rows, 'summary' => $summary, 'period' => $period, 'client_ids' => $clientIds];
    }

    public function exportExcel(Request $request): BinaryFileResponse
    {
        $data = $this->buildRecapData($request);

        if ($request->input('template') === 'jsm') {
            return Excel::download(
                new InvoiceRecapJsmExport($data['rows'], $this->jsmRecapTitle($data['client_ids']), $this->jsmRecapPeriod($request, $data['period']), (float) (CompanyProfile::current()?->ppn_rate ?? 11)),
                'rekap-invoice-jsm-'.now()->format('Ymd-His').'.xlsx',
            );
        }

        return Excel::download(new InvoiceRecapExport($data['rows'], $data['summary'], $data['period']), 'rekap-invoice-'.now()->format('Ymd-His').'.xlsx');
    }

    /**
     * Judul rekap JSM: "Recap Invoice - {inisial perusahaan}", dengan nama klien bila diekspor untuk satu klien.
     *
     * @param  array<int, mixed>  $clientIds
     */
    private function jsmRecapTitle(array $clientIds): string
    {
        $initials = app(InvoiceNumberService::class)->companyInitials();
        $client = count($clientIds) === 1 ? Client::find(reset($clientIds))?->name : null;

        return $client ? "Recap Invoice {$client} - {$initials}" : "Recap Invoice - {$initials}";
    }

    /** Periode rekap JSM seperti file aslinya: "2026" (setahun penuh), "Oktober 2026", atau "1 Januari 2026 – 31 Maret 2026". */
    private function jsmRecapPeriod(Request $request, string $fallback): string
    {
        $from = $request->input('date_from');
        $to = $request->input('date_to');
        if ($request->input('status') === 'overdue' || (blank($from) && blank($to))) {
            return $fallback;
        }
        if (filled($from) && filled($to)) {
            $start = Carbon::parse($from)->locale('id');
            $end = Carbon::parse($to)->locale('id');
            if ($start->isSameDay($start->copy()->startOfYear()) && $end->isSameDay($start->copy()->endOfYear())) {
                return $start->format('Y');
            }

            return $start->isoFormat('D MMMM Y').' – '.$end->isoFormat('D MMMM Y');
        }

        return filled($from) ? 'sejak '.Carbon::parse($from)->locale('id')->isoFormat('D MMMM Y') : 's/d '.Carbon::parse($to)->locale('id')->isoFormat('D MMMM Y');
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
                ? Invoice::generateInvoiceNumber($invoice->issue_date, $invoice->billed_to_id, $invoice->document_type, $invoice->document_code)
                : null,
            'document_type' => $invoice->document_type,
            'document_code' => $invoice->document_code,
            'status' => $invoice->status,
            'issue_date' => $invoice->issue_date?->format('Y-m-d'),
            'due_date' => $invoice->due_date?->format('Y-m-d'),
            'subtotal' => $invoice->subtotal,
            'discount_amount' => $invoice->discount_amount,
            'discount_type' => $invoice->discount_type,
            'discount_value' => $invoice->discount_value,
            'discount_reason' => $invoice->discount_reason,
            'ppn_rate' => $invoice->ppn_rate !== null ? (float) $invoice->ppn_rate : null,
            'ppn_amount' => (int) $invoice->ppn_amount,
            'pph_rate' => (float) $invoice->pph_rate > 0 ? (float) $invoice->pph_rate : null,
            'pph_amount' => (int) $invoice->pph_amount,
            'dpp_amount' => $invoice->dpp_amount,
            'total_amount' => $invoice->total_amount,
            'amount_paid' => $invoice->amount_paid,
            'amount_remaining' => $invoice->amount_remaining,
            // Tagihan USD: utang, terbayar, dan sisa dalam USD; kurs invoice untuk menilai Rupiahnya.
            'currency' => $invoice->currency ?? Invoice::CURRENCY_IDR,
            'exchange_rate' => $invoice->exchange_rate !== null ? (float) $invoice->exchange_rate : null,
            'total_foreign' => $invoice->total_foreign !== null ? (float) $invoice->total_foreign : null,
            'foreign_paid' => $invoice->isForeign() ? $invoice->foreign_paid : null,
            'foreign_remaining' => $invoice->foreign_remaining,
            // Pratinjau jurnal pembayaran ("titipan dulu", Invoice::allocatePayments): Σ item titipan pajak.
            'tax_deposit_total' => (int) $invoice->items->where('is_tax_deposit', true)->sum('amount'),
            'faktur' => $invoice->faktur,
            'subject' => $invoice->subject,
            'rollbackable' => $invoice->status === 'sent' && Invoice::isLatestInNumberingPeriod($invoice),
            'custom_templates' => PdfTemplate::query()->orderByDesc('is_default')->orderBy('name')->get()
                ->map(fn (PdfTemplate $t) => ['id' => $t->id, 'name' => $t->name, 'isDefault' => (bool) $t->is_default]),
            'company_template' => CompanyInvoiceTemplate::option(),
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
                'description' => $item->description,
                'quantity' => (float) $item->quantity,
                'unit' => $item->unit,
                'unit_price' => $item->unit_price,
                'foreign_unit_price' => $item->foreign_unit_price !== null ? (float) $item->foreign_unit_price : null,
                'amount' => $item->amount,
                'cogs_amount' => $item->cogs_amount,
                'is_tax_deposit' => $item->is_tax_deposit,
            ]),
            'payments' => $invoice->payments->map(fn ($payment) => [
                'id' => $payment->id,
                'amount' => $payment->amount,
                'foreign_amount' => $payment->foreign_amount !== null ? (float) $payment->foreign_amount : null,
                'exchange_rate' => $payment->exchange_rate !== null ? (float) $payment->exchange_rate : null,
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
     * @return array{clients: Collection<int, array<string, mixed>>, services: Collection<int, array<string, mixed>>, ppn: array{enabled: bool, rate: float}, defaultDueDays: int, documents: array{debitNote: bool, code: bool, codes: Collection<int, array{value: string, type: string}>}}
     */
    private function formOptions(?int $includeClientId = null): array
    {
        $company = CompanyProfile::current();

        return [
            // Jenis dokumen (Debit Note hanya untuk perusahaan bertemplate Debit Note) dan kode jenis
            // (hanya bila format nomor memakai {KODE}); saran kode = kode yang pernah dipakai.
            'documents' => [
                'debitNote' => CompanyInvoiceTemplate::supportsDebitNote(),
                'code' => str_contains(app(InvoiceNumberService::class)->settings()['format'], '{KODE}'),
                'codes' => Invoice::query()
                    ->whereNotNull('document_code')
                    ->selectRaw('document_code, document_type, COUNT(*) as dipakai')
                    ->groupBy('document_code', 'document_type')
                    ->orderByDesc('dipakai')
                    ->orderBy('document_code')
                    ->limit(30)
                    ->get()
                    ->map(fn (Invoice $invoice) => ['value' => $invoice->document_code, 'type' => $invoice->document_type]),
            ],
            // PPN hanya bisa dipilih untuk invoice baru selama perusahaan PKP (Pengaturan › Profil perusahaan).
            'ppn' => [
                'enabled' => (bool) $company?->is_pkp && (float) $company->ppn_rate > 0,
                'rate' => (float) ($company?->ppn_rate ?? 0),
            ],
            // Potongan PPh 23 hanya untuk perusahaan yang menyalakannya di Profil perusahaan.
            'pph' => $this->pphOptions($company),
            // Tagihan USD & harga USD hanya untuk perusahaan yang menyalakannya; kurs terakhir = saran isian.
            'foreignCurrency' => [
                'enabled' => (bool) $company?->foreign_currency_enabled,
                'lastRate' => ($rate = Invoice::query()->whereNotNull('exchange_rate')->latest('id')->value('exchange_rate')) !== null ? (float) $rate : null,
            ],
            // Termin jatuh tempo bawaan; pemegang `manage invoice settings` bisa menggantinya dari form ini.
            'defaultDueDays' => (int) ($company?->default_due_days ?? 14),
            // Perusahaan bertemplate sendiri: editor hanya menawarkan template itu (CompanyInvoiceTemplate).
            'companyTemplate' => CompanyInvoiceTemplate::option(),
            'clients' => Client::where('status', Client::STATUS_ACTIVE)
                ->when($includeClientId, fn ($q) => $q->orWhere('id', $includeClientId))
                ->orderBy('name')
                ->get(['id', 'name', 'email', 'NPWP', 'type'])
                ->map(fn ($c) => ['id' => $c->id, 'name' => $c->name, 'email' => $c->email, 'npwp' => $c->NPWP, 'type' => $c->type]),
            'services' => Service::orderBy('name')
                ->get(['id', 'name', 'price', 'type'])
                ->map(fn ($s) => ['id' => $s->id, 'name' => $s->name, 'price' => $s->price, 'type' => $s->type]),
        ];
    }

    /**
     * Bawaan sakelar PPh 23 editor: `enabled` = perusahaan memakai potongan PPh 23 (sakelar tampil dan
     * invoice baru dipotong), `rate` = tarif bawaan Profil perusahaan, `clients` = keputusan invoice
     * terakhir tiap klien (tarif, atau 0 = tidak dipotong) agar invoice berikutnya mengikutinya.
     *
     * @return array{enabled: bool, rate: float, clients: array<int, float>}
     */
    private function pphOptions(?CompanyProfile $company): array
    {
        $clients = Invoice::query()
            ->whereIn('id', Invoice::query()->whereNotNull('pph_rate')->selectRaw('MAX(id)')->groupBy('billed_to_id'))
            ->pluck('pph_rate', 'billed_to_id')
            ->map(fn ($rate): float => (float) $rate);

        return [
            'enabled' => (bool) $company?->pph_enabled,
            'rate' => (float) ($company?->pph_rate ?? Invoice::DEFAULT_PPH_RATE),
            'clients' => $clients->all(),
        ];
    }

    public function store(StoreInvoiceRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        $publish = $request->boolean('publish');
        // Memilih nomor sendiri setara dengan "Kirim invoice" di drawer, yang butuh `edit invoices`.
        // Tanpa izin itu nomor tetap otomatis, seperti sebelum dialog ini ada.
        $nomor = $request->user()->can('edit invoices') ? ($validated['invoice_number'] ?? null) : null;

        $invoice = DB::transaction(function () use ($validated, $publish, $nomor) {
            ['attributes' => $attributes, 'items' => $items] = $this->buildInvoiceData($validated);

            $invoice = Invoice::create([...$attributes, 'status' => 'draft']);
            $invoice->items()->createMany($items);

            if ($publish) {
                $this->publish($invoice, $nomor);
            }

            return $invoice;
        });

        $pesan = match (true) {
            $publish && $invoice->isDebitNote() => __('Debit Note diterbitkan: :nomor', ['nomor' => $invoice->invoice_number]),
            $publish => __('Invoice diterbitkan: :nomor', ['nomor' => $invoice->invoice_number]),
            $invoice->isDebitNote() => __('Debit Note disimpan sebagai draft.'),
            default => __('Invoice disimpan sebagai draft.'),
        };

        return redirect()->route('invoices.show', $invoice)->with('success', $pesan);
    }

    /**
     * Hitung atribut invoice & baris item dari input editor. Dipakai store, update, dan pratinjau
     * sehingga angka di pratinjau selalu sama dengan yang tersimpan.
     *
     * @param  array<string, mixed>  $validated
     * @return array{attributes: array<string, mixed>, items: list<array<string, mixed>>}
     */
    private function buildInvoiceData(array $validated, ?Invoice $existing = null): array
    {
        ['type' => $documentType, 'code' => $documentCode] = $this->resolveDocument($validated, $existing);
        // Debit Note menagih kembali talangan: semua itemnya titipan (tanpa HPP), jadi tanpa PPN dan
        // bukan pendapatan — Laba Rugi, jurnal, dan statistik membacanya lewat is_tax_deposit.
        $isDebitNote = $documentType === Invoice::TYPE_DEBIT_NOTE;
        // Tagihan USD / harga USD: pembukuan tetap Rupiah (kurs invoice), USD hanya sisi tagihannya.
        $currency = $this->resolveCurrency($validated, $existing);
        $exchangeRate = isset($validated['exchange_rate']) && (float) $validated['exchange_rate'] > 0
            ? round((float) $validated['exchange_rate'], 2)
            : null;
        $subtotal = 0;
        $taxDeposits = 0;
        $items = [];
        $usesForeignPrice = false;

        foreach ($validated['items'] ?? [] as $item) {
            $quantity = (float) ($item['quantity'] ?? 0);
            $foreignUnitPrice = isset($item['foreign_unit_price']) && $item['foreign_unit_price'] !== '' && $exchangeRate
                ? round((float) $item['foreign_unit_price'], 4)
                : null;
            // Harga USD: Rupiah per unit dibulatkan hanya untuk tampilan; jumlah baris dihitung dari harga USD
            // supaya sama persis dengan dokumen asli (Invoice::foreignLineAmount).
            $unitPrice = $foreignUnitPrice !== null ? (int) round($foreignUnitPrice * $exchangeRate) : (int) ($item['unit_price'] ?? 0);
            $amount = $foreignUnitPrice !== null
                ? Invoice::foreignLineAmount($quantity, $foreignUnitPrice, $exchangeRate)
                : (int) round($unitPrice * $quantity);
            $isTaxDeposit = $isDebitNote || (bool) ($item['is_tax_deposit'] ?? false);
            $usesForeignPrice = $usesForeignPrice || $foreignUnitPrice !== null;

            $items[] = [
                'client_id' => $item['client_id'] ?? $validated['client_id'] ?? null,
                'service_name' => $item['service_name'] ?? '',
                'description' => trim((string) ($item['description'] ?? '')) ?: null,
                'quantity' => $quantity,
                'unit' => $item['unit'] ?? 'pcs',
                'unit_price' => $unitPrice,
                'foreign_unit_price' => $foreignUnitPrice,
                'amount' => $amount,
                'cogs_amount' => $isDebitNote ? 0 : (int) ($item['cogs_amount'] ?? 0),
                'is_tax_deposit' => $isTaxDeposit,
            ];

            $subtotal += $amount;
            if ($isTaxDeposit) {
                $taxDeposits += $amount;
            }
        }

        $discountType = $validated['discount_type'] ?? 'fixed';
        $discountValue = (int) ($validated['discount_value'] ?? 0);
        $discountAmount = $discountType === 'percentage'
            ? (int) round($subtotal * $discountValue / 100)
            : $discountValue;

        // PPN dari DPP (layanan − diskon, tanpa titipan pajak), ikut dalam total yang ditagih. PPh 23 yang
        // dipotong klien dari DPP yang sama mengurangi total: total = yang ditransfer klien (GRAND TOTAL).
        $ppnRate = $isDebitNote ? 0.0 : $this->resolvePpnRate($validated, $existing);
        $ppnAmount = Invoice::ppnFor($subtotal - $taxDeposits - $discountAmount, $ppnRate);
        $pphRate = $isDebitNote ? null : $this->resolvePphRate($validated, $existing);
        $pphAmount = Invoice::pphFor($subtotal - $taxDeposits - $discountAmount, $pphRate);
        $total = max(0, max(0, $subtotal - $discountAmount) + $ppnAmount - $pphAmount);
        $isForeign = $currency !== Invoice::CURRENCY_IDR && $exchangeRate !== null;

        return [
            'attributes' => [
                'document_type' => $documentType,
                'document_code' => $documentCode,
                'billed_to_id' => $validated['client_id'] ?? null,
                'subject' => trim((string) ($validated['subject'] ?? '')) ?: null,
                'subtotal' => $subtotal,
                'discount_amount' => $discountAmount,
                'discount_type' => $discountType,
                'discount_value' => $discountValue,
                'discount_reason' => $validated['discount_reason'] ?? null,
                'ppn_rate' => $ppnRate,
                'ppn_amount' => $ppnAmount,
                'pph_rate' => $pphRate,
                'pph_amount' => $pphAmount,
                'total_amount' => $total,
                // Kurs disimpan bila dipakai (tagihan USD atau ada harga USD); utang USD hanya untuk tagihan USD.
                'currency' => $isForeign ? $currency : Invoice::CURRENCY_IDR,
                'exchange_rate' => $isForeign || $usesForeignPrice ? $exchangeRate : null,
                'total_foreign' => $isForeign ? Invoice::foreignTotalFor($total, $exchangeRate) : null,
                'faktur' => match (true) {
                    $isDebitNote => null,
                    array_key_exists('faktur', $validated) => trim((string) $validated['faktur']) ?: null,
                    default => $existing?->faktur,
                },
                'issue_date' => $validated['issue_date'] ?? null,
                'due_date' => $validated['due_date'] ?? null,
            ],
            'items' => $items,
        ];
    }

    /**
     * Jenis & kode dokumen. Keduanya membentuk nomor ({KODE}), jadi setelah terbit tidak berubah lagi:
     * kembalikan ke draft dulu untuk menggantinya. Isian kosong = jenis lama / Invoice.
     *
     * @param  array<string, mixed>  $validated
     * @return array{type: string, code: ?string}
     */
    private function resolveDocument(array $validated, ?Invoice $existing): array
    {
        if ($existing && $existing->status !== 'draft') {
            return ['type' => $existing->document_type, 'code' => $existing->document_code];
        }

        return [
            'type' => $validated['document_type'] ?? $existing?->document_type ?? Invoice::TYPE_INVOICE,
            'code' => array_key_exists('document_code', $validated)
                ? Invoice::normalizeDocumentCode($validated['document_code'])
                : $existing?->document_code,
        ];
    }

    /**
     * Mata uang tagihan. Tagihan yang sudah menerima pembayaran tidak bisa ganti mata uang (pembayarannya
     * tercatat dalam mata uang itu); selain itu ikut isian editor, bawaan mata uang lama / Rupiah.
     *
     * @param  array<string, mixed>  $validated
     */
    private function resolveCurrency(array $validated, ?Invoice $existing): string
    {
        if ($existing && $existing->payments()->exists()) {
            return $existing->currency ?? Invoice::CURRENCY_IDR;
        }

        return $validated['currency'] ?? $existing?->currency ?? Invoice::CURRENCY_IDR;
    }

    /**
     * Tarif PPN invoice (persen). Invoice yang sudah ber-PPN memakai tarif tersimpannya (tidak ikut
     * berubah bila tarif di Pengaturan diganti); invoice baru hanya bisa ber-PPN selama perusahaan
     * PKP. `apply_ppn` kosong = bawaan: invoice baru ikut status PKP, invoice lama tetap seperti apa adanya.
     * Hasil null hanya untuk invoice lama sebelum fitur PPN (tetap "tanpa data PPN" bila tidak diberi PPN).
     */
    private function resolvePpnRate(array $validated, ?Invoice $existing): ?float
    {
        $company = CompanyProfile::current();
        $companyRate = $company?->is_pkp && (float) $company->ppn_rate > 0 ? (float) $company->ppn_rate : null;
        $existingRate = $existing && (float) $existing->ppn_rate > 0 ? (float) $existing->ppn_rate : null;

        $apply = isset($validated['apply_ppn'])
            ? (bool) $validated['apply_ppn']
            : ($existing ? $existingRate !== null : $companyRate !== null);

        if ($apply && ($existingRate ?? $companyRate)) {
            return $existingRate ?? $companyRate;
        }

        return $existing && $existing->ppn_rate === null ? null : 0.0;
    }

    /**
     * Tarif PPh 23 yang dipotong klien (persen). Seperti PPN: hanya bisa dipilih selama perusahaan
     * memakai potongan PPh 23 (Profil perusahaan), kecuali invoice yang sudah dipotong (tarifnya tetap).
     * `apply_pph` kosong = bawaan: invoice baru ikut pengaturan perusahaan, invoice lama tetap seperti
     * apa adanya. Hasil: tarif > 0 = dipotong; 0 = sengaja tidak dipotong (diingat per klien, lihat
     * pphOptions()); null = perusahaan tidak memakai PPh 23 saat invoice disimpan.
     */
    private function resolvePphRate(array $validated, ?Invoice $existing): ?float
    {
        $company = CompanyProfile::current();
        $enabled = (bool) $company?->pph_enabled;
        $existingRate = (float) $existing?->pph_rate > 0 ? (float) $existing->pph_rate : null;

        if (! $enabled && $existingRate === null) {
            return $existing?->pph_rate !== null ? (float) $existing->pph_rate : null;
        }

        $apply = isset($validated['apply_pph'])
            ? (bool) $validated['apply_pph']
            : ($existing ? $existingRate !== null : $enabled);
        $rate = isset($validated['pph_rate']) ? (float) $validated['pph_rate'] : ($existingRate ?? (float) $company?->pph_rate);

        return $apply && $rate > 0 ? round($rate, 2) : 0.0;
    }

    /** Beri nomor berikutnya & ubah draft menjadi terkirim (dipakai "Simpan & terbitkan"). */
    /** Terbitkan draft: nomor dari dialog bila diisi, selain itu nomor berikutnya sesuai format. */
    private function publish(Invoice $invoice, ?string $nomor = null): void
    {
        $invoice->update([
            'invoice_number' => filled($nomor) ? $nomor : Invoice::generateInvoiceNumber($invoice->issue_date, $invoice->billed_to_id, $invoice->document_type, $invoice->document_code),
            'status' => 'sent',
        ]);
    }

    /**
     * Nomor berikutnya untuk klien & tanggal yang sedang diisi di editor, untuk mengisi dialog
     * "Simpan & terbitkan". Sama dengan nomor yang diberikan bila dialog dikonfirmasi tanpa diubah.
     */
    public function nextNumber(NextInvoiceNumberRequest $request): JsonResponse
    {
        return response()->json([
            'number' => Invoice::generateInvoiceNumber(
                Carbon::parse($request->validated('issue_date')),
                (int) $request->validated('client_id'),
                $request->validated('document_type'),
                Invoice::normalizeDocumentCode($request->validated('document_code')),
            ),
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
        $existing = isset($validated['invoice_id']) ? Invoice::find($validated['invoice_id']) : null;
        ['attributes' => $attributes, 'items' => $items] = $this->buildInvoiceData($validated, $existing);

        $clients = Client::whereIn('id', array_filter([$attributes['billed_to_id'], ...array_column($items, 'client_id')]))
            ->get()
            ->keyBy('id');
        $billedTo = $clients->get($attributes['billed_to_id']) ?? new Client(['name' => '—']);

        $number = $existing?->invoice_number;
        if (! $number && $attributes['billed_to_id'] && $attributes['issue_date']) {
            $number = Invoice::generateInvoiceNumber(Carbon::parse($attributes['issue_date']), $attributes['billed_to_id'], $attributes['document_type'], $attributes['document_code']);
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
            $validated['template'] ?? CompanyInvoiceTemplate::defaultTemplate(),
            isset($validated['highlight']) ? (int) $validated['highlight'] : null,
        );

        return response($pdf->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.($invoice->isDebitNote() ? 'pratinjau-debit-note.pdf' : 'pratinjau-invoice.pdf').'"',
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
                'document_type' => $invoice->document_type,
                'document_code' => $invoice->document_code,
                'client_id' => $invoice->billed_to_id,
                'issue_date' => $invoice->issue_date?->format('Y-m-d'),
                'due_date' => $invoice->due_date?->format('Y-m-d'),
                'discount_type' => $invoice->discount_type ?? 'fixed',
                'discount_value' => $invoice->discount_value ?? 0,
                'discount_reason' => $invoice->discount_reason,
                'ppn_rate' => (float) $invoice->ppn_rate > 0 ? (float) $invoice->ppn_rate : null,
                'pph_rate' => (float) $invoice->pph_rate > 0 ? (float) $invoice->pph_rate : null,
                'faktur' => $invoice->faktur,
                'subject' => $invoice->subject,
                'currency' => $invoice->currency ?? Invoice::CURRENCY_IDR,
                'exchange_rate' => $invoice->exchange_rate !== null ? (float) $invoice->exchange_rate : null,
                // Sudah ada pembayaran: mata uang terkunci (InvoiceController::resolveCurrency).
                'has_payments' => $invoice->payments()->exists(),
                'items' => $invoice->items->map(fn ($item) => [
                    'client_id' => $item->client_id,
                    'service_name' => $item->service_name,
                    'description' => $item->description,
                    'quantity' => (float) $item->quantity,
                    'unit' => $item->unit,
                    'unit_price' => $item->unit_price,
                    'foreign_unit_price' => $item->foreign_unit_price !== null ? (float) $item->foreign_unit_price : null,
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
            ['attributes' => $attributes, 'items' => $items] = $this->buildInvoiceData($validated, $invoice);

            $invoice->update($attributes);
            $invoice->items()->delete();
            $invoice->items()->createMany($items);

            if ($publish) {
                $this->publish($invoice, $validated['invoice_number'] ?? null);
            }
        });

        // Total berubah → status harus dihitung ulang. Tanpa ini invoice yang sudah
        // "paid" lalu totalnya dinaikkan tetap berstatus lunas padahal masih ada sisa,
        // dan justru terkunci: pembayaran lanjutan ditolak 422 karena statusnya paid.
        // Hanya untuk invoice yang sudah pernah dibayar — draft/sent tanpa pembayaran
        // tidak boleh ikut berubah statusnya.
        if ($invoice->fresh()->payments()->exists()) {
            $invoice->fresh()->updateStatus();
        }

        $pesan = match (true) {
            $publish && $invoice->isDebitNote() => __('Debit Note diterbitkan: :nomor', ['nomor' => $invoice->invoice_number]),
            $publish => __('Invoice diterbitkan: :nomor', ['nomor' => $invoice->invoice_number]),
            $invoice->isDebitNote() => __('Debit Note berhasil diperbarui.'),
            default => __('Invoice berhasil diperbarui.'),
        };

        return redirect()->route('invoices.show', $invoice)->with('success', $pesan);
    }

    public function destroy(Request $request, Invoice $invoice): JsonResponse|RedirectResponse
    {
        if ($invoice->payments()->exists()) {
            return $this->actionResult($request, false, __('Invoice yang sudah memiliki pembayaran tidak dapat dihapus. Hapus pembayarannya terlebih dahulu.'));
        }

        DB::transaction(function () use ($invoice) {
            $invoice->items()->delete();
            $invoice->delete();
        });

        return $this->actionResult($request, true, __('Invoice berhasil dihapus.'));
    }

    public function send(SendInvoiceRequest $request, Invoice $invoice): JsonResponse|RedirectResponse
    {
        if ($invoice->status !== 'draft') {
            return $this->actionResult($request, false, __('Hanya invoice draft yang dapat diterbitkan.'));
        }

        $invoice->update([
            'invoice_number' => $request->invoice_number,
            'status' => 'sent',
        ]);

        return $this->actionResult($request, true, $invoice->isDebitNote()
            ? __('Debit Note diterbitkan: :nomor', ['nomor' => $request->invoice_number])
            : __('Invoice diterbitkan: :nomor', ['nomor' => $request->invoice_number]));
    }

    public function rollback(Request $request, Invoice $invoice): JsonResponse|RedirectResponse
    {
        if ($invoice->status !== 'sent') {
            return $this->actionResult($request, false, __('Hanya invoice yang sudah terbit yang bisa dikembalikan ke draft.'));
        }

        if (! Invoice::isLatestInNumberingPeriod($invoice)) {
            return $this->actionResult($request, false, __('Hanya invoice dengan nomor urut terakhir di periodenya yang bisa dikembalikan ke draft.'));
        }

        $invoice->update(['invoice_number' => null, 'status' => 'draft']);

        return $this->actionResult($request, true, __('Invoice berhasil dikembalikan ke draft.'));
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
