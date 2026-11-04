<?php

namespace App\Http\Middleware;

use App\Models\CompanyProfile;
use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

/**
 * Perusahaan tidak bisa dipakai sebelum profilnya lengkap (nama, singkatan, alamat,
 * kontak, penanggung jawab keuangan). Singkatan menjadi kode {PT} di nomor invoice
 * dan pengajuan dana; tanpa gerbang ini perusahaan baru atau hasil cutover menerbitkan
 * dokumen dengan kode kosong/salah. Pengisi: pemegang `manage company profile`
 * diarahkan ke form; user lain melihat halaman "belum disiapkan".
 *
 * Permintaan JSON di luar Inertia (api() halaman) dibiarkan: gerbangnya halaman, bukan
 * otorisasi. Test lama mematikannya lewat config `app.require_company_profile`
 * (lihat TestCase::$wajibProfilPerusahaan).
 */
class EnsureCompanyProfileComplete
{
    /** Rute yang tetap terbuka: form profil itu sendiri dan berkas pratinjaunya. */
    private const TERBUKA = ['settings.company', 'settings.company.update', 'settings.company.delete-asset', 'tenant.storage'];

    public function handle(Request $request, Closure $next): Response
    {
        if (! config('app.require_company_profile', true)
            || $request->routeIs(...self::TERBUKA)
            || ($request->expectsJson() && ! $request->header('X-Inertia'))) {
            return $next($request);
        }

        $profil = CompanyProfile::current();
        if ($profil && $profil->missingFields() === []) {
            return $next($request);
        }

        if ($request->user()?->can('manage company profile')) {
            return redirect()->route('settings.company')
                ->with('warning', 'Lengkapi profil perusahaan dulu sebelum melanjutkan.');
        }

        return Inertia::render('company-not-ready')->toResponse($request);
    }
}
