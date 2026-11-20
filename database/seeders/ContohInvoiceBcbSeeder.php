<?php

namespace Database\Seeders;

use App\Models\Client;
use App\Models\Invoice;

/**
 * Contoh lokal PT Bahtera Cipta Bersama (BCB) lengkap dengan template invoice & Debit Note-nya
 * (resources/views/pdf/perusahaan/bahtera-cipta-bersama): perusahaan BCB saja, akun khusus BCB, profil +
 * format nomor BCB (dengan {KODE}), satu klien, tiga invoice terbit untuk satu kapal yang meniru invoice Word
 * asli (FINAL stevedoring, MOORING, FENDER), dua Debit Note (talangan) — overtime hari libur seperti Debit
 * Note Word asli, dan demurrage berkolom Quantity/PRICE —, satu tagihan USD seperti PROFORMA 103 (harga USD per
 * ton, kurs manual, dibayar ke rekening USD), ditambah satu draft untuk editor. Semua datanya FIKTIF (lihat
 * ContohInvoicePerusahaanSeeder).
 *
 *   php artisan db:seed --class=ContohInvoiceBcbSeeder
 *
 * Akun (password: password) — keduanya hanya anggota BCB, jadi login langsung masuk ke BCB:
 *   admin.bcb@mitragroup.id  admin BCB (cetak, terbitkan, ubah nomor)
 *   staff.bcb@mitragroup.id  staff BCB
 */
class ContohInvoiceBcbSeeder extends ContohInvoicePerusahaanSeeder
{
    protected function company(): array
    {
        return ['slug' => 'bahtera-cipta-bersama', 'name' => 'PT Bahtera Cipta Bersama', 'abbreviation' => 'BCB'];
    }

    protected function accounts(): array
    {
        return [
            'admin.bcb@mitragroup.id' => 'admin',
            'staff.bcb@mitragroup.id' => 'staff',
        ];
    }

    protected function profile(): array
    {
        return [
            'name' => 'PT. BAHTERA CIPTA BERSAMA',
            'abbreviation' => 'BCB',
            'address' => 'Jl. Juanda 7 FA No. 02, Kelurahan Air Hitam, Kecamatan Samarinda Ulu, Kota Samarinda, Kalimantan Timur – Indonesia, 75277',
            'email' => 'pt.bahteraciptabersama@gmail.com',
            'phone' => '0895 6061 44356',
            'is_pkp' => true,
            'ppn_rate' => 11,
            // Seperti invoice Word BCB: klien memotong PPh 23 2%.
            'pph_enabled' => true,
            'pph_rate' => 2,
            // Klien luar negeri ditagih dalam USD (dokumen AVRA BCB).
            'foreign_currency_enabled' => true,
            'finance_manager_name' => 'Sri Puspita Wulani',
            'finance_manager_position' => 'Direktur Utama',
            'signature_city' => 'Samarinda',
            'bank_accounts' => [
                ['bank' => 'Bank Mandiri', 'account_number' => '148-00-2281085-0', 'account_name' => 'PT. BAHTERA CIPTA BERSAMA', 'currency' => 'IDR', 'branch' => null, 'swift' => null],
                ['bank' => 'Bank Mandiri', 'account_number' => '148-00-2885477-9', 'account_name' => 'PT. BAHTERA CIPTA BERSAMA', 'currency' => 'USD', 'branch' => 'Samarinda Sempaja Branch', 'swift' => 'BMRIIDJA'],
            ],
            'invoice_number_format' => '{NO}/{PT}-{KLIEN}/{KODE}/{BLN_ROMAWI}/{THN}',
            'invoice_number_padding' => 3,
            'invoice_number_reset' => 'yearly',
            'default_due_days' => 14,
        ];
    }

    protected function client(): array
    {
        return [
            'name' => 'PT. CONTOH BINA SAMUDRA',
            'attributes' => [
                'alias' => 'CBS',
                'type' => 'company',
                'status' => Client::STATUS_ACTIVE,
                'address' => "Gedung Contoh Lt. 12, Jl. Contoh Raya No. 5,\nSetiabudi, Jakarta Selatan 12950",
                'person_in_charge' => 'Direktur Finance & Accounting',
            ],
        ];
    }

    protected function invoices(): array
    {
        return [
            [
                'number' => '100/BCB-CBS/INV-FINAL/XI/2026',
                'code' => 'FINAL',
                'date' => '2026-11-16',
                'subject' => 'Invoice FINAL MV. CONTOH GLORY',
                'discount' => 0,
                'items' => [[
                    'service_name' => 'MV. CONTOH GLORY',
                    'description' => 'Loading Port : Muara Berau Anchorage (stevedoring)',
                    'quantity' => 50000,
                    'unit' => 'MT',
                    'unit_price' => 13700,
                ]],
            ],
            [
                'number' => '101/BCB-CBS/INV-MOORING/XI/2026',
                'code' => 'MOORING',
                'date' => '2026-11-16',
                'subject' => 'Invoice MOORING UNMOORING MV. CONTOH GLORY',
                'discount' => 0,
                'items' => [[
                    'service_name' => 'MV. CONTOH GLORY',
                    'description' => 'Loading Port : Muara Berau Anchorage (mooring)',
                    'quantity' => 50000,
                    'unit' => 'MT',
                    'unit_price' => 400,
                ]],
            ],
            [
                'number' => '102/BCB-CBS/INV-FENDER/XI/2026',
                'code' => 'FENDER',
                'date' => '2026-11-16',
                'subject' => 'Invoice FENDER MV. CONTOH GLORY',
                'discount' => 0,
                'items' => [[
                    'service_name' => 'MV. CONTOH GLORY',
                    'description' => 'Loading Port : Muara Berau Anchorage (fender)',
                    'quantity' => 50000,
                    'unit' => 'MT',
                    'unit_price' => 500,
                ]],
            ],
            // Debit Note: biaya yang BCB bayar lebih dulu atas nama klien untuk kapal yang sama, ditagih
            // kembali persis sebesar yang dibayar (talangan, tanpa PPN/PPh, bukan pendapatan). Nomornya
            // melanjutkan urutan invoice.
            [
                'number' => '103/BCB-CBS/DN-OT/XI/2026',
                'type' => Invoice::TYPE_DEBIT_NOTE,
                'code' => 'OT',
                'date' => '2026-11-18',
                'subject' => 'Debit Note Overtime Hari Libur MV. CONTOH GLORY',
                'discount' => 0,
                'items' => [[
                    'service_name' => 'Tagihan Overtime Hari Libur MV. CONTOH GLORY',
                    'quantity' => 1,
                    'unit' => 'LS',
                    'unit_price' => 27500000,
                ]],
            ],
            [
                'number' => '104/BCB-CBS/DN-DEM/XI/2026',
                'type' => Invoice::TYPE_DEBIT_NOTE,
                'code' => 'DEM',
                'date' => '2026-11-18',
                'subject' => 'Debit Note DEMURRAGE MV. CONTOH GLORY',
                'discount' => 0,
                'items' => [[
                    'service_name' => 'MV. CONTOH GLORY',
                    'description' => "On Board : 13 November 2026\nComplete : 16 November 2026\nDemurrage : 3 Hari",
                    'quantity' => 3,
                    'unit' => 'Day',
                    'unit_price' => 5000000,
                ]],
            ],
            // Tagihan USD seperti PROFORMA 103: tarif per ton dalam USD, kurs manual; utang klien $41.000,00.
            [
                'number' => '105/BCB-CBS/INV-ORBIT/XI/2026',
                'code' => 'ORBIT',
                'currency' => 'USD',
                'kurs' => 18250,
                'ppn' => 0,
                'pph' => 0,
                'date' => '2026-11-18',
                'subject' => 'Proforma Invoice MV. CONTOH FLAME',
                'discount' => 0,
                'items' => [[
                    'service_name' => 'MV. CONTOH FLAME',
                    'description' => '(Proforma Invoice)',
                    'quantity' => 50000,
                    'unit' => 'MT',
                    'foreign_unit_price' => 0.82,
                ]],
            ],
            [
                'number' => null,
                'code' => 'FINAL',
                'date' => '2026-11-19',
                'subject' => 'Invoice FINAL MV. CONTOH BAHTERA',
                'discount' => 0,
                'items' => [[
                    'service_name' => 'MV. CONTOH BAHTERA',
                    'description' => 'Loading Port : Muara Berau Anchorage (stevedoring)',
                    'quantity' => 45000,
                    'unit' => 'MT',
                    'unit_price' => 13700,
                ]],
            ],
        ];
    }
}
