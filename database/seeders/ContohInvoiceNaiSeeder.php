<?php

namespace Database\Seeders;

use App\Models\Client;

/**
 * Contoh lokal PT Nusantara Armada Indonesia (NAI) lengkap dengan template invoice-nya
 * (resources/views/pdf/perusahaan/nusantara-armada-indonesia): perusahaan NAI saja, akun khusus NAI, profil
 * + format nomor NAI (dengan {KODE}), satu klien, dan tiga invoice terbit seperti invoice Word asli — FINAL
 * floating crane bertarif USD (RATE DOLLAR & PRICE di blok klien), demurrage, dan sewa alat berat tanpa kode —
 * semuanya PPN 11% dan dipotong PPh 23 2%, ditambah satu draft untuk editor. Semua datanya FIKTIF (lihat
 * ContohInvoicePerusahaanSeeder).
 *
 *   php artisan db:seed --class=ContohInvoiceNaiSeeder
 *
 * Akun (password: password) — keduanya hanya anggota NAI, jadi login langsung masuk ke NAI:
 *   admin.nai@mitragroup.id  admin NAI (cetak, terbitkan, ubah nomor)
 *   staff.nai@mitragroup.id  staff NAI
 */
class ContohInvoiceNaiSeeder extends ContohInvoicePerusahaanSeeder
{
    protected function company(): array
    {
        return ['slug' => 'nusantara-armada-indonesia', 'name' => 'PT Nusantara Armada Indonesia', 'abbreviation' => 'NAI'];
    }

    protected function accounts(): array
    {
        return [
            'admin.nai@mitragroup.id' => 'admin',
            'staff.nai@mitragroup.id' => 'staff',
        ];
    }

    protected function profile(): array
    {
        return [
            'name' => 'PT. NUSANTARA ARMADA INDONESIA',
            'abbreviation' => 'NAI',
            'address' => 'Jl. Ramania 2 RT. 46 Kel. Sidodadi Kec. Samarinda ulu',
            // Dokumen asli tidak mencantumkan email.
            'email' => 'nai@example.com',
            'phone' => '0811-5513-3232',
            'is_pkp' => true,
            'ppn_rate' => 11,
            // Seperti invoice Word NAI: klien memotong PPh 23 2%.
            'pph_enabled' => true,
            'pph_rate' => 2,
            // Invoice FINAL NAI bertarif USD (harga per MT dalam USD × kurs).
            'foreign_currency_enabled' => true,
            'finance_manager_name' => 'Salam Ilham',
            'finance_manager_position' => 'Direktur',
            'signature_city' => 'Samarinda',
            'bank_accounts' => [['bank' => 'Bank Mandiri', 'account_number' => '148-00-2312-8153', 'account_name' => 'PT. NUSANTARA ARMADA INDONESIA']],
            'invoice_number_format' => '{NO}/{PT}-{KLIEN}/{KODE}/{BLN_ROMAWI}/{THN}',
            'invoice_number_padding' => 3,
            'invoice_number_reset' => 'yearly',
            'default_due_days' => 14,
        ];
    }

    protected function client(): array
    {
        return [
            'name' => 'PT. CONTOH ARMADA SAMUDRA',
            'attributes' => [
                'alias' => 'CAS',
                'type' => 'company',
                'status' => Client::STATUS_ACTIVE,
                'address' => 'Jl. Contoh Raya No. 1A, Kelurahan Contoh, Kota Jakarta Timur, DKI Jakarta 13330',
                'person_in_charge' => 'Direktur Finance & Accounting',
            ],
        ];
    }

    protected function invoices(): array
    {
        return [
            [
                'number' => '176/NAI-CAS/INV-FINAL/XI/2026',
                'code' => 'FINAL',
                'date' => '2026-11-11',
                'subject' => 'Invoice Final Floating Crane MV. CONTOH SAMUDRA',
                'discount' => 0,
                'kurs' => 18059,
                'items' => [[
                    'service_name' => 'MV. CONTOH SAMUDRA',
                    'description' => "Loading Port : Muara Berau\nAnchorage (Floating Crane)",
                    'quantity' => 25000,
                    'unit' => 'MT',
                    'foreign_unit_price' => 1.2,
                ]],
            ],
            [
                'number' => '177/NAI-CAS/INV-DEM/XI/2026',
                'code' => 'DEM',
                'date' => '2026-11-12',
                'subject' => 'Invoice Demurrage MV. CONTOH SAMUDRA',
                'discount' => 0,
                'items' => [[
                    'service_name' => 'Tagihan DEMURRAGE MV. CONTOH SAMUDRA',
                    'description' => "Kontrak Kerja 8 Hari\nDemurrage : 3 Hari x 3 Unit",
                    'quantity' => 3,
                    'unit' => 'Day',
                    'unit_price' => 3750000,
                ]],
            ],
            [
                'number' => '178/NAI-CAS/INV/XI/2026',
                'date' => '2026-11-13',
                'subject' => 'Invoice Sewa Alat Berat MV. CONTOH SAMUDRA',
                'discount' => 0,
                'items' => [[
                    'service_name' => 'Sewa Pakai Alat Berat',
                    'description' => 'Sewa 1 Paket Alat Berat, Mob-Demob MV. CONTOH SAMUDRA',
                    'quantity' => 1,
                    'unit' => 'Paket',
                    'unit_price' => 150000000,
                ]],
            ],
            [
                'number' => null,
                'code' => 'FINAL',
                'date' => '2026-11-18',
                'subject' => 'Invoice Final Floating Crane MV. CONTOH BAHARI',
                'discount' => 0,
                'items' => [[
                    'service_name' => 'MV. CONTOH BAHARI',
                    'description' => "Loading Port : Muara Berau\nAnchorage (Floating Crane)",
                    'quantity' => 20000,
                    'unit' => 'MT',
                    'unit_price' => 22000,
                ]],
            ],
        ];
    }
}
