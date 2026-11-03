<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bank_accounts', function (Blueprint $table) {
            $table->id();
            $table->string('account_name');
            $table->string('account_number');
            $table->string('bank_name');
            $table->string('branch')->nullable();
            $table->bigInteger('initial_balance')->default(0); // Changed from decimal to bigint
            $table->bigInteger('current_balance')->default(0); // Changed from decimal to bigint
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bank_accounts');
    }
};
