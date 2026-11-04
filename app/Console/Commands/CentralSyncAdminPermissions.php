<?php

namespace App\Console\Commands;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Console\Command;
use Spatie\Permission\PermissionRegistrar;

/**
 * Role `admin` selalu memegang SEMUA permission. deploy.sh menjalankan ini tiap rilis,
 * jadi permission baru dari migrasi langsung dimiliki admin tanpa diatur manual di
 * halaman Izin & Peran (yang mengunci role admin). Role lain tetap diatur lewat migrasi
 * atau halaman itu.
 */
class CentralSyncAdminPermissions extends Command
{
    protected $signature = 'central:sync-admin-permissions';

    protected $description = 'Beri role admin semua permission yang ada (dijalankan deploy.sh tiap rilis)';

    public function handle(): int
    {
        $admin = Role::query()
            ->where('name', 'admin')
            ->where('guard_name', 'web')
            ->whereNull(config('permission.column_names.team_foreign_key'))
            ->first();

        if (! $admin) {
            $this->warn('Role admin belum ada; dilewati.');

            return self::SUCCESS;
        }

        $kurang = Permission::query()
            ->where('guard_name', 'web')
            ->whereNotIn('id', $admin->permissions()->pluck('permissions.id'))
            ->get();

        if ($kurang->isNotEmpty()) {
            $admin->givePermissionTo($kurang);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $this->info("Role admin: {$kurang->count()} permission baru diberikan, total {$admin->permissions()->count()}.");

        return self::SUCCESS;
    }
}
