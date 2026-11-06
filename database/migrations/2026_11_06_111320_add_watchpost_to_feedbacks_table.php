<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Laporan bug diteruskan ke Watchpost (lihat KirimLaporanBugKeWatchpost).
 *
 * Konteks dicatat saat pengguna mengirim, karena job berjalan belakangan di
 * worker yang tidak tahu browser maupun halaman error-nya. `page_url` dilebarkan:
 * kini memuat query + #hash (dialog yang sedang terbuka), dan varchar(255) lama
 * sudah lebih sempit dari validasinya (500).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('feedbacks', function (Blueprint $table) {
            $table->string('page_url', 2000)->nullable()->change();

            $table->uuid('trace_id')->nullable()->after('page_url');
            $table->string('error_id', 32)->nullable()->after('trace_id');
            $table->json('breadcrumbs')->nullable()->after('error_id');
            $table->string('user_agent', 500)->nullable()->after('breadcrumbs');

            $table->unsignedBigInteger('watchpost_ticket_id')->nullable()->after('attachment_name');
            $table->string('watchpost_ticket_number', 16)->nullable()->after('watchpost_ticket_id');
            $table->string('watchpost_ticket_url', 500)->nullable()->after('watchpost_ticket_number');
        });
    }

    public function down(): void
    {
        Schema::table('feedbacks', function (Blueprint $table) {
            $table->dropColumn([
                'trace_id', 'error_id', 'breadcrumbs', 'user_agent',
                'watchpost_ticket_id', 'watchpost_ticket_number', 'watchpost_ticket_url',
            ]);
            $table->string('page_url')->nullable()->change();
        });
    }
};
