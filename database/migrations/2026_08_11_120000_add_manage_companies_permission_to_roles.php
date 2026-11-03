<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    /**
     * Permission provisioning perusahaan (Tahap 4): hanya admin.
     * Migration central — roles/permissions hidup di database pusat.
     */
    public function up(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        Permission::firstOrCreate(['name' => 'manage companies']);

        if ($admin = Role::where('name', 'admin')->first()) {
            $admin->givePermissionTo('manage companies');
        }
    }

    public function down(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        if ($admin = Role::where('name', 'admin')->first()) {
            $admin->revokePermissionTo('manage companies');
        }

        Permission::where('name', 'manage companies')->delete();
    }
};
