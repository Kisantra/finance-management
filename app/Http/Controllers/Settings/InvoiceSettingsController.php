<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\UpdateDefaultDueDaysRequest;
use App\Http\Requests\Settings\UpdateInvoiceSettingsRequest;
use App\Models\Client;
use App\Models\CompanyProfile;
use App\Models\Invoice;
use App\Services\InvoiceNumberService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class InvoiceSettingsController extends Controller
{
    public function edit(InvoiceNumberService $numbers): Response
    {
        $today = today();
        $client = Client::query()->latest('id')->first();
        $profil = CompanyProfile::current();
        $tinjau = $profil?->needsInvoiceReview() ? $numbers->backfillSequences(false) : null;

        return Inertia::render('settings/invoice-numbering', [
            // Nomor lama tanpa urutan (hasil konversi): pratinjau kering dengan pola yang sedang berlaku.
            'legacyReview' => $tinjau ? [
                'fillable' => $tinjau['filled'],
                'samples' => $tinjau['samples'],
                'unmatched' => array_slice($tinjau['unmatched'], 0, 20),
                'unmatchedCount' => count($tinjau['unmatched']),
            ] : null,
            'settings' => $numbers->settings(),
            'defaults' => [
                'format' => InvoiceNumberService::DEFAULT_FORMAT,
                'padding' => InvoiceNumberService::DEFAULT_PADDING,
                'reset' => InvoiceNumberService::DEFAULT_RESET,
            ],
            'tokens' => collect(InvoiceNumberService::keteranganToken())
                ->map(fn (string $label, string $token) => ['token' => $token, 'label' => $label])
                ->values(),
            'paddings' => InvoiceNumberService::PADDINGS,
            'hasCompany' => CompanyProfile::current() !== null,
            // Bahan pratinjau: nilai nyata hari ini, dihitung server agar sama dengan nomor yang akan terbit.
            'sample' => [
                'date' => $today->toDateString(),
                'company_initials' => $numbers->companyInitials(),
                'client_name' => $client ? ($client->type === 'company' && $client->company_name ? $client->company_name : $client->name) : __('PT Contoh Klien'),
                'client_initials' => $client ? $numbers->clientInitials($client->id) : 'CK',
                'next_sequence' => collect(InvoiceNumberService::RESETS)
                    ->mapWithKeys(fn (string $reset) => [$reset => $numbers->nextSequence($today, $reset)]),
            ],
            'recent' => Invoice::query()
                ->whereNotNull('invoice_number')
                ->latest('issue_date')
                ->latest('id')
                ->limit(4)
                ->get(['id', 'invoice_number', 'issue_date'])
                ->map(fn (Invoice $invoice) => [
                    'id' => $invoice->id,
                    'number' => $invoice->invoice_number,
                    'issue_date' => $invoice->issue_date->format('Y-m-d'),
                ]),
        ]);
    }

    public function update(UpdateInvoiceSettingsRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        CompanyProfile::current()->update([
            'invoice_number_format' => trim($validated['format']),
            'invoice_number_padding' => (int) $validated['padding'],
            'invoice_number_reset' => $validated['reset'],
        ]);

        return redirect()->back()->with('success', __('Format penomoran invoice disimpan. Berlaku untuk invoice yang diterbitkan setelah ini.'));
    }

    /**
     * Termin jatuh tempo bawaan, disetel langsung dari form invoice baru (tombol "Jadikan bawaan")
     * agar tidak perlu membuka halaman lain. Dipakai invoice baru dan invoice berulang.
     */
    public function updateDueDays(UpdateDefaultDueDaysRequest $request): RedirectResponse
    {
        $hari = $request->integer('days');

        CompanyProfile::current()->update(['default_due_days' => $hari]);

        return redirect()->back()->with('success', __('Termin bawaan disimpan: :hari hari.', ['hari' => $hari]));
    }

    /**
     * Selesai meninjau nomor lama: isi urutan yang cocok dengan pola aktif, sisanya (nomor yang
     * diketik manual) dibiarkan kosong, lalu tandai sudah ditinjau supaya gerbang terbuka.
     */
    public function review(InvoiceNumberService $numbers): RedirectResponse
    {
        $profil = CompanyProfile::current();
        abort_if($profil === null, 404);

        $hasil = $numbers->backfillSequences(true);
        $profil->forceFill(['invoice_legacy_reviewed_at' => now()])->save();

        return redirect()->route('dashboard')
            ->with('success', __(':count invoice lama diisi urutannya. Nomor berikutnya melanjutkan deret yang ada.', ['count' => $hasil['filled']]));
    }
}
