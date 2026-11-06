<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Jenis akun Kas & Bank. `type` membedakan rekening bank (`bank`) dari kas tunai / kas kecil
 * (`cash`); baris lama tetap `bank` lewat nilai bawaan. `custodian_id` = penanggung jawab kas,
 * id pengguna di database PUSAT, jadi tanpa foreign key (tabel users tidak ada di database
 * perusahaan). `cash_limit` = plafon kas kecil (rupiah penuh), dasar hitungan isi ulang. Keduanya
 * hanya bermakna untuk `cash`.
 *
 * `account_number` dan `bank_name` sengaja tetap NOT NULL: akun kas diisi "Tunai" dan kode
 * KAS-0001 oleh BankAccount::booted(), sehingga label rekening di modul lain tidak perlu
 * menangani null.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bank_accounts', function (Blueprint $table) {
            $table->string('type', 10)->default('bank')->after('id');
            $table->unsignedBigInteger('custodian_id')->nullable()->after('initial_balance');
            $table->bigInteger('cash_limit')->nullable()->after('custodian_id');
        });
    }

    public function down(): void
    {
        Schema::table('bank_accounts', function (Blueprint $table) {
            $table->dropColumn(['type', 'custodian_id', 'cash_limit']);
        });
    }
};
