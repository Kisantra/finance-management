<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // SQLite treats ENUM as string natively; MODIFY COLUMN is MySQL-specific syntax
        if (DB::getDriverName() !== 'sqlite') {
            DB::statement("ALTER TABLE recurring_templates MODIFY COLUMN status ENUM('active', 'inactive', 'archived') DEFAULT 'active'");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            DB::statement("ALTER TABLE recurring_templates MODIFY COLUMN status ENUM('active', 'inactive') DEFAULT 'active'");
        }
    }
};
