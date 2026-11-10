<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Symfony\Component\HttpFoundation\Response;

/**
 * SATU-SATUNYA penentu bahasa tampilan per request.
 *
 * Urutan: pengguna login → `users.locale` (preferensi tersimpan, berlaku di sesi & perangkat baru);
 * tamu → bahasa yang dipilihnya di sesi ini; selain itu bawaan ('id', lihat default()).
 * Nilai di luar `config('app.available_locales')` diabaikan. `App::setLocale()` memicu event
 * LocaleUpdated, sehingga Carbon (label bulan/hari di server) ikut berganti lewat provider Carbon.
 *
 * Rute dokumen (PDF/Excel) menimpanya dengan 'id' lewat SetDocumentLocale (alias `locale.dokumen`).
 */
class SetLocale
{
    /** Kunci sesi: bahasa yang sedang dipakai (tamu memilihnya lewat POST /language). */
    public const SESSION_KEY = 'locale';

    /**
     * Penanda sesi: tamu memilih bahasa secara EKSPLISIT. Saat login berhasil pilihan ini disimpan
     * ke `users.locale` (App\Listeners\TerapkanBahasaPilihanTamu); tanpa penanda, preferensi pengguna
     * tidak ditimpa bahasa bawaan halaman login.
     */
    public const EXPLICIT_KEY = 'locale_dipilih';

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $locale = self::resolve($request);

        App::setLocale($locale);

        if ($request->hasSession() && $request->session()->get(self::SESSION_KEY) !== $locale) {
            $request->session()->put(self::SESSION_KEY, $locale);
        }

        return $next($request);
    }

    public static function resolve(Request $request): string
    {
        $userLocale = $request->user()?->locale;
        if (self::isAvailable($userLocale)) {
            return $userLocale;
        }

        $sessionLocale = $request->hasSession() ? $request->session()->get(self::SESSION_KEY) : null;
        if (self::isAvailable($sessionLocale)) {
            return $sessionLocale;
        }

        return self::default();
    }

    /**
     * Bahasa bawaan. Sengaja `app.fallback_locale`, bukan `app.locale`: App::setLocale() menimpa
     * `app.locale` di config, sehingga di proses yang hidup lama (Octane, test) nilainya bisa sisa
     * request sebelumnya.
     */
    public static function default(): string
    {
        $locale = config('app.fallback_locale', 'id');

        return self::isAvailable($locale) ? $locale : 'id';
    }

    public static function isAvailable(mixed $locale): bool
    {
        return is_string($locale) && in_array($locale, self::available(), true);
    }

    /**
     * @return list<string>
     */
    public static function available(): array
    {
        return array_values(config('app.available_locales', ['id']));
    }
}
