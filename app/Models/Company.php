<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Stancl\Tenancy\Contracts\TenantWithDatabase;
use Stancl\Tenancy\Database\Concerns\HasDatabase;
use Stancl\Tenancy\Database\Models\Tenant as BaseTenant;

/**
 * Tenant stancl/tenancy. `id` = slug URL permanen (mis. "pt-kinara") —
 * juga menjadi nama database `tenant_{id}` dan path storage per perusahaan.
 */
class Company extends BaseTenant implements TenantWithDatabase
{
    use HasDatabase;

    protected $table = 'companies';

    public static function getCustomColumns(): array
    {
        return [
            'id',
            'organization_id',
            'name',
            'abbreviation',
            'status',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'company_user')->withTimestamps();
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }
}
