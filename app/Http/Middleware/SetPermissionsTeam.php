<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SetPermissionsTeam
{
    /**
     * Menetapkan konteks team Spatie (= perusahaan aktif) sebelum permission
     * check apa pun. Sumber konteks: tenant yang sedang terinisialisasi
     * (routing /c/{company}, Tahap 2), fallback keanggotaan pertama user.
     * WAJIB terdaftar sebelum HandleInertiaRequests di web group.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user) {
            $companyId = tenant()?->getTenantKey()
                ?? $user->companies()->value('companies.id');

            if ($companyId !== null) {
                setPermissionsTeamId($companyId);
                $user->unsetRelation('roles')->unsetRelation('permissions');
            }
        }

        return $next($request);
    }
}
