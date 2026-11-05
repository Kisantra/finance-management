<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Model;

/**
 * Mengisi `created_by` (pencatat) dan `updated_by` (terakhir mengubah) dengan pengguna yang sedang
 * login. Isinya id di database PUSAT, jadi tidak ada relasi Eloquent ke User: cari namanya di pusat
 * lewat whereIn, jangan join dari database perusahaan.
 *
 * Tanpa login (antrean, konsol, seeder) kolomnya dibiarkan kosong. `updated_by` kosong = belum
 * pernah diubah. Update massal lewat query builder TIDAK memicu event ini: isi `updated_by` sendiri
 * di tempat itu (mis. kaki lawan transfer di BankTransactionController::update).
 */
trait MencatatPengguna
{
    protected static function bootMencatatPengguna(): void
    {
        static::creating(function (Model $model): void {
            $model->created_by ??= auth()->id();
        });

        static::updating(function (Model $model): void {
            if (auth()->check()) {
                $model->updated_by = auth()->id();
            }
        });
    }
}
