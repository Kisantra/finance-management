<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * custom_fonts — global library of user-uploaded .ttf files.
     *
     * Storage: public disk at fonts/custom/{filename}.ttf
     * Browser URL: /storage/fonts/custom/{filename}.ttf
     * DomPDF path: storage_path('app/public/fonts/custom/{filename}.ttf')
     *   → within DomPDF chroot (base_path()) because storage/ lives inside the project root.
     */
    public function up(): void
    {
        Schema::create('custom_fonts', function (Blueprint $table) {
            $table->id();
            /** Display name shown in the font picker — also used as CSS font-family. */
            $table->string('name')->unique();
            /** Stored filename on disk (e.g. "myfont_a1b2c3d4.ttf"). */
            $table->string('filename');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('custom_fonts');
    }
};
