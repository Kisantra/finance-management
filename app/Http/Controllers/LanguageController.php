<?php

namespace App\Http\Controllers;

use App\Http\Middleware\SetLocale;
use App\Http\Requests\SwitchLanguageRequest;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

/**
 * POST /language — ganti bahasa tampilan (pemilih di header aplikasi dan di halaman tamu).
 *
 * Pengguna login: disimpan ke `users.locale` (berlaku di sesi & perangkat lain). Tamu: disimpan di
 * sesi + penanda "dipilih eksplisit", yang diterapkan ke `users.locale` begitu login berhasil
 * (App\Listeners\TerapkanBahasaPilihanTamu).
 *
 * Balasan selalu MUAT ULANG PENUH halaman asal (Inertia::location → 409 + X-Inertia-Location untuk
 * request Inertia; redirect biasa untuk lainnya), supaya kamus bahasa baru dimuat sebelum render dan
 * semua label buatan server/konstanta halaman ikut berganti. Tidak ada sisa bahasa lama di layar.
 */
class LanguageController extends Controller
{
    public function __invoke(SwitchLanguageRequest $request): Response
    {
        $locale = $request->validated('locale');
        $session = $request->session();

        $session->put(SetLocale::SESSION_KEY, $locale);

        $user = $request->user();
        if ($user) {
            if ($user->locale !== $locale) {
                $user->forceFill(['locale' => $locale])->save();
            }
            $session->forget(SetLocale::EXPLICIT_KEY);
        } else {
            $session->put(SetLocale::EXPLICIT_KEY, true);
        }

        return Inertia::location($this->previousUrl($request->getSchemeAndHttpHost()));
    }

    /** Halaman asal, hanya bila masih di aplikasi ini (Referer asing tidak diikuti). */
    private function previousUrl(string $origin): string
    {
        $previous = url()->previous();

        return str_starts_with($previous, $origin.'/') || $previous === $origin ? $previous : url('/');
    }
}
