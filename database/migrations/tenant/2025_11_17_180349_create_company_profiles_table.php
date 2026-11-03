<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('company_profiles', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('address');
            $table->string('email');
            $table->string('phone');
            $table->string('logo_path')->nullable();
            $table->string('signature_path')->nullable();
            $table->string('stamp_path')->nullable();

            // Tax
            $table->boolean('is_pkp')->default(false);
            $table->string('npwp')->nullable();
            $table->decimal('ppn_rate', 5, 2)->default(11.00); // 11%

            // Bank accounts (JSON)
            $table->json('bank_accounts')->nullable();

            // Signature
            $table->string('finance_manager_name');
            $table->string('finance_manager_position')->default('Manajer Keuangan');

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('company_profiles');
    }
};
