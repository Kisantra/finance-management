<?php

namespace App\Listeners;

use App\Http\Middleware\SetLocale;
use App\Models\User;
use Illuminate\Auth\Events\Login;

/**
 * Bahasa yang dipilih tamu secara EKSPLISIT (pemilih di halaman masuk/lupa kata sandi) disimpan ke
 * `users.locale` begitu login berhasil. Tanpa ini pilihan tamu langsung kalah oleh `users.locale`
 * (bawaan kolomnya 'id'), karena SetLocale mendahulukan preferensi pengguna.
 *
 * Tamu yang TIDAK memilih apa pun tidak punya penanda, jadi preferensi tersimpan pengguna tidak
 * ditimpa bahasa bawaan halaman masuk.
 */
class TerapkanBahasaPilihanTamu
{
    public function handle(Login $event): void
    {
        $request = request();
        if (! $request->hasSession() || ! $request->session()->pull(SetLocale::EXPLICIT_KEY, false)) {
            return;
        }

        $locale = $request->session()->get(SetLocale::SESSION_KEY);
        $user = $event->user;

        if (! $user instanceof User || ! SetLocale::isAvailable($locale) || $user->locale === $locale) {
            return;
        }

        $user->forceFill(['locale' => $locale])->save();
    }
}
