<?php

namespace Database\Seeders;

use App\Models\Client;

/**
 * Contoh lokal PT Samboja Laju Utama (SLU) lengkap dengan template invoicenya
 * (resources/views/pdf/perusahaan/samboja-laju-utama): perusahaan SLU saja, akun khusus SLU, profil +
 * format nomor invoice SLU, satu klien, dan tiga invoice yang meniru susunan invoice Word asli (FINAL,
 * DEMMURAGE, WAITING TKBM) ditambah satu draft untuk editor. Semua datanya FIKTIF (lihat
 * ContohInvoicePerusahaanSeeder).
 *
 *   php artisan db:seed --class=ContohInvoiceSluSeeder
 *
 * Akun (password: password) — keduanya hanya anggota SLU, jadi login langsung masuk ke SLU:
 *   admin.slu@mitragroup.id  admin SLU (cetak, terbitkan, ubah nomor)
 *   staff.slu@mitragroup.id  staff SLU (nama sama dengan akun staff MitraGroupSeeder)
 */
class ContohInvoiceSluSeeder extends ContohInvoicePerusahaanSeeder
{
    protected function company(): array
    {
        return ['slug' => 'samboja-laju-utama', 'name' => 'PT Samboja Laju Utama', 'abbreviation' => 'SLU'];
    }

    protected function accounts(): array
    {
        return [
            'admin.slu@mitragroup.id' => 'admin',
            'staff.slu@mitragroup.id' => 'staff',
        ];
    }

    protected function profile(): array
    {
        return [
            'name' => 'PT. SAMBOJA LAJU UTAMA',
            'abbreviation' => 'SLU',
            'address' => 'Jalan Raya Balikpapan – Handil II, Desa/Kelurahan Samboja Kuala, Kec. Samboja, Kab. Kutai Kartanegara, Provinsi Kalimantan Timur.',
            'email' => 'sambojalajuutama@gmail.com',
            'phone' => '0811-5513-232',
            'is_pkp' => true,
            'ppn_rate' => 11,
            'finance_manager_name' => 'Salam Ilham',
            'finance_manager_position' => 'Direktur Utama',
            'signature_city' => 'Samarinda',
            'bank_accounts' => [['bank' => 'Bank Mandiri', 'account_number' => '148-00-2346343-6', 'account_name' => 'PT. SAMBOJA LAJU UTAMA']],
            'invoice_number_format' => '{NO}/{PT}-{KLIEN}/INV/{BLN_ROMAWI}/{THN}',
            'invoice_number_padding' => 3,
            'invoice_number_reset' => 'yearly',
            'default_due_days' => 14,
        ];
    }

    protected function client(): array
    {
        return [
            'name' => 'PT. CONTOH BATUBARA NUSANTARA',
            'attributes' => [
                'alias' => 'CBN',
                'type' => 'company',
                'status' => Client::STATUS_ACTIVE,
                'address' => 'GEDUNG CONTOH LANTAI 3, JL. CONTOH RAYA NO. 10, KEBAYORAN BARU, KOTA ADM. JAKARTA SELATAN, DKI JAKARTA 12190',
                'person_in_charge' => 'Direktur Finance & Accounting',
            ],
        ];
    }

    protected function invoices(): array
    {
        return [
            [
                'number' => '037/SLU-CBN/INV-FINAL/X/2026',
                'date' => '2026-10-10',
                'subject' => 'Invoice FINAL MV. CONTOH JAYA',
                'discount' => 0,
                'items' => [[
                    'service_name' => 'MV. CONTOH JAYA',
                    'description' => "Loading Port : Muara Jawa\nAnchorage ( Stevedoring )",
                    'quantity' => 40000,
                    'unit' => 'MT',
                    'unit_price' => 12000,
                ]],
            ],
            [
                'number' => '038/SLU-CBN/INV-DEM/X/2026',
                'date' => '2026-10-10',
                'subject' => 'Invoice DEMMURAGE MV. CONTOH JAYA',
                'discount' => 0,
                'items' => [[
                    'service_name' => 'MV. CONTOH JAYA',
                    'description' => "Kontrak Kerja 8 Hari\nCommenced : 20 September 2026\nCompleted : 2 Oktober 2026\nDemmurage : 4 Hari",
                    'quantity' => 4,
                    'unit' => 'Day',
                    'unit_price' => 5000000,
                ]],
            ],
            [
                'number' => '039/SLU-CBN/INV-TKBM/X/2026',
                'date' => '2026-10-10',
                'subject' => 'Invoice WAITING TKBM MV. CONTOH JAYA',
                'discount' => 5000000,
                'items' => [[
                    'service_name' => 'Waiting TKBM Unit 7 MV. CONTOH JAYA',
                    'description' => implode("\n", [
                        '25-Sep-26',
                        '08.00 - 20.00 = 12 Jam',
                        '26-Sep-26',
                        '06.00 - 24.00 = 18 Jam',
                        '27-Sep-26',
                        '00.00 - 24.00 = 24 Jam',
                        '28-Sep-26',
                        '00.00 - 09.30 = 9 Jam 30 Menit',
                        '18.00 - 24.00 = 6 Jam',
                        '29-Sep-26',
                        '07.00 - 24.00 = 17 Jam',
                        '30-Sep-26',
                        '00.00 - 24.00 = 24 Jam',
                        '01-Oct-26',
                        '00.00 - 10.00 = 10 Jam',
                    ]),
                    'quantity' => 120.5,
                    'unit' => 'Hour',
                    'unit_price' => 100000,
                ]],
            ],
            [
                'number' => null,
                'date' => '2026-11-11',
                'subject' => 'Invoice FINAL MV. CONTOH BAHARI',
                'discount' => 0,
                'items' => [[
                    'service_name' => 'MV. CONTOH BAHARI',
                    'description' => "Loading Port : Muara Jawa\nAnchorage ( Stevedoring )",
                    'quantity' => 50000,
                    'unit' => 'MT',
                    'unit_price' => 12000,
                ]],
            ],
        ];
    }
}
