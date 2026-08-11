<?php

namespace App\Models;

use Spatie\Permission\Models\Role as SpatieRole;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

/**
 * Role Spatie di database CENTRAL — wajib CentralConnection karena
 * DatabaseTenancyBootstrapper menukar koneksi default ke tenant.
 */
class Role extends SpatieRole
{
    use CentralConnection;
}
