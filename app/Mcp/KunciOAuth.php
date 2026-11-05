<?php

namespace App\Mcp;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Laravel\Passport\Passport;
use RuntimeException;

/**
 * Kunci enkripsi OAuth (Passport) untuk koneksi Claude: satu pasang per server, dipakai untuk
 * menandatangani token. Dibuat otomatis saat pemegang `use claude` membuka Pengaturan › Koneksi
 * Claude, sehingga tidak perlu menjalankan `php artisan passport:keys` di server. deploy.sh
 * (`ensure_passport_keys`) melakukan hal yang sama saat deploy.
 *
 * Pasangan yang LENGKAP tidak pernah ditimpa: kunci baru membatalkan semua sambungan Claude.
 * Pasangan setengah jadi (salah satu berkas hilang/kosong) dibuat ulang, karena memang sudah
 * tidak bisa dipakai.
 */
class KunciOAuth
{
    public function ada(): bool
    {
        if (filled(config('passport.private_key')) && filled(config('passport.public_key'))) {
            return true;
        }

        foreach (['oauth-private.key', 'oauth-public.key'] as $berkas) {
            $path = Passport::keyPath($berkas);

            if (! is_file($path) || filesize($path) === 0) {
                return false;
            }
        }

        return true;
    }

    /**
     * Buat pasangan kunci bila belum lengkap. Dikunci agar dua permintaan bersamaan tidak
     * menghasilkan kunci privat dari satu proses dan kunci publik dari proses lain.
     *
     * @return 'siap'|'baru' siap = sudah ada sebelumnya; baru = dibuat oleh panggilan ini
     *
     * @throws \Throwable bila kunci gagal dibuat (mis. storage tidak bisa ditulis)
     */
    public function pastikan(): string
    {
        if ($this->ada()) {
            return 'siap';
        }

        return Cache::lock('passport-kunci-oauth', 120)->block(60, function (): string {
            clearstatcache();

            if ($this->ada()) {
                return 'siap';
            }

            Artisan::call('passport:keys', ['--force' => true]);
            clearstatcache();

            if (! $this->ada()) {
                throw new RuntimeException('Kunci OAuth gagal dibuat: '.trim(Artisan::output()));
            }

            return 'baru';
        });
    }
}
