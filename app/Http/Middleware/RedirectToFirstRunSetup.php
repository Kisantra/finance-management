<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Instalasi baru (deploy.sh mode instalasi menulis berkas token): sebelum admin & perusahaan
 * pertama dibuat lewat walkthrough, semua halaman diarahkan ke /setup. Berkas token dihapus
 * begitu walkthrough selesai, jadi di luar instalasi baru middleware ini hanya satu stat().
 */
class RedirectToFirstRunSetup
{
    public static function tokenPath(): string
    {
        return (string) config('app.setup_token_path', storage_path('app/setup-token'));
    }

    public function handle(Request $request, Closure $next): Response
    {
        if (! is_file(self::tokenPath()) || $request->is('setup', 'setup/*', 'up')) {
            return $next($request);
        }

        return $request->expectsJson()
            ? response()->json(['message' => __('Aplikasi belum dipasang. Selesaikan langkah pemasangan di /setup.')], 503)
            : redirect('/setup');
    }
}
