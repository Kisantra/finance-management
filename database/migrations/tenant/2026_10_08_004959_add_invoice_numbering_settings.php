<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Penomoran invoice yang bisa diatur: pola token + jumlah digit + periode reset di profil
     * perusahaan, dan nomor urut tersimpan sebagai angka di invoice (tidak lagi dibaca dari teks
     * nomor, yang bentuknya sekarang bisa berubah).
     */
    public function up(): void
    {
        Schema::table('company_profiles', function (Blueprint $table) {
            $table->string('invoice_number_format', 100)->default('{NO}/INV/{PT}-{KLIEN}/{BLN_ROMAWI}/{THN}');
            $table->unsignedTinyInteger('invoice_number_padding')->default(3);
            $table->string('invoice_number_reset', 10)->default('monthly');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->unsignedInteger('invoice_sequence')->nullable()->after('invoice_number');
        });

        // Isi urutan invoice lama dengan aturan lama yang sama: angka di depan "/INV/".
        DB::table('invoices')->whereNotNull('invoice_number')->orderBy('id')->chunkById(500, function ($invoices) {
            foreach ($invoices as $invoice) {
                if (preg_match('/^(\d+)\/INV\//', $invoice->invoice_number, $match)) {
                    DB::table('invoices')->where('id', $invoice->id)->update(['invoice_sequence' => (int) $match[1]]);
                }
            }
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn('invoice_sequence');
        });

        Schema::table('company_profiles', function (Blueprint $table) {
            $table->dropColumn(['invoice_number_format', 'invoice_number_padding', 'invoice_number_reset']);
        });
    }
};
