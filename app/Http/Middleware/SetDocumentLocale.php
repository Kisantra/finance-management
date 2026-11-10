<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Traits\Localizable;
use Symfony\Component\HttpFoundation\Response;

/**
 * Dokumen (PDF, Excel, isi template builder, terbilang) SELALU Bahasa Indonesia, apa pun bahasa
 * tampilan pengguna (keputusan K2). Alias `locale.dokumen`, dipasang di setiap rute dokumen.
 *
 * Bahasa 'id' (App + Carbon, lewat event LocaleUpdated) berlaku selama request diproses lalu
 * dipulihkan. Bahasa tampilan semula disimpan di atribut request `locale.tampilan` — dipakai bila
 * rute dokumen gagal dan halaman error perlu tampil dalam bahasa pengguna.
 *
 * Untuk isi dokumen yang dibangun di dalam request TAMPILAN (mis. contoh kanvas template builder)
 * pakai withDocumentLocale(fn () => ...) / SetDocumentLocale::run().
 */
class SetDocumentLocale
{
    use Localizable;

    public const LOCALE = 'id';

    public const DISPLAY_LOCALE_ATTRIBUTE = 'locale.tampilan';

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $request->attributes->set(self::DISPLAY_LOCALE_ATTRIBUTE, App::getLocale());

        return $this->withLocale(self::LOCALE, fn (): Response => $next($request));
    }

    /**
     * Jalankan $callback dalam Bahasa Indonesia, lalu pulihkan bahasa semula — juga bila melempar.
     *
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    public static function run(callable $callback): mixed
    {
        return (new self)->withLocale(self::LOCALE, $callback);
    }
}
