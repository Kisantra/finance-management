<?php

namespace Database\Seeders;

use App\Models\Client;
use App\Models\Invoice;

/**
 * Contoh lokal PT Namora Berlian Mahakam (NBM) lengkap dengan template invoice & Debit Note-nya
 * (resources/views/pdf/perusahaan/namora-berlian-mahakam): perusahaan NBM saja, akun khusus NBM, profil + format
 * nomor NBM (dengan {KODE}), satu klien, tiga invoice untuk satu kapal seperti lembar Excel asli — FINAL bertarif
 * USD (kurs & tarif tercetak di blok klien), MOORING, FENDER; semuanya PPN 11% dan dipotong PPh 23 2% —, dua Debit
 * Note (talangan) — overtime seperti lembar DN asli dan demurrage berkolom QUANTITY/PRICE —, ditambah satu draft
 * untuk editor. Semua datanya FIKTIF (lihat ContohInvoicePerusahaanSeeder).
 *
 *   php artisan db:seed --class=ContohInvoiceNbmSeeder
 *
 * Akun (password: password) — keduanya hanya anggota NBM, jadi login langsung masuk ke NBM:
 *   admin.nbm@mitragroup.id  admin NBM (cetak, terbitkan, ubah nomor)
 *   staff.nbm@mitragroup.id  staff NBM
 */
class ContohInvoiceNbmSeeder extends ContohInvoicePerusahaanSeeder
{
    protected function company(): array
    {
        return ['slug' => 'namora-berlian-mahakam', 'name' => 'PT Namora Berlian Mahakam', 'abbreviation' => 'NBM'];
    }

    protected function accounts(): array
    {
        return [
            'admin.nbm@mitragroup.id' => 'admin',
            'staff.nbm@mitragroup.id' => 'staff',
        ];
    }

    protected function profile(): array
    {
        return [
            'name' => 'PT. NAMORA BERLIAN MAHAKAM',
            'abbreviation' => 'NBM',
            'address' => "Jl. Embun Suryana Perum Puri Mas Asri Blok G2, Nomor 04, RT.037\nSambutan, Kota Samarinda, Kalimantan Timur 75115",
            'email' => 'namoraberlianmahakam@gmail.com',
            'phone' => '0813-5125-6951',
            'is_pkp' => true,
            'ppn_rate' => 11,
            // Seperti invoice Excel NBM: klien memotong PPh 23 2%.
            'pph_enabled' => true,
            'pph_rate' => 2,
            'finance_manager_name' => 'Aden Prabowo',
            'finance_manager_position' => 'Direktur',
            'signature_city' => 'Samarinda',
            'bank_accounts' => [['bank' => 'MANDIRI', 'branch' => 'Samarinda', 'account_number' => '148-00-7255555-3', 'account_name' => 'PT. Namora Berlian Mahakam']],
            // Invoice FINAL bertarif USD (Rate Stevedoring $ × kurs).
            'foreign_currency_enabled' => true,
            // Contoh Debit Note ikut dibuat: sakelar Debit Note di Profil perusahaan menyala.
            'debit_note_enabled' => true,
            'invoice_number_format' => '{NO}/{PT}-{KLIEN}/{KODE}/{BLN_ROMAWI}/{THN}',
            'invoice_number_padding' => 3,
            'invoice_number_reset' => 'yearly',
            'default_due_days' => 14,
        ];
    }

    protected function client(): array
    {
        return [
            'name' => 'PT. CONTOH PELABUHAN MAHAKAM',
            'attributes' => [
                'alias' => 'CPM',
                'type' => 'company',
                'status' => Client::STATUS_ACTIVE,
                'address' => "Jl. Contoh Pelabuhan No. 1, Karang Mumus, Kec. Samarinda Kota,\nKota Samarinda, Kalimantan Timur 75242",
                'person_in_charge' => 'Direktur Finance & Accounting',
            ],
        ];
    }

    protected function invoices(): array
    {
        return [
            // 50.000 MT × ($0,75 × kurs 17.813 = Rp 13.359,75) = Rp 667.987.500, seperti invoice FINAL asli.
            [
                'number' => '008/NBM-CPM/INV-FINAL/XI/2026',
                'code' => 'FINAL',
                'date' => '2026-11-03',
                'subject' => 'Invoice FINAL MV. CONTOH CAPELLA',
                'discount' => 0,
                'kurs' => 17813,
                'items' => [[
                    'service_name' => 'MV. CONTOH CAPELLA',
                    'description' => "Loading Port : Muara Berau Anchorage\n(Stevedoring)",
                    'quantity' => 50000,
                    'unit' => 'MT',
                    'foreign_unit_price' => 0.75,
                ]],
            ],
            [
                'number' => '009/NBM-CPM/INV-MOORING/XI/2026',
                'code' => 'MOORING',
                'date' => '2026-11-03',
                'subject' => 'Invoice MOORING UNMOORING MV. CONTOH CAPELLA',
                'discount' => 0,
                'items' => [[
                    'service_name' => 'MV. CONTOH CAPELLA',
                    'description' => "Loading Port : Muara Berau Anchorage\n(Mooring)",
                    'quantity' => 50000,
                    'unit' => 'MT',
                    'unit_price' => 400,
                ]],
            ],
            [
                'number' => '010/NBM-CPM/INV-FENDER/XI/2026',
                'code' => 'FENDER',
                'date' => '2026-11-03',
                'subject' => 'Invoice FENDER MV. CONTOH CAPELLA',
                'discount' => 0,
                'items' => [[
                    'service_name' => 'MV. CONTOH CAPELLA',
                    'description' => "Loading Port : Muara Berau Anchorage\n(Fender)",
                    'quantity' => 50000,
                    'unit' => 'MT',
                    'unit_price' => 500,
                ]],
            ],
            // Debit Note: biaya yang NBM bayar lebih dulu atas nama klien, ditagih kembali persis sebesar yang
            // dibayar (talangan, tanpa PPN/PPh, bukan pendapatan). Nomornya melanjutkan urutan invoice.
            [
                'number' => '011/NBM-CPM/DN-OT/XI/2026',
                'type' => Invoice::TYPE_DEBIT_NOTE,
                'code' => 'OT',
                'date' => '2026-11-04',
                'subject' => 'Debit Note Overtime 1 November 2026 MV. CONTOH CAPELLA',
                'discount' => 0,
                'items' => [[
                    'service_name' => 'Tagihan Overtime 1 November 2026 MV. CONTOH CAPELLA',
                    'quantity' => 1,
                    'unit' => 'LS',
                    'unit_price' => 25000000,
                ]],
            ],
            [
                'number' => '012/NBM-CPM/DN-DEM/XI/2026',
                'type' => Invoice::TYPE_DEBIT_NOTE,
                'code' => 'DEM',
                'date' => '2026-11-05',
                'subject' => 'Debit Note DEMURRAGE MV. CONTOH CAPELLA',
                'discount' => 0,
                'items' => [[
                    'service_name' => 'MV. CONTOH CAPELLA',
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
                'subject' => 'Invoice FINAL MV. CONTOH BARITO',
                'discount' => 0,
                'kurs' => 17813,
                'items' => [[
                    'service_name' => 'MV. CONTOH BARITO',
                    'description' => "Loading Port : Muara Berau Anchorage\n(Stevedoring)",
                    'quantity' => 48000,
                    'unit' => 'MT',
                    'foreign_unit_price' => 0.75,
                ]],
            ],
        ];
    }
}
