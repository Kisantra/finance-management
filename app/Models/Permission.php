<?php

namespace App\Models;

use Spatie\Permission\Models\Permission as SpatiePermission;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

/**
 * Permission Spatie di database CENTRAL — wajib CentralConnection karena
 * DatabaseTenancyBootstrapper menukar koneksi default ke tenant.
 */
class Permission extends SpatiePermission
{
    use CentralConnection;
}
