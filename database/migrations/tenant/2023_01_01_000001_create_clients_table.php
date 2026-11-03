<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clients', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->enum('type', ['individual', 'company']);
            $table->string('NPWP')->nullable();
            $table->string('KPP')->nullable();
            $table->string('logo')->nullable();
            $table->enum('status', ['Active', 'Inactive'])->nullable()->default('Active');
            $table->string('EFIN')->nullable();
            $table->string('account_representative')->nullable();
            $table->string('ar_phone_number')->nullable();
            $table->string('person_in_charge')->nullable();
            $table->string('email')->unique()->nullable();
            $table->string('address')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clients');
    }
};
