<?php

namespace Database\Seeders;

use App\Models\CompanyProfile;
use Illuminate\Database\Seeder;

class CompanyProfileSeeder extends Seeder
{
    /**
     * Melengkapi profil demo. Provisioning (TenantDatabaseSeeder) sudah membuat satu profil berisi
     * '-', dan CompanyProfile::current() selalu membaca baris pertama: profil itu yang diisi, bukan
     * ditambah baris kedua, supaya gerbang EnsureCompanyProfileComplete lolos.
     */
    public function run(): void
    {
        (CompanyProfile::current() ?? new CompanyProfile)->fill([
            'name' => 'PT. KINARA SADAYATRA NUSANTARA',
            'abbreviation' => 'KSN',
            'address' => 'Jl. A. Wahab Syahranie Perum Pondok Alam Indah, Nomor 3D, Kel. Sempaja Barat, Kota Samarinda - Kalimantan Timur',
            'email' => 'kisantra.official@gmail.com',
            'phone' => '0852-8888-2600',
            'logo_path' => 'images/letter-head.png',
            'signature_path' => 'images/pdf-signature.png',
            'stamp_path' => 'images/kisantra-stamp.png',
            'is_pkp' => false,
            'npwp' => null,
            'ppn_rate' => 11.00,
            'bank_accounts' => [
                [
                    'bank' => 'MANDIRI',
                    'account_number' => '1480045452425',
                    'account_name' => 'PT. KINARA SADAYATRA NUSANTARA',
                ],
            ],
            'finance_manager_name' => 'Mohammad Denny Jodysetiawan',
            'finance_manager_position' => 'Manajer Keuangan',
        ])->save();
    }
}
