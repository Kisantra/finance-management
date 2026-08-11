<?php

namespace App\Jobs;

use App\Models\Company;

class MarkCompanyActive
{
    public function __construct(protected Company $tenant) {}

    /**
     * Langkah terakhir pipeline provisioning (setelah CreateDatabase →
     * MigrateDatabase → SeedDatabase sukses): perusahaan siap dipakai.
     */
    public function handle(): void
    {
        $this->tenant->update(['status' => 'active']);
    }
}
