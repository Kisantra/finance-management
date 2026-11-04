<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Penanda bahwa admin sudah meninjau nomor invoice lama (bernomor tetapi urutannya kosong).
 * Selama kosong DAN masih ada invoice semacam itu, gerbang EnsureCompanyProfileComplete
 * membawa admin ke Penomoran invoice: tanpa urutan, invoice berikutnya bisa mengulang nomor
 * yang sudah terkirim ke klien (runbook §G.2.5). Perusahaan tanpa invoice semacam itu
 * langsung dianggap sudah ditinjau.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company_profiles', function (Blueprint $table) {
            $table->timestamp('invoice_legacy_reviewed_at')->nullable();
        });

        $adaYangKosong = DB::table('invoices')->whereNotNull('invoice_number')->whereNull('invoice_sequence')->exists();
        if (! $adaYangKosong) {
            DB::table('company_profiles')->update(['invoice_legacy_reviewed_at' => now()]);
        }
    }

    public function down(): void
    {
        Schema::table('company_profiles', function (Blueprint $table) {
            $table->dropColumn('invoice_legacy_reviewed_at');
        });
    }
};
