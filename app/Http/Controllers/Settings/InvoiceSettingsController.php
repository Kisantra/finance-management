<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
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

        return Inertia::render('settings/invoice-numbering', [
            'settings' => $numbers->settings(),
            'defaults' => [
                'format' => InvoiceNumberService::DEFAULT_FORMAT,
                'padding' => InvoiceNumberService::DEFAULT_PADDING,
                'reset' => InvoiceNumberService::DEFAULT_RESET,
            ],
            'tokens' => collect(InvoiceNumberService::TOKENS)
                ->map(fn (string $label, string $token) => ['token' => $token, 'label' => $label])
                ->values(),
            'paddings' => InvoiceNumberService::PADDINGS,
            'hasCompany' => CompanyProfile::current() !== null,
            // Bahan pratinjau: nilai nyata hari ini, dihitung server agar sama dengan nomor yang akan terbit.
            'sample' => [
                'date' => $today->toDateString(),
                'company_initials' => $numbers->companyInitials(),
                'client_name' => $client ? ($client->type === 'company' && $client->company_name ? $client->company_name : $client->name) : 'PT Contoh Klien',
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

        return redirect()->back()->with('success', 'Format penomoran invoice disimpan. Berlaku untuk invoice yang dikirim setelah ini.');
    }
}
