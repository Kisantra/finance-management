<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Pasangan transfer dulu ditandai konvensi string `'TRF'.time()` yang beresolusi DETIK:
 * dua transfer di detik yang sama berbagi `reference_number`, sehingga menghapus salah
 * satunya ikut menghapus kedua kaki transfer yang lain dan menggeser saldo tanpa jejak.
 * Kolom ULID ini menggantikan konvensi itu sebagai penanda pasangan yang sesungguhnya.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bank_transactions', function (Blueprint $table) {
            $table->char('transfer_group_id', 26)->nullable()->after('reference_number')->index();
        });

        $this->backfillPasanganWarisan();
    }

    public function down(): void
    {
        Schema::table('bank_transactions', function (Blueprint $table) {
            $table->dropIndex(['transfer_group_id']);
            $table->dropColumn('transfer_group_id');
        });
    }

    /**
     * Hanya pasangan yang terurai BERSIH yang diberi ULID: satu kelompok
     * (reference_number, transaction_date) yang berisi tepat satu debit dan satu kredit.
     * Kelompok yang ambigu — akibat tabrakan detik — sengaja dibiarkan null dan dilaporkan,
     * karena menebak pasangannya berarti menggabungkan transfer yang bukan pasangan.
     */
    private function backfillPasanganWarisan(): void
    {
        $ambigu = 0;

        DB::table('bank_transactions')
            ->where('reference_number', 'like', 'TRF%')
            ->orderBy('reference_number')
            ->get(['id', 'reference_number', 'transaction_date', 'transaction_type'])
            ->groupBy(fn ($row) => $row->reference_number.'|'.$row->transaction_date)
            ->each(function ($kelompok) use (&$ambigu) {
                $debit = $kelompok->where('transaction_type', 'debit');
                $kredit = $kelompok->where('transaction_type', 'credit');

                if ($debit->count() !== 1 || $kredit->count() !== 1) {
                    $ambigu++;

                    return;
                }

                DB::table('bank_transactions')
                    ->whereIn('id', [$debit->first()->id, $kredit->first()->id])
                    ->update(['transfer_group_id' => (string) Str::ulid()]);
            });

        if ($ambigu > 0) {
            logger()->warning("Backfill transfer_group_id: {$ambigu} kelompok transfer warisan ambigu dibiarkan null dan perlu ditinjau manual.");
        }
    }
};
