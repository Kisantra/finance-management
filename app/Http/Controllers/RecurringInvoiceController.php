<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreMonthlyRequest;
use App\Http\Requests\StoreTemplateRequest;
use App\Http\Requests\UpdateMonthlyRequest;
use App\Http\Requests\UpdateTemplateRequest;
use App\Models\Client;
use App\Models\RecurringInvoice;
use App\Models\RecurringTemplate;
use App\Models\Service;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class RecurringInvoiceController extends Controller
{
    public function index(Request $request): Response
    {
        $month = (int) $request->input('month', now()->month);
        $year = (int) $request->input('year', now()->year);
        $templateFilter = $request->input('template_id');
        $statusFilter = $request->input('status', 'all');
        $analyticsYear = (int) $request->input('analytics_year', now()->year);
        $analyticsPeriod = $request->input('analytics_period', 'monthly');
        $tab = $request->input('tab', 'templates');

        // ── Templates ────────────────────────────────────────────────────────
        $templates = RecurringTemplate::with(['client:id,name,type', 'recurringInvoices'])
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(fn ($t) => $this->formatTemplate($t));

        // ── Monthly invoices ──────────────────────────────────────────────────
        $monthlyQuery = RecurringInvoice::with(['client:id,name,type', 'template:id,template_name,frequency', 'publishedInvoice:id,invoice_number'])
            ->whereYear('scheduled_date', $year)
            ->whereMonth('scheduled_date', $month);

        if ($templateFilter) {
            $monthlyQuery->where('template_id', $templateFilter);
        }
        if ($statusFilter !== 'all') {
            $monthlyQuery->where('status', $statusFilter);
        }

        $monthlyInvoices = $monthlyQuery->orderBy('scheduled_date', 'desc')->get()
            ->map(fn ($inv) => $this->formatMonthlyInvoice($inv));

        // Monthly stats
        $allMonthly = RecurringInvoice::whereYear('scheduled_date', $year)
            ->whereMonth('scheduled_date', $month)
            ->get(['id', 'status', 'invoice_data']);

        $monthlyStats = $this->computeMonthlyStats($allMonthly);

        // ── Analytics ─────────────────────────────────────────────────────────
        $analytics = $this->buildAnalytics($analyticsYear, $analyticsPeriod);

        // ── Form data ─────────────────────────────────────────────────────────
        $clients = Client::where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'name', 'type', 'email'])
            ->map(fn ($c) => [
                'id' => $c->id,
                'name' => $c->name,
                'display_name' => $c->name,
                'email' => $c->email,
            ]);

        $services = Service::orderBy('name')
            ->get(['id', 'name', 'price', 'type'])
            ->map(fn ($s) => [
                'id' => $s->id,
                'name' => $s->name,
                'price' => $s->price,
                'type' => $s->type,
            ]);

        $activeTemplatesForSelect = RecurringTemplate::where('status', 'active')
            ->with('client:id,name,type')
            ->orderBy('template_name')
            ->get()
            ->map(fn ($t) => [
                'id' => $t->id,
                'label' => $t->client->name.' — '.$t->template_name,
                'frequency' => $t->frequency,
                'invoice_template' => $t->invoice_template,
            ]);

        return Inertia::render('recurring-invoices/index', [
            'tab' => $tab,
            'templates' => $templates,
            'monthly' => [
                'invoices' => $monthlyInvoices,
                'stats' => $monthlyStats,
                'month' => $month,
                'year' => $year,
                'template_filter' => $templateFilter ? (int) $templateFilter : null,
                'status_filter' => $statusFilter,
            ],
            'analytics' => $analytics,
            'analytics_year' => $analyticsYear,
            'analytics_period' => $analyticsPeriod,
            'clients' => $clients,
            'services' => $services,
            'active_templates' => $activeTemplatesForSelect,
        ]);
    }

    // ── Template Pages ────────────────────────────────────────────────────────

    public function createTemplate(): Response
    {
        return Inertia::render('recurring-invoices/create-template', [
            'clients' => $this->getClientOptions(),
            'services' => $this->getServiceOptions(),
        ]);
    }

    public function editTemplate(RecurringTemplate $template): Response
    {
        return Inertia::render('recurring-invoices/edit-template', [
            'template' => $this->formatTemplate($template->load('client', 'recurringInvoices')),
            'clients' => $this->getClientOptions(),
            'services' => $this->getServiceOptions(),
        ]);
    }

    // ── Template CRUD ─────────────────────────────────────────────────────────

    public function storeTemplate(StoreTemplateRequest $request)
    {
        $data = $request->validated();

        try {
            DB::beginTransaction();

            [$invoiceTemplate] = $this->buildInvoiceData($data);

            $template = RecurringTemplate::create([
                'client_id' => $data['client_id'],
                'template_name' => $data['template_name'],
                'start_date' => $data['start_date'],
                'end_date' => $data['end_date'],
                'frequency' => $data['frequency'],
                'status' => 'active',
                'invoice_template' => $invoiceTemplate,
            ]);

            DB::commit();

            if ($request->hasHeader('X-Inertia')) {
                return redirect()->route('recurring-invoices.index')
                    ->with('success', "Template '{$template->template_name}' berhasil dibuat.");
            }

            return response()->json([
                'template' => $this->formatTemplate($template->load('client', 'recurringInvoices')),
                'message' => "Template '{$template->template_name}' berhasil dibuat.",
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Failed to create recurring template: '.$e->getMessage());

            if ($request->hasHeader('X-Inertia')) {
                return back()->withErrors(['general' => 'Gagal membuat template: '.$e->getMessage()]);
            }

            return response()->json(['message' => 'Gagal membuat template: '.$e->getMessage()], 500);
        }
    }

    public function updateTemplate(UpdateTemplateRequest $request, RecurringTemplate $template)
    {
        $data = $request->validated();

        try {
            DB::beginTransaction();

            [$invoiceTemplate] = $this->buildInvoiceData($data);

            $template->update([
                'client_id' => $data['client_id'],
                'template_name' => $data['template_name'],
                'start_date' => $data['start_date'],
                'end_date' => $data['end_date'],
                'frequency' => $data['frequency'],
                'invoice_template' => $invoiceTemplate,
            ]);

            DB::commit();

            if ($request->hasHeader('X-Inertia')) {
                return redirect()->route('recurring-invoices.index')
                    ->with('success', "Template '{$template->template_name}' berhasil diperbarui.");
            }

            return response()->json([
                'template' => $this->formatTemplate($template->fresh(['client', 'recurringInvoices'])),
                'message' => "Template '{$template->template_name}' berhasil diperbarui.",
            ]);
        } catch (\Exception $e) {
            DB::rollBack();

            if ($request->hasHeader('X-Inertia')) {
                return back()->withErrors(['general' => 'Gagal memperbarui template: '.$e->getMessage()]);
            }

            return response()->json(['message' => 'Gagal memperbarui template: '.$e->getMessage()], 500);
        }
    }

    public function destroyTemplate(RecurringTemplate $template): JsonResponse
    {
        $hasPublished = $template->recurringInvoices()->where('status', 'published')->exists();

        if ($hasPublished) {
            $template->update(['status' => 'archived']);
            $message = 'Template diarsipkan (memiliki invoice terpublish).';
        } else {
            $template->recurringInvoices()->delete();
            $template->delete();
            $message = 'Template berhasil dihapus.';
        }

        return response()->json(['message' => $message, 'archived' => $hasPublished]);
    }

    public function restoreTemplate(RecurringTemplate $template): JsonResponse
    {
        $template->update(['status' => 'active']);

        return response()->json([
            'template' => $this->formatTemplate($template->fresh(['client', 'recurringInvoices'])),
            'message' => "Template '{$template->template_name}' berhasil diaktifkan kembali.",
        ]);
    }

    // ── Monthly invoice endpoints ─────────────────────────────────────────────

    public function generateMonthly(Request $request): JsonResponse
    {
        $data = $request->validate([
            'month' => 'required|integer|min:1|max:12',
            'year' => 'required|integer|min:2000|max:2100',
            'issue_date' => 'required|date',
            'due_date' => 'required|date|after_or_equal:issue_date',
        ]);

        $scheduledDate = Carbon::create($data['year'], $data['month'], 1);

        $templates = RecurringTemplate::where('status', 'active')
            ->where('start_date', '<', $scheduledDate)
            ->where('end_date', '>=', $scheduledDate)
            ->get();

        $generated = 0;
        foreach ($templates as $template) {
            $alreadyExists = RecurringInvoice::where('template_id', $template->id)
                ->whereYear('scheduled_date', $data['year'])
                ->whereMonth('scheduled_date', $data['month'])
                ->exists();

            if ($alreadyExists) {
                continue;
            }

            if (! $template->isValidPeriodForGeneration($data['year'], $data['month'])) {
                continue;
            }

            RecurringInvoice::create([
                'template_id' => $template->id,
                'client_id' => $template->client_id,
                'scheduled_date' => $scheduledDate,
                'issue_date' => $data['issue_date'],
                'due_date' => $data['due_date'],
                'invoice_data' => $template->invoice_template,
                'status' => 'draft',
            ]);
            $generated++;
        }

        return response()->json([
            'generated' => $generated,
            'message' => $generated > 0
                ? "{$generated} invoice berhasil digenerate."
                : 'Tidak ada invoice yang perlu digenerate untuk bulan ini.',
        ]);
    }

    public function storeMonthly(StoreMonthlyRequest $request): JsonResponse
    {
        $data = $request->validated();

        $scheduledDate = Carbon::parse($data['scheduled_date']);

        $exists = RecurringInvoice::where('template_id', $data['template_id'])
            ->whereYear('scheduled_date', $scheduledDate->year)
            ->whereMonth('scheduled_date', $scheduledDate->month)
            ->exists();

        if ($exists) {
            return response()->json([
                'message' => 'Invoice untuk template dan bulan ini sudah ada.',
            ], 422);
        }

        try {
            DB::beginTransaction();

            $template = RecurringTemplate::find($data['template_id']);
            [$invoiceData] = $this->buildInvoiceData($data);

            $invoice = RecurringInvoice::create([
                'template_id' => $data['template_id'],
                'client_id' => $template->client_id,
                'scheduled_date' => $scheduledDate,
                'issue_date' => $data['issue_date'] ?? null,
                'due_date' => $data['due_date'] ?? null,
                'invoice_data' => $invoiceData,
                'status' => 'draft',
            ]);

            DB::commit();

            return response()->json([
                'invoice' => $this->formatMonthlyInvoice($invoice->load('client', 'template', 'publishedInvoice')),
                'message' => 'Invoice berhasil dibuat.',
            ]);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json(['message' => 'Gagal membuat invoice.'], 500);
        }
    }

    public function updateMonthly(UpdateMonthlyRequest $request, RecurringInvoice $invoice): JsonResponse
    {
        if ($invoice->status === 'published') {
            return response()->json(['message' => 'Invoice yang sudah dipublish tidak dapat diubah.'], 422);
        }

        $data = $request->validated();

        try {
            DB::beginTransaction();

            [$invoiceData] = $this->buildInvoiceData($data);

            $invoice->update([
                'scheduled_date' => Carbon::parse($data['scheduled_date']),
                'issue_date' => $data['issue_date'] ?? null,
                'due_date' => $data['due_date'] ?? null,
                'invoice_data' => $invoiceData,
            ]);

            DB::commit();

            return response()->json([
                'invoice' => $this->formatMonthlyInvoice($invoice->fresh(['client', 'template', 'publishedInvoice'])),
                'message' => 'Invoice berhasil diperbarui.',
            ]);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json(['message' => 'Gagal memperbarui invoice.'], 500);
        }
    }

    public function destroyMonthly(RecurringInvoice $invoice): JsonResponse
    {
        if ($invoice->status === 'published') {
            return response()->json(['message' => 'Invoice yang sudah dipublish tidak dapat dihapus.'], 422);
        }

        $invoice->delete();

        return response()->json(['message' => 'Invoice berhasil dihapus.']);
    }

    public function publishMonthly(Request $request, RecurringInvoice $invoice): JsonResponse
    {
        if ($invoice->status === 'published') {
            return response()->json(['message' => 'Invoice sudah dipublish.'], 422);
        }

        $data = $request->validate([
            'issue_date' => 'required|date',
            'due_date' => 'required|date|after_or_equal:issue_date',
        ]);

        try {
            $invoice->update([
                'issue_date' => $data['issue_date'],
                'due_date' => $data['due_date'],
            ]);

            $published = $invoice->publish();

            return response()->json([
                'invoice' => $this->formatMonthlyInvoice($invoice->fresh(['client', 'template', 'publishedInvoice'])),
                'invoice_id' => $published->id,
                'message' => 'Invoice draft dibuat. Kirim invoice untuk mendapat nomor resmi.',
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal mempublish invoice: '.$e->getMessage()], 500);
        }
    }

    public function bulkDestroyMonthly(Request $request): JsonResponse
    {
        $data = $request->validate(['ids' => 'required|array|min:1', 'ids.*' => 'integer']);

        $deleted = RecurringInvoice::whereIn('id', $data['ids'])
            ->where('status', 'draft')
            ->delete();

        return response()->json([
            'deleted' => $deleted,
            'message' => "{$deleted} invoice berhasil dihapus.",
        ]);
    }

    public function bulkPublishMonthly(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer',
            'issue_date' => 'required|date',
            'due_date' => 'required|date|after_or_equal:issue_date',
        ]);

        $invoices = RecurringInvoice::whereIn('id', $data['ids'])
            ->where('status', 'draft')
            ->get();

        $published = 0;
        foreach ($invoices as $invoice) {
            try {
                $invoice->update([
                    'issue_date' => $data['issue_date'],
                    'due_date' => $data['due_date'],
                ]);
                $invoice->publish();
                $published++;
            } catch (\Exception $e) {
                \Log::error("Failed to bulk publish recurring invoice {$invoice->id}: ".$e->getMessage());
            }
        }

        return response()->json([
            'published' => $published,
            'message' => "{$published} invoice berhasil dipublish.",
        ]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function getClientOptions(): Collection
    {
        return Client::where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'name', 'type', 'email'])
            ->map(fn ($c) => [
                'id' => $c->id,
                'name' => $c->name,
                'display_name' => $c->name,
                'email' => $c->email,
            ]);
    }

    private function getServiceOptions(): Collection
    {
        return Service::orderBy('name')
            ->get(['id', 'name', 'price', 'type'])
            ->map(fn ($s) => [
                'id' => $s->id,
                'name' => $s->name,
                'price' => $s->price,
                'type' => $s->type,
            ]);
    }

    // ── Formatters ────────────────────────────────────────────────────────────

    private function formatTemplate(RecurringTemplate $template): array
    {
        $invoices = $template->recurringInvoices ?? collect();
        $totalCount = $template->getTotalInvoicesCount();
        $generatedCount = $invoices->count();
        $publishedCount = $invoices->where('status', 'published')->count();

        return [
            'id' => $template->id,
            'template_name' => $template->template_name,
            'client_id' => $template->client_id,
            'client_name' => $template->client->name ?? '—',
            'start_date' => $template->start_date?->format('Y-m-d'),
            'end_date' => $template->end_date?->format('Y-m-d'),
            'frequency' => $template->frequency,
            'status' => $template->status,
            'total_amount' => $template->total_amount,
            'invoice_template' => $template->invoice_template,
            'total_invoices_count' => $totalCount,
            'generated_count' => $generatedCount,
            'published_count' => $publishedCount,
            'remaining_count' => max(0, $totalCount - $generatedCount),
            'progress_pct' => $totalCount > 0 ? round(($generatedCount / $totalCount) * 100) : 0,
        ];
    }

    private function formatMonthlyInvoice(RecurringInvoice $invoice): array
    {
        return [
            'id' => $invoice->id,
            'template_id' => $invoice->template_id,
            'template_name' => $invoice->template->template_name ?? '—',
            'frequency' => $invoice->template->frequency ?? null,
            'client_id' => $invoice->client_id,
            'client_name' => $invoice->client->name ?? '—',
            'scheduled_date' => $invoice->scheduled_date?->format('Y-m-d'),
            'issue_date' => $invoice->issue_date?->format('Y-m-d'),
            'due_date' => $invoice->due_date?->format('Y-m-d'),
            'status' => $invoice->status,
            'total_amount' => $invoice->total_amount,
            'invoice_data' => $invoice->invoice_data,
            'published_invoice_id' => $invoice->published_invoice_id,
            'published_invoice_number' => $invoice->publishedInvoice?->invoice_number,
        ];
    }

    private function buildAnalytics(int $year, string $period): array
    {
        $previousYear = $year - 1;

        // Current & previous year invoices (2 queries)
        $currentInvoices = RecurringInvoice::whereYear('scheduled_date', $year)
            ->get(['id', 'scheduled_date', 'invoice_data', 'status']);

        $previousInvoices = RecurringInvoice::whereYear('scheduled_date', $previousYear)
            ->get(['id', 'invoice_data']);

        $currentTotal = $currentInvoices->sum(fn ($inv) => $inv->invoice_data['total_amount'] ?? 0);
        $previousTotal = $previousInvoices->sum(fn ($inv) => $inv->invoice_data['total_amount'] ?? 0);
        $growthRate = $previousTotal > 0 ? (($currentTotal - $previousTotal) / $previousTotal) * 100 : 0;
        $currentMonthRevenue = $currentInvoices->filter(fn ($inv) => $inv->scheduled_date->month === now()->month)
            ->sum(fn ($inv) => $inv->invoice_data['total_amount'] ?? 0);

        // Revenue chart
        $byMonth = $currentInvoices->groupBy(fn ($inv) => (int) $inv->scheduled_date->format('n'));

        if ($period === 'monthly') {
            $chartData = collect(range(1, 12))->map(function ($m) use ($year, $byMonth) {
                $revenue = ($byMonth[$m] ?? collect())->sum(fn ($inv) => $inv->invoice_data['total_amount'] ?? 0);

                return ['label' => Carbon::create($year, $m)->format('M'), 'revenue' => $revenue];
            })->values()->toArray();
        } else {
            $chartData = collect(range(1, 4))->map(function ($q) use ($byMonth) {
                $start = ($q - 1) * 3 + 1;
                $revenue = collect(range($start, $start + 2))
                    ->sum(fn ($m) => ($byMonth[$m] ?? collect())->sum(fn ($inv) => $inv->invoice_data['total_amount'] ?? 0));

                return ['label' => "Q{$q}", 'revenue' => $revenue];
            })->values()->toArray();
        }

        // Template performance (single query)
        $templateStats = RecurringTemplate::with([
            'recurringInvoices' => fn ($q) => $q->whereYear('scheduled_date', $year)->select(['id', 'template_id', 'status', 'invoice_data']),
            'client:id,name',
        ])->get(['id', 'template_name', 'client_id'])
            ->map(function ($t) {
                $invs = $t->recurringInvoices;
                $total = $invs->count();
                $published = $invs->where('status', 'published')->count();
                $revenue = $invs->sum(fn ($inv) => $inv->invoice_data['total_amount'] ?? 0);
                $profit = $invs->sum(function ($inv) {
                    return collect($inv->invoice_data['items'] ?? [])
                        ->sum(fn ($item) => ($item['amount'] ?? 0) - ($item['cogs_amount'] ?? 0));
                });

                return [
                    'name' => $t->template_name,
                    'client' => $t->client->name,
                    'revenue' => $revenue,
                    'count' => $total,
                    'published' => $published,
                    'success_rate' => $total > 0 ? round(($published / $total) * 100, 1) : 0,
                    'profit_margin' => $revenue > 0 ? round(($profit / $revenue) * 100, 1) : 0,
                ];
            })
            ->sortByDesc('revenue')
            ->values()
            ->toArray();

        // Status breakdown
        $draft = $currentInvoices->where('status', 'draft');
        $published = $currentInvoices->where('status', 'published');
        $total = $currentInvoices->count();

        return [
            'metrics' => [
                'current_year' => $currentTotal,
                'previous_year' => $previousTotal,
                'growth_rate' => round($growthRate, 1),
                'current_month' => $currentMonthRevenue,
                'average_monthly' => $currentTotal > 0 ? round($currentTotal / 12) : 0,
            ],
            'chart' => $chartData,
            'template_stats' => $templateStats,
            'status_breakdown' => [
                'draft' => [
                    'count' => $draft->count(),
                    'revenue' => $draft->sum(fn ($inv) => $inv->invoice_data['total_amount'] ?? 0),
                    'percentage' => $total > 0 ? round(($draft->count() / $total) * 100, 1) : 0,
                ],
                'published' => [
                    'count' => $published->count(),
                    'revenue' => $published->sum(fn ($inv) => $inv->invoice_data['total_amount'] ?? 0),
                    'percentage' => $total > 0 ? round(($published->count() / $total) * 100, 1) : 0,
                ],
                'total' => ['count' => $total],
            ],
        ];
    }

    private function computeMonthlyStats(Collection $invoices): array
    {
        $totalRevenue = $invoices->sum(fn ($inv) => $inv->invoice_data['total_amount'] ?? 0);
        $totalCogs = $invoices->sum(fn ($inv) => collect($inv->invoice_data['items'] ?? [])->sum('cogs_amount'));
        $totalProfit = $totalRevenue - $totalCogs;
        $profitMargin = $totalRevenue > 0 ? ($totalProfit / $totalRevenue) * 100 : 0;

        $draftInvoices = $invoices->where('status', 'draft');
        $draftRevenue = $draftInvoices->sum(fn ($inv) => $inv->invoice_data['total_amount'] ?? 0);
        $draftCogs = $draftInvoices->sum(fn ($inv) => collect($inv->invoice_data['items'] ?? [])->sum('cogs_amount'));
        $outstandingProfit = $draftRevenue - $draftCogs;

        return [
            'total_revenue' => $totalRevenue,
            'total_cogs' => $totalCogs,
            'total_profit' => $totalProfit,
            'profit_margin' => round($profitMargin, 1),
            'outstanding_profit' => $outstandingProfit,
            'paid_profit' => $totalProfit - $outstandingProfit,
        ];
    }

    private function buildInvoiceData(array $data): array
    {
        $parsedItems = [];
        $subtotal = 0;

        foreach ($data['items'] as $item) {
            $unitPrice = (int) ($item['unit_price'] ?? 0);
            $quantity = (int) ($item['quantity'] ?? 1);
            $amount = $unitPrice * $quantity;
            $cogsAmount = (int) ($item['cogs_amount'] ?? 0);
            $isTaxDeposit = (bool) ($item['is_tax_deposit'] ?? false);

            $parsedItems[] = [
                'client_id' => $item['client_id'],
                'service_name' => $item['service_name'],
                'quantity' => $quantity,
                'unit' => $item['unit'] ?? 'pcs',
                'unit_price' => $unitPrice,
                'amount' => $amount,
                'cogs_amount' => $cogsAmount,
                'is_tax_deposit' => $isTaxDeposit,
            ];

            if (! $isTaxDeposit) {
                $subtotal += $amount;
            }
        }

        $discountType = $data['discount_type'] ?? 'fixed';
        $discountValue = (float) ($data['discount_value'] ?? 0);
        $discountAmount = $discountType === 'fixed'
            ? (int) $discountValue
            : (int) round(($subtotal * $discountValue) / 100);

        $totalAmount = max(0, $subtotal - $discountAmount);

        $invoiceData = [
            'items' => $parsedItems,
            'subtotal' => $subtotal,
            'discount_type' => $discountType,
            'discount_value' => $discountValue,
            'discount_amount' => $discountAmount,
            'discount_reason' => $data['discount_reason'] ?? '',
            'total_amount' => $totalAmount,
        ];

        return [$invoiceData, $subtotal];
    }
}
