<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tabel tenant stancl/tenancy. `id` adalah slug URL yang PERMANEN
     * (dipakai di alamat web & path storage — keputusan final slide 12);
     * kolom di luar getCustomColumns() milik Company tersimpan di `data`.
     */
    public function up(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('organization_id')->constrained('organizations')->restrictOnDelete();
            $table->string('name');
            $table->string('abbreviation');
            $table->string('status')->default('provisioning');
            $table->timestamps();
            $table->json('data')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('companies');
    }
};
