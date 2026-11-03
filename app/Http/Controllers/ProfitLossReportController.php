<?php

namespace App\Http\Controllers;

use App\Models\CompanyProfile;
use App\Models\TransactionCategory;
use App\Services\ProfitLossService;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Inertia\Inertia;
use Inertia\Response;

class ProfitLossReportController extends Controller
{
    public function index(Request $request, ProfitLossService $service): Response
    {
        [$start, $end] = $this->resolvePeriod($request);
        $report = $service->generate($start, $end);
        $company = CompanyProfile::first();

        // Augment unclassified items with category type so the front-end side
        // panel knows which pl_group options to offer (income → revenue/other_income,
        // expense → cogs/opex/other_expense/tax).
        $unclassifiedTypes = $this->buildUnclassifiedTypeMap($report);

        return Inertia::render('reports/profit-loss/index', [
            'report' => $report,
            'unclassifiedTypes' => $unclassifiedTypes,
            'filters' => [
                'start_date' => $start->toDateString(),
                'end_date' => $end->toDateString(),
            ],
            // Dinamai companyProfile, BUKAN company. Prop bersama bernama
            // `company` dikirim HandleInertiaRequests dan berisi identitas
            // tenant ({slug, name, abbreviation}); prop halaman dengan nama
            // yang sama MENIMPANYA. Akibatnya activeCompanySlug jadi null,
            // lalu companyUrl() dan jaring pengaman installCompanyUrlPrefix()
            // mati bersamaan — setiap tautan dan form di halaman ini kehilangan
            // prefiks /c/{slug} dan menjawab 404/405. Ditemukan QC 2026-11-03.
            'companyProfile' => $company ? [
                'name' => $company->name,
                'address' => $company->address,
                'npwp' => $company->npwp,
            ] : null,
        ]);
    }

    public function downloadPdf(Request $request, ProfitLossService $service): HttpResponse
    {
        [$start, $end] = $this->resolvePeriod($request);
        $report = $service->generate($start, $end);
        $company = CompanyProfile::first();

        $pdf = Pdf::loadView('pdf.profit-loss', [
            'report' => $report,
            'company' => $company,
            'start' => $start,
            'end' => $end,
        ])->setPaper('a4', 'portrait');

        $filename = sprintf('laporan-laba-rugi-%s-%s.pdf', $start->toDateString(), $end->toDateString());

        return $pdf->download($filename);
    }

    private function resolvePeriod(Request $request): array
    {
        $validated = $request->validate([
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
        ]);

        $start = isset($validated['start_date'])
            ? Carbon::parse($validated['start_date'])->startOfDay()
            : Carbon::now()->startOfYear();

        $end = isset($validated['end_date'])
            ? Carbon::parse($validated['end_date'])->endOfDay()
            : Carbon::now()->endOfDay();

        return [$start, $end];
    }

    /**
     * Returns ['{id}' => 'income'|'expense'] for every unclassified-with-category
     * row in the report, so the side panel knows which pl_group options to offer.
     *
     * @return array<string, string>
     */
    private function buildUnclassifiedTypeMap(array $report): array
    {
        $ids = collect($report['unclassified']['income']['by_category'])
            ->merge($report['unclassified']['expense']['by_category'])
            ->pluck('category_id')
            ->filter()
            ->unique()
            ->all();

        if (empty($ids)) {
            return [];
        }

        return TransactionCategory::query()
            ->whereIn('id', $ids)
            ->pluck('type', 'id')
            ->all();
    }
}
