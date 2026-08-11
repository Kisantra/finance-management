<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;
use Symfony\Component\HttpFoundation\Response;

class SetCompanyUrlDefaults
{
    /**
     * Mengisi parameter {company} secara otomatis untuk semua route() dan
     * redirect()->route() di dalam konteks perusahaan aktif — controller
     * tidak perlu menyebut company di setiap pemanggilan route.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (tenant()) {
            URL::defaults(['company' => tenant()->getTenantKey()]);
        }

        return $next($request);
    }
}
