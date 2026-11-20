<?php

namespace Database\Seeders;

use App\Models\Client;
use App\Models\Invoice;

/**
 * Contoh lokal PT Mitra Kellian Baruna (MKB) lengkap dengan template invoice & Debit Note-nya
 * (resources/views/pdf/perusahaan/mitra-kellian-baruna): perusahaan MKB saja, akun khusus MKB, profil +
 * format nomor MKB (dengan {KODE}), satu klien, tiga invoice terbit untuk satu kapal yang meniru invoice Word
 * asli (FINAL stevedoring, MOORING, FENDER), dua Debit Note (talangan) — overtime hari libur seperti Debit
 * Note Word asli, dan demurrage berkolom Quantity/PRICE —, ditambah satu draft untuk editor. Semua datanya
 * FIKTIF (lihat ContohInvoicePerusahaanSeeder).
 *
 *   php artisan db:seed --class=ContohInvoiceMkbSeeder
 *
 * Akun (password: password) — keduanya hanya anggota MKB, jadi login langsung masuk ke MKB:
 *   admin.mkb@mitragroup.id  admin MKB (cetak, terbitkan, ubah nomor)
 *   staff.mkb@mitragroup.id  staff MKB
 */
class ContohInvoiceMkbSeeder extends ContohInvoicePerusahaanSeeder
{
    protected function company(): array
    {
        return ['slug' => 'mitra-kellian-baruna', 'name' => 'PT Mitra Kellian Baruna', 'abbreviation' => 'MKB'];
    }

    protected function accounts(): array
    {
        return [
            'admin.mkb@mitragroup.id' => 'admin',
            'staff.mkb@mitragroup.id' => 'staff',
        ];
    }

    protected function profile(): array
    {
        return [
            'name' => 'PT. MITRA KELLIAN BARUNA',
            'abbreviation' => 'MKB',
            'address' => 'Perum Pondok Sambutan Permai Blok CC No.15 RT.24, Kec. Sambutan, Kota Samarinda, Kalimantan Timur 75115',
            'email' => 'pt.mitrakellianbaruna.96@gmail.com',
            'phone' => '0812 5324 784',
            'is_pkp' => true,
            'ppn_rate' => 11,
            // Seperti invoice Word MKB: klien memotong PPh 23 2%.
            'pph_enabled' => true,
            'pph_rate' => 2,
            'finance_manager_name' => 'Salam Ilham',
            'finance_manager_position' => 'Direktur Utama',
            'signature_city' => 'Samarinda',
            'bank_accounts' => [['bank' => 'Bank Mandiri', 'account_number' => '148-000-204198-9', 'account_name' => 'PT. MITRA KELLIAN BARUNA']],
            'invoice_number_format' => '{NO}/{PT}-{KLIEN}/{KODE}/{BLN_ROMAWI}/{THN}',
            'invoice_number_padding' => 3,
            'invoice_number_reset' => 'yearly',
            'default_due_days' => 14,
        ];
    }

    protected function client(): array
    {
        return [
            'name' => 'PT. CONTOH TAMBANG BERSAUDARA',
            'attributes' => [
                'alias' => 'CTB',
                'type' => 'company',
                'status' => Client::STATUS_ACTIVE,
                'address' => "Jl. Contoh Pelabuhan No. 7, Kel. Contoh Mumus, Kec. Samarinda Kota,\nKota Samarinda, Kalimantan Timur 75242",
                'person_in_charge' => 'Direktur Finance & Accounting',
            ],
        ];
    }

    protected function invoices(): array
    {
        return [
            [
                'number' => '046/MKB-CTB/INV-FINAL/X/2026',
                'code' => 'FINAL',
                'date' => '2026-10-15',
                'subject' => 'Invoice FINAL MV. CONTOH HARMONY',
                'discount' => 0,
                'items' => [[
                    'service_name' => 'MV. CONTOH HARMONY',
                    'description' => 'Loading Port : Muara Berau Anchorage (stevedoring)',
                    'quantity' => 50000,
                    'unit' => 'MT',
                    'unit_price' => 13500,
                ]],
            ],
            [
                'number' => '047/MKB-CTB/INV-MOORING/X/2026',
                'code' => 'MOORING',
                'date' => '2026-10-15',
                'subject' => 'Invoice MOORING UNMOORING MV. CONTOH HARMONY',
                'discount' => 0,
                'items' => [[
                    'service_name' => 'MV. CONTOH HARMONY',
                    'description' => 'Loading Port : Muara Berau Anchorage (mooring)',
                    'quantity' => 50000,
                    'unit' => 'MT',
                    'unit_price' => 400,
                ]],
            ],
            [
                'number' => '048/MKB-CTB/INV-FENDER/X/2026',
                'code' => 'FENDER',
                'date' => '2026-10-15',
                'subject' => 'Invoice FENDER MV. CONTOH HARMONY',
                'discount' => 0,
                'items' => [[
                    'service_name' => 'MV. CONTOH HARMONY',
                    'description' => 'Loading Port : Muara Berau Anchorage (fender)',
                    'quantity' => 50000,
                    'unit' => 'MT',
                    'unit_price' => 500,
                ]],
            ],
            // Debit Note: biaya yang MKB bayar lebih dulu atas nama klien untuk kapal yang sama, ditagih
            // kembali persis sebesar yang dibayar (talangan, tanpa PPN/PPh, bukan pendapatan). Nomornya
            // melanjutkan urutan invoice.
            [
                'number' => '049/MKB-CTB/DN-OT/X/2026',
                'type' => Invoice::TYPE_DEBIT_NOTE,
                'code' => 'OT',
                'date' => '2026-10-20',
                'subject' => 'Debit Note Overtime Hari Libur MV. CONTOH HARMONY',
                'discount' => 0,
                'items' => [[
                    'service_name' => 'Tagihan Overtime Hari Libur MV. CONTOH HARMONY',
                    'quantity' => 1,
                    'unit' => 'LS',
                    'unit_price' => 12000000,
                ]],
            ],
            [
                'number' => '050/MKB-CTB/DN-DEM/X/2026',
                'type' => Invoice::TYPE_DEBIT_NOTE,
                'code' => 'DEM',
                'date' => '2026-10-20',
                'subject' => 'Debit Note DEMURRAGE MV. CONTOH HARMONY',
                'discount' => 0,
                'items' => [[
                    'service_name' => 'MV. CONTOH HARMONY',
                    'description' => "On Board : 13 Oktober 2026\nComplete : 18 Oktober 2026\nDemurrage : 3 Hari",
                    'quantity' => 3,
                    'unit' => 'Day',
                    'unit_price' => 5000000,
                ]],
            ],
            [
                'number' => null,
                'code' => 'FINAL',
                'date' => '2026-11-12',
                'subject' => 'Invoice FINAL MV. CONTOH KELLIAN',
                'discount' => 0,
                'items' => [[
                    'service_name' => 'MV. CONTOH KELLIAN',
                    'description' => 'Loading Port : Muara Berau Anchorage (stevedoring)',
                    'quantity' => 45000,
                    'unit' => 'MT',
                    'unit_price' => 13500,
                ]],
            ],
        ];
    }
}
