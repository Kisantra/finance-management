<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    /**
     * Izin menghubungkan Claude ke data keuangan (MCP, hanya baca) — bawaannya admin &
     * finance manager; peran lain bisa diberi lewat Izin & Peran. Migration central.
     */
    public function up(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        Permission::firstOrCreate(['name' => 'use claude']);

        foreach (['admin', 'finance manager'] as $nama) {
            Role::where('name', $nama)->first()?->givePermissionTo('use claude');
        }
    }

    public function down(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        foreach (['admin', 'finance manager'] as $nama) {
            Role::where('name', $nama)->first()?->revokePermissionTo('use claude');
        }

        Permission::where('name', 'use claude')->delete();
    }
};
