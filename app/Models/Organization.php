<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class Organization extends Model
{
    use CentralConnection;

    protected $fillable = [
        'name',
        'slug',
        'company_quota',
        'status',
    ];

    public function companies(): HasMany
    {
        return $this->hasMany(Company::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function hasReachedCompanyQuota(): bool
    {
        return $this->companies()->count() >= $this->company_quota;
    }
}
