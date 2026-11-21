<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Sakelar Debit Note di Profil perusahaan (bawaan mati): editor invoice baru menawarkan jenis dokumen
 * Invoice / Debit Note hanya bila perusahaan punya template Debit Note DAN menyalakannya. Perusahaan yang
 * sudah pernah membuat Debit Note langsung dinyalakan agar alur kerjanya tidak hilang setelah deploy.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company_profiles', function (Blueprint $table) {
            $table->boolean('debit_note_enabled')->default(false)->after('foreign_currency_enabled');
        });

        if (DB::table('invoices')->where('document_type', 'debit_note')->exists()) {
            DB::table('company_profiles')->update(['debit_note_enabled' => true]);
        }
    }

    public function down(): void
    {
        Schema::table('company_profiles', function (Blueprint $table) {
            $table->dropColumn('debit_note_enabled');
        });
    }
};
