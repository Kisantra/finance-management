<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Mapping system_key → identitas kategori sistem (type + label seeder).
     * Menggantikan kolom `code` yang di-drop oleh migration 2026_02_05 —
     * lookup FIN-LOAN-IN dll. di Loans/Receivables pindah ke kolom ini.
     *
     * @var array<string, array{type: string, label: string}>
     */
    private array $systemKeys = [
        'FIN-LOAN-IN' => ['type' => 'financing', 'label' => 'Penerimaan Pinjaman'],
        'FIN-LOAN-OUT' => ['type' => 'financing', 'label' => 'Pembayaran Pokok Pinjaman'],
        'FIN-RCV-OUT' => ['type' => 'financing', 'label' => 'Piutang Diberikan'],
        'FIN-RCV-IN' => ['type' => 'financing', 'label' => 'Pembayaran Piutang Diterima'],
        'EXP-INTEREST' => ['type' => 'expense', 'label' => 'Beban Bunga Pinjaman'],
        'REV-INTEREST' => ['type' => 'income', 'label' => 'Pendapatan Bunga'],
    ];

    public function up(): void
    {
        Schema::table('transaction_categories', function (Blueprint $table) {
            $table->string('system_key')->nullable()->unique()->after('parent_id');
        });

        foreach ($this->systemKeys as $key => $identity) {
            DB::table('transaction_categories')
                ->where('type', $identity['type'])
                ->where('label', $identity['label'])
                ->whereNull('parent_id')
                ->whereNull('system_key')
                ->limit(1)
                ->update(['system_key' => $key]);
        }
    }

    public function down(): void
    {
        Schema::table('transaction_categories', function (Blueprint $table) {
            $table->dropUnique(['system_key']);
            $table->dropColumn('system_key');
        });
    }
};
