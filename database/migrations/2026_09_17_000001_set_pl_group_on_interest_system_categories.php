<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Bunga pinjaman & bunga piutang tidak pernah muncul di Laporan Laba Rugi
 * karena kategori sistemnya dibuat tanpa `pl_group`, sehingga jatuh ke bucket
 * "belum diklasifikasi" alih-alih baris Beban Lain / Pendapatan Lain.
 *
 * Hanya mengisi yang masih NULL — klasifikasi yang sudah disesuaikan pengguna
 * lewat panel Laba Rugi tidak ditimpa.
 */
return new class extends Migration
{
    private const PETA = [
        'EXP-INTEREST' => 'other_expense',
        'REV-INTEREST' => 'other_income',
    ];

    public function up(): void
    {
        foreach (self::PETA as $systemKey => $plGroup) {
            DB::table('transaction_categories')
                ->where('system_key', $systemKey)
                ->whereNull('pl_group')
                ->update(['pl_group' => $plGroup]);
        }
    }

    public function down(): void
    {
        foreach (self::PETA as $systemKey => $plGroup) {
            DB::table('transaction_categories')
                ->where('system_key', $systemKey)
                ->where('pl_group', $plGroup)
                ->update(['pl_group' => null]);
        }
    }
};
