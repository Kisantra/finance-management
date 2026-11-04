<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Facades\DB;

/**
 * Database untuk kode URL baru (awalan instalasi + slug) belum boleh ada di server MySQL.
 * Server bisa dipakai bersama instalasi lain; tanpa pemeriksaan ini provisioning gagal
 * "sudah ada", lalu tombol Coba Ulang menghapus database bernama itu, yang milik orang lain.
 */
class DatabasePerusahaanBelumAda implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $nama = config('tenancy.database.prefix').$value;

        if (DB::selectOne('SELECT 1 FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', [$nama]) !== null) {
            $fail('Database untuk kode URL ini sudah ada di server MySQL (mungkin milik instalasi lain). Pilih kode lain.');
        }
    }
}
