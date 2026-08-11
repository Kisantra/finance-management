<?php

namespace Database\Seeders;

use App\Models\CompanyProfile;
use Illuminate\Database\Seeder;

/**
 * Root seeder untuk database TENANT — dijalankan otomatis oleh pipeline
 * provisioning (TenantCreated → SeedDatabase) dan `tenants:seed`.
 * HANYA master data; data demo dev ada di DatabaseSeeder (central).
 * Jangan memanggil DatabaseSeeder dari sini — itu seeder database central.
 */
class TenantDatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            TransactionCategorySeeder::class,
        ]);

        if (tenant() && CompanyProfile::count() === 0) {
            CompanyProfile::create([
                'name' => tenant('name'),
                'abbreviation' => tenant('abbreviation'),
                'address' => '-',
                'email' => '-',
                'phone' => '-',
                'finance_manager_name' => '-',
            ]);
        }
    }
}
