<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\UpdateCompanyRequest;
use App\Models\CompanyProfile;
use App\Models\Invoice;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class CompanyController extends Controller
{
    public function edit(): Response
    {
        $company = CompanyProfile::first();
        // '-' adalah isian sementara provisioning: tampilkan kosong supaya terlihat wajib diisi.
        $isian = fn (?string $nilai): string => trim((string) $nilai) === '-' ? '' : (string) $nilai;

        return Inertia::render('settings/company', [
            'missingFields' => $company ? $company->missingFields() : ['name', 'abbreviation', 'address', 'email', 'phone', 'finance_manager_name', 'finance_manager_position'],
            // Rujukan saat mengisi singkatan: kode di nomor terakhir yang sudah terkirim ke klien.
            'lastInvoiceNumber' => Invoice::query()->whereNotNull('invoice_number')->latest('id')->value('invoice_number'),
            // Dinamai companyProfile, BUKAN company. Prop bersama bernama
            // `company` dikirim HandleInertiaRequests dan berisi identitas
            // tenant ({slug, name, abbreviation}); prop halaman dengan nama
            // yang sama MENIMPANYA. Akibatnya activeCompanySlug jadi null,
            // lalu companyUrl() dan jaring pengaman installCompanyUrlPrefix()
            // mati bersamaan — setiap tautan dan form di halaman ini kehilangan
            // prefiks /c/{slug} dan menjawab 404/405. Ditemukan QC 2026-11-03.
            'companyProfile' => $company ? [
                'id' => $company->id,
                'name' => $isian($company->name),
                'abbreviation' => (string) $company->abbreviation,
                'address' => $isian($company->address),
                'email' => $isian($company->email),
                'phone' => $isian($company->phone),
                'is_pkp' => (bool) $company->is_pkp,
                'npwp' => $company->npwp,
                'ppn_rate' => $company->ppn_rate,
                'finance_manager_name' => $isian($company->finance_manager_name),
                'finance_manager_position' => $isian($company->finance_manager_position),
                'bank_accounts' => $company->bank_accounts ?? [],
                'logo_path' => $company->logo_path,
                'letter_head_path' => $company->letter_head_path,
                'signature_path' => $company->signature_path,
                'stamp_path' => $company->stamp_path,
                'logo_url' => $this->fileUrl($company->logo_path),
                'letter_head_url' => $this->fileUrl($company->letter_head_path),
                'signature_url' => $this->fileUrl($company->signature_path),
                'stamp_url' => $this->fileUrl($company->stamp_path),
            ] : null,
        ]);
    }

    public function update(UpdateCompanyRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        $company = CompanyProfile::firstOrNew();
        $belumLengkap = ! $company->exists || $company->missingFields() !== [];
        $company->fill([
            'name' => $validated['name'],
            'abbreviation' => $validated['abbreviation'],
            'address' => $validated['address'],
            'email' => $validated['email'],
            'phone' => $validated['phone'],
            'is_pkp' => (bool) ($validated['is_pkp'] ?? false),
            'npwp' => $validated['npwp'] ?? null,
            'ppn_rate' => $validated['ppn_rate'],
            'finance_manager_name' => $validated['finance_manager_name'],
            'finance_manager_position' => $validated['finance_manager_position'],
        ]);

        $ts = time();

        if ($request->hasFile('logo')) {
            $this->replaceFile($company, 'logo_path', $request->file('logo'), "logo-{$ts}");
        }
        if ($request->hasFile('letter_head')) {
            $this->replaceFile($company, 'letter_head_path', $request->file('letter_head'), "letter-head-{$ts}");
        }
        if ($request->hasFile('signature')) {
            $this->replaceFile($company, 'signature_path', $request->file('signature'), "pdf-signature-{$ts}");
        }
        if ($request->hasFile('stamp')) {
            $this->replaceFile($company, 'stamp_path', $request->file('stamp'), "stamp-{$ts}");
        }

        $company->save();

        // Satu identitas: nama & singkatan di pemilih/pengalih perusahaan (database pusat)
        // mengikuti profil, sumber yang sama dengan PDF dan nomor dokumen.
        tenant()?->update(['name' => $company->name, 'abbreviation' => $company->abbreviation]);

        if ($belumLengkap) {
            return redirect()->route('dashboard')->with('success', 'Profil perusahaan lengkap. Selamat bekerja.');
        }

        return redirect()->back()->with('success', 'Profil perusahaan berhasil diperbarui.');
    }

    public function deleteAsset(Request $request, string $asset): RedirectResponse
    {
        $validAssets = ['logo', 'letter_head', 'signature', 'stamp'];
        abort_unless(in_array($asset, $validAssets, true), 404);

        $company = CompanyProfile::first();
        if (! $company) {
            return redirect()->back();
        }

        $column = "{$asset}_path";
        $path = $company->{$column};

        if ($path && Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
        }

        $company->{$column} = null;
        $company->save();

        return redirect()->back()->with('success', 'File berhasil dihapus.');
    }

    private function replaceFile(CompanyProfile $company, string $column, $file, string $baseName): void
    {
        if ($company->{$column} && Storage::disk('public')->exists($company->{$column})) {
            Storage::disk('public')->delete($company->{$column});
        }
        $ext = $file->getClientOriginalExtension() ?: 'png';
        $company->{$column} = $file->storeAs('images', "{$baseName}.{$ext}", 'public');
    }

    private function fileUrl(?string $path): ?string
    {
        if (! $path) {
            return null;
        }
        $url = asset('storage/'.$path);
        if (Storage::disk('public')->exists($path)) {
            $url .= '?v='.filemtime(storage_path('app/public/'.$path));
        }

        return $url;
    }
}
