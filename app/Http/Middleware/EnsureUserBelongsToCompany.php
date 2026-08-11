<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserBelongsToCompany
{
    /**
     * Jalankan SETELAH InitializeTenancyByPath: memastikan user yang login
     * terdaftar sebagai anggota perusahaan aktif (pivot company_user) dan
     * perusahaannya berstatus aktif. Bukan anggota → 403, tanpa kecuali.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $company = tenant();

        abort_if($company === null, 404);
        abort_unless($company->isActive(), 403, 'Perusahaan ini sedang tidak aktif.');

        $isMember = $request->user()
            ->companies()
            ->whereKey($company->getTenantKey())
            ->exists();

        abort_unless($isMember, 403, 'Anda tidak memiliki akses ke perusahaan ini.');

        return $next($request);
    }
}
