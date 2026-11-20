<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tagihan dalam USD dengan kurs manual. Pembukuan tetap Rupiah: kolom Rupiah yang sudah ada
 * (subtotal, total_amount, items.amount, payments.amount) tetap dibaca semua laporan, kolom baru
 * hanya menyimpan sisi USD-nya. Semua data lama otomatis IDR dengan kolom baru kosong.
 *
 * - company_profiles.foreign_currency_enabled: sakelar "Bisa menagih dalam USD" (bawaan mati).
 * - invoices.currency: mata uang tagihan (IDR/USD); exchange_rate: kurs manual Rp per 1 USD (juga untuk
 *   invoice Rupiah bertarif USD); total_foreign: utang klien dalam USD (tagihan USD saja).
 * - invoice_items.foreign_unit_price: harga USD per unit; kosong = harga Rupiah biasa.
 * - payments.foreign_amount + exchange_rate: USD yang diterima dan kurs saat diterima.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company_profiles', function (Blueprint $table) {
            $table->boolean('foreign_currency_enabled')->default(false)->after('pph_rate');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->string('currency', 3)->default('IDR')->after('total_amount');
            $table->decimal('exchange_rate', 12, 2)->nullable()->after('currency');
            $table->decimal('total_foreign', 15, 2)->nullable()->after('exchange_rate');
        });

        Schema::table('invoice_items', function (Blueprint $table) {
            $table->decimal('foreign_unit_price', 15, 4)->nullable()->after('unit_price');
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->decimal('foreign_amount', 15, 2)->nullable()->after('amount');
            $table->decimal('exchange_rate', 12, 2)->nullable()->after('foreign_amount');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn(['foreign_amount', 'exchange_rate']);
        });

        Schema::table('invoice_items', function (Blueprint $table) {
            $table->dropColumn('foreign_unit_price');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['currency', 'exchange_rate', 'total_foreign']);
        });

        Schema::table('company_profiles', function (Blueprint $table) {
            $table->dropColumn('foreign_currency_enabled');
        });
    }
};
