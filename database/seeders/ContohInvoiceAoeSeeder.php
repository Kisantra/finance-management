<?php

namespace Database\Seeders;

use App\Models\Client;
use App\Models\Invoice;

/**
 * Contoh lokal PT Abdi Ocean Energy (AOE) lengkap dengan template invoice & Debit Note-nya
 * (resources/views/pdf/perusahaan/abdi-ocean-energy): perusahaan AOE saja, akun khusus AOE, profil + format
 * nomor AOE (dengan {KODE}), satu klien, satu invoice FINAL stevedoring yang meniru invoice Word asli (PPN 11%,
 * dipotong PPh 23 2%), tiga Debit Note (talangan) — PNBP alat & PNBP jasa seperti Debit Note Word asli, dan
 * demurrage berkolom QUANTITY/PRICE —, ditambah satu draft untuk editor. Semua datanya FIKTIF (lihat
 * ContohInvoicePerusahaanSeeder).
 *
 *   php artisan db:seed --class=ContohInvoiceAoeSeeder
 *
 * Akun (password: password) — keduanya hanya anggota AOE, jadi login langsung masuk ke AOE:
 *   admin.aoe@mitragroup.id  admin AOE (cetak, terbitkan, ubah nomor)
 *   staff.aoe@mitragroup.id  staff AOE
 */
class ContohInvoiceAoeSeeder extends ContohInvoicePerusahaanSeeder
{
    protected function company(): array
    {
        return ['slug' => 'abdi-ocean-energy', 'name' => 'PT Abdi Ocean Energy', 'abbreviation' => 'AOE'];
    }

    protected function accounts(): array
    {
        return [
            'admin.aoe@mitragroup.id' => 'admin',
            'staff.aoe@mitragroup.id' => 'staff',
        ];
    }

    protected function profile(): array
    {
        return [
            'name' => 'PT. ABDI OCEAN ENERGY',
            'abbreviation' => 'AOE',
            'address' => 'Jl. Balikpapan – Handil II, Desa Teluk Pemedas, Kabupaten Kutai Kartanegara, Provinsi Kalimantan Timur',
            // Dokumen asli tidak mencantumkan email.
            'email' => 'aoe@example.com',
            'phone' => '0811-5513-232',
            'is_pkp' => true,
            'ppn_rate' => 11,
            // Seperti invoice Word AOE: klien memotong PPh 23 2%.
            'pph_enabled' => true,
            'pph_rate' => 2,
            'finance_manager_name' => 'Salam Ilham',
            'finance_manager_position' => 'Direktur Utama',
            'signature_city' => 'Samarinda',
            'bank_accounts' => [['bank' => 'Bank Mandiri', 'account_number' => '148-00-3122555-3', 'account_name' => 'PT. ABDI OCEAN ENERGY']],
            'invoice_number_format' => '{NO}/{PT}-{KLIEN}/{KODE}/{BLN_ROMAWI}/{THN}',
            'invoice_number_padding' => 3,
            'invoice_number_reset' => 'yearly',
            'default_due_days' => 14,
        ];
    }

    protected function client(): array
    {
        return [
            'name' => 'PT. CONTOH DAYA SAMUDRA',
            'attributes' => [
                'alias' => 'CDS',
                'type' => 'company',
                'status' => Client::STATUS_ACTIVE,
                'address' => 'Gedung Contoh Lt. 12, Jl. Contoh Sudirman Kav. 1, Karet, Tanah Abang, Kota Jakarta Pusat, DKI Jakarta 10220',
                'person_in_charge' => 'Direktur Finance & Accounting',
            ],
        ];
    }

    protected function invoices(): array
    {
        return [
            [
                'number' => '115/AOE-CDS/INV-FINAL/XI/2026',
                'code' => 'FINAL',
                'date' => '2026-11-03',
                'subject' => 'Invoice FINAL MV. CONTOH PROSPER',
                'discount' => 0,
                'items' => [[
                    'service_name' => 'MV. CONTOH PROSPER',
                    'description' => 'Loading Port : Muara Jawa Anchorage (stevedoring)',
                    'quantity' => 56000,
                    'unit' => 'MT',
                    'unit_price' => 9500,
                ]],
            ],
            // Debit Note: biaya yang AOE bayar lebih dulu atas nama klien untuk kapal yang sama, ditagih
            // kembali persis sebesar yang dibayar (talangan, tanpa PPN/PPh, bukan pendapatan). Nomornya
            // melanjutkan urutan invoice.
            [
                'number' => '116/AOE-CDS/DN-PNBP/XI/2026',
                'type' => Invoice::TYPE_DEBIT_NOTE,
                'code' => 'PNBP',
                'date' => '2026-11-03',
                'subject' => 'Debit Note PNBP ALAT MV. CONTOH PROSPER',
                'discount' => 0,
                'items' => [[
                    'service_name' => 'Tagihan PNBP ALAT MV. CONTOH PROSPER',
                    'description' => "Kode Billing: 820260000000001\nNTPN: CONTOH0000000001",
                    'quantity' => 1,
                    'unit' => 'LS',
                    'unit_price' => 18500000,
                ]],
            ],
            [
                'number' => '117/AOE-CDS/DN-PNBP/XI/2026',
                'type' => Invoice::TYPE_DEBIT_NOTE,
                'code' => 'PNBP',
                'date' => '2026-11-03',
                'subject' => 'Debit Note PNBP JASA MV. CONTOH PROSPER',
                'discount' => 0,
                'items' => [[
                    'service_name' => 'Tagihan PNBP JASA MV. CONTOH PROSPER',
                    'description' => "Kode Billing: 820260000000002\nNTPN: CONTOH0000000002",
                    'quantity' => 1,
                    'unit' => 'LS',
                    'unit_price' => 25000000,
                ]],
            ],
            [
                'number' => '118/AOE-CDS/DN-DEM/XI/2026',
                'type' => Invoice::TYPE_DEBIT_NOTE,
                'code' => 'DEM',
                'date' => '2026-11-05',
                'subject' => 'Debit Note DEMURRAGE MV. CONTOH PROSPER',
                'discount' => 0,
                'items' => [[
                    'service_name' => 'MV. CONTOH PROSPER',
                    'description' => "On Board : 30 Oktober 2026\nComplete : 4 November 2026\nDemurrage : 3 Hari",
                    'quantity' => 3,
                    'unit' => 'Day',
                    'unit_price' => 5000000,
                ]],
            ],
            [
                'number' => null,
                'code' => 'FINAL',
                'date' => '2026-11-18',
                'subject' => 'Invoice FINAL MV. CONTOH OCEAN',
                'discount' => 0,
                'items' => [[
                    'service_name' => 'MV. CONTOH OCEAN',
                    'description' => 'Loading Port : Muara Jawa Anchorage (stevedoring)',
                    'quantity' => 48000,
                    'unit' => 'MT',
                    'unit_price' => 9500,
                ]],
            ],
        ];
    }
}
