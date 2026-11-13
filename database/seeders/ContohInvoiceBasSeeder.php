<?php

namespace Database\Seeders;

use App\Models\Client;

/**
 * Contoh lokal PT Berkah Andalan Samboja (BAS) lengkap dengan template invoicenya
 * (resources/views/pdf/perusahaan/berkah-andalan-samboja): perusahaan BAS saja, akun khusus BAS, profil +
 * format nomor invoice BAS, satu klien, dan dua invoice terbit — satu meniru invoice Word asli (FINAL
 * stevedoring), satu dengan dua item bersatuan berbeda — ditambah satu draft untuk editor. Semua datanya
 * FIKTIF (lihat ContohInvoicePerusahaanSeeder); email profil memakai domain contoh karena dokumen asli
 * tidak mencantumkan email.
 *
 *   php artisan db:seed --class=ContohInvoiceBasSeeder
 *
 * Akun (password: password) — keduanya hanya anggota BAS, jadi login langsung masuk ke BAS:
 *   admin.bas@mitragroup.id  admin BAS (cetak, terbitkan, ubah nomor)
 *   staff.bas@mitragroup.id  staff BAS
 */
class ContohInvoiceBasSeeder extends ContohInvoicePerusahaanSeeder
{
    protected function company(): array
    {
        return ['slug' => 'berkah-andalan-samboja', 'name' => 'PT Berkah Andalan Samboja', 'abbreviation' => 'BAS'];
    }

    protected function accounts(): array
    {
        return [
            'admin.bas@mitragroup.id' => 'admin',
            'staff.bas@mitragroup.id' => 'staff',
        ];
    }

    protected function profile(): array
    {
        return [
            'name' => 'PT. BERKAH ANDALAN SAMBOJA',
            'abbreviation' => 'BAS',
            // Baris baru ikut tercetak di kotak alamat invoice, seperti dokumen asli.
            'address' => "JL. BPPN-HANDIL II RT.003 RW.000\nTELUK PEMEDAS, SAMBOJA\nKAB. KUTAI KARTANEGARA\nKALIMANTAN TIMUR",
            'email' => 'berkahandalansamboja@example.com',
            'phone' => '0811-5513-232 / 0812-5324-784',
            'is_pkp' => true,
            'ppn_rate' => 11,
            'finance_manager_name' => 'Salam Ilham',
            'finance_manager_position' => 'Direktur Utama',
            'signature_city' => 'Samarinda',
            'bank_accounts' => [['bank' => 'Bank Mandiri', 'account_number' => '148-00-23719878', 'account_name' => 'PT. BERKAH ANDALAN SAMBOJA']],
            'invoice_number_format' => '{NO}/{PT}-{KLIEN}/INV/{BLN_ROMAWI}/{THN}',
            'invoice_number_padding' => 3,
            'invoice_number_reset' => 'yearly',
            'default_due_days' => 14,
        ];
    }

    protected function client(): array
    {
        return [
            'name' => 'PT. CONTOH ENERGI SAMUDRA',
            'attributes' => [
                'alias' => 'CES',
                'type' => 'company',
                'status' => Client::STATUS_ACTIVE,
                'address' => 'Jl. Contoh Pelabuhan No. 5, Desa Contoh Pesisir, Kabupaten Kutai Kartanegara, Provinsi Kalimantan Timur',
                'person_in_charge' => 'Direktur Finance & Accounting',
            ],
        ];
    }

    protected function invoices(): array
    {
        return [
            [
                'number' => '012/BAS-CES/INV-FINAL/X/2026',
                'date' => '2026-10-24',
                'subject' => 'Invoice FINAL MV. CONTOH SAMUDRA',
                'discount' => 0,
                'items' => [[
                    'service_name' => 'MV. CONTOH SAMUDRA',
                    'description' => 'Loading Port : Muara Jawa Anchorage (stevedoring)',
                    'quantity' => 50000,
                    'unit' => 'MT',
                    'unit_price' => 10400,
                ]],
            ],
            [
                'number' => '013/BAS-CES/INV-FINAL/X/2026',
                'date' => '2026-10-28',
                'subject' => 'Invoice FINAL MV. CONTOH PERKASA',
                'discount' => 0,
                'items' => [
                    [
                        'service_name' => 'MV. CONTOH PERKASA',
                        'description' => 'Loading Port : Muara Jawa Anchorage (stevedoring)',
                        'quantity' => 32500,
                        'unit' => 'MT',
                        'unit_price' => 10400,
                    ],
                    [
                        'service_name' => 'Sewa Floating Crane MV. CONTOH PERKASA',
                        'description' => "On Board : 20 Oktober 2026\nComplete : 23 Oktober 2026",
                        'quantity' => 3,
                        'unit' => 'Day',
                        'unit_price' => 15000000,
                    ],
                ],
            ],
            [
                'number' => null,
                'date' => '2026-11-12',
                'subject' => 'Invoice FINAL MV. CONTOH NUSANTARA',
                'discount' => 0,
                'items' => [[
                    'service_name' => 'MV. CONTOH NUSANTARA',
                    'description' => 'Loading Port : Muara Jawa Anchorage (stevedoring)',
                    'quantity' => 45000,
                    'unit' => 'MT',
                    'unit_price' => 10400,
                ]],
            ],
        ];
    }
}
