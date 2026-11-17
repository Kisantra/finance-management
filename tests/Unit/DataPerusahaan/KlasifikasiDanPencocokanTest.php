<?php

namespace Tests\Unit\DataPerusahaan;

use Carbon\CarbonImmutable;
use Database\Seeders\DataPerusahaan\BarisArusKas;
use Database\Seeders\DataPerusahaan\InvoiceMentah;
use Database\Seeders\DataPerusahaan\KlasifikasiArusKas;
use Database\Seeders\DataPerusahaan\NamaPihak;
use Database\Seeders\DataPerusahaan\PencocokanPenerimaan;
use PHPUnit\Framework\TestCase;

/**
 * Aturan klasifikasi baris Arus Kas dan pencocokan penerimaan ke invoice (DataPerusahaanSeeder).
 * Nama orang/kapal/pelanggan di sini fiktif; polanya meniru data mentah asli.
 */
class KlasifikasiDanPencocokanTest extends TestCase
{
    private const GRUP = ['PT Mitra Trisula Amanah', 'PT Nusantara Armada Indonesia'];

    public function test_dana_ke_staf_lalu_dibayarkan_staf_tidak_terhitung_dua_kali_sebagai_biaya(): void
    {
        $keStaf = self::baris(1, '2025-01-28', 'DP FOREMAN MR. AHMAD - MV. CONTOH JAYA', 'PT. AOE -> SITI', keluar: 3_000_000);
        $olehStaf = self::baris(2, '2025-01-28', 'DP FOREMAN MR. AHMAD - MV. CONTOH JAYA', 'SITI -> AHMAD', keluar: 3_000_000);
        $refund = self::baris(3, '2025-01-30', 'REFUND KELEBIHAN PENGAJUAN DANA PNBP', 'SITI (FINANCE) -> PT. AOE', masuk: 500_000);
        $klasifikasi = self::klasifikasi([$keStaf, $olehStaf, $refund]);

        $this->assertSame(['financing', 'Dana Operasional ke Staf'], self::hasil($klasifikasi, $keStaf));
        $this->assertSame(['expense', 'Foreman, Tally & Lembur Lapangan'], self::hasil($klasifikasi, $olehStaf));
        $this->assertSame(['financing', 'Pengembalian Dana dari Staf'], self::hasil($klasifikasi, $refund));
    }

    public function test_gaji_untuk_staf_itu_sendiri_tetap_biaya(): void
    {
        $gaji = self::baris(1, '2025-02-01', 'GAJI KARYAWAN PERIODE JANUARI', 'PT. AOE -> SITI (FINANCE)', keluar: 5_000_000);

        $this->assertSame(['expense', 'Gaji Karyawan'], self::hasil(self::klasifikasi([$gaji]), $gaji));
    }

    public function test_biaya_holding_kontribusi_bagi_anggota_grup_dan_gaji_bagi_holding(): void
    {
        $kontribusi = self::baris(1, '2025-05-28', 'GAJI KARYAWAN HOLDING PERIODE MEI', 'PT. AOE -> PT. MITRA TRISULA AMANAH', keluar: 25_000_000);
        $this->assertSame(['expense', 'Kontribusi Biaya Holding'], self::hasil(self::klasifikasi([$kontribusi]), $kontribusi));

        $gajiHolding = self::baris(1, '2025-05-28', 'Gaji Staff Holding Periode Mei', 'PT. MTA -> STAFF HOLDING', keluar: 145_000_000);
        $holding = new KlasifikasiArusKas('PT MITRA TRISULA AMANAH', 'MTA', [$gajiHolding], holding: true);
        $this->assertSame(['expense', 'Gaji Karyawan'], self::hasil($holding, $gajiHolding));
    }

    public function test_kata_kunci_operasional_bank_dan_pajak(): void
    {
        $kasus = [
            ['MOORING UN MOORING - MV. CONTOH JAYA', 'BUDIMAN', 'keluar', ['expense', 'Mooring & Unmooring']],
            ['SEWA ALAT BERAT MV. CONTOH JAYA', 'PT. NUSANTARA ARMADA INDONESIA', 'keluar', ['expense', 'Sewa Alat Berat']],
            ['PELUNASAN TKBM INV NO. 012 MV. CONTOH JAYA', 'KOPERASI TKBM CONTOH', 'keluar', ['expense', 'Upah TKBM (Bongkar Muat)']],
            ['PEMBAYARAN BILLING PNBP JASA BARANG MV. CONTOH', 'SITI (FINANCE) -> DINAS PERHUBUNGAN', 'keluar', ['expense', 'PNBP Kepelabuhanan']],
            ['BIAYA OPERASIONAL (CB) - MV. CONTOH JAYA', 'BUDIMAN', 'keluar', ['expense', 'Komisi Penjualan']],
            ['PEMBAYARAN PAJAK PPN MASA MEI', 'DJP', 'keluar', ['financing', 'Setor PPN']],
            ['BILLING PPH 21 PERIODE MEI', 'PAJAK', 'keluar', ['expense', 'PPh 21 Karyawan']],
            ['BIAYA IURAN ADMINIST MCM InhouseTrf KE ASOSIASI', 'ASOSIASI PERUSAHAAN BONGKAR MUAT INDONESIA', 'keluar', ['expense', 'Iuran Asosiasi (APBMI)']],
            ['REFUND INVOICE AD COST MV. CONTOH', 'RINA DWIFIANTI', 'keluar', ['expense', 'Beban Lainnya']],
            ['REIMBURSEMENT PAK SUSANTO BULAN MEI', 'SUSANTO WIJAYA', 'keluar', ['expense', 'Biaya Operasional Direksi']],
            ['Biaya Admin', 'BANK MANDIRI', 'keluar', ['expense', 'Biaya Administrasi Bank']],
            ['BUNGA BANK', 'BANK MANDIRI', 'masuk', ['income', 'Bunga & Jasa Giro Bank']],
            ['AMPRAH 1 + DP FOREMAN MV. CONTOH JAYA', 'RUDI', 'masuk', ['financing', 'Isi Ulang Kas & Dana Operasional']],
            ['Terima Dana U/ Gaji Staff Holding Periode Mei', 'PT. NUSANTARA ARMADA INDONESIA', 'masuk', ['income', 'Penggantian Biaya Grup']],
            ['SALDO AKHIR MARET 2025 - SALDO AWAL APRIL 2025', 'BANK MANDIRI', 'masuk', ['financing', 'Saldo Pindahan Periode']],
        ];

        foreach ($kasus as [$deskripsi, $pihak, $arah, $harap]) {
            $baris = $arah === 'masuk'
                ? self::baris(1, '2025-05-01', $deskripsi, $pihak, masuk: 1_000_000)
                : self::baris(1, '2025-05-01', $deskripsi, $pihak, keluar: 1_000_000);

            $this->assertSame($harap, self::hasil(self::klasifikasi([$baris]), $baris), $deskripsi);
        }
    }

    public function test_pemasukan_dari_badan_usaha_adalah_penerimaan_pelanggan(): void
    {
        $terima = self::baris(1, '2025-06-12', 'TERIMA PEMBAYARAN INVOICE MV. CONTOH JAYA', 'PT. CONTOH PELAYARAN', masuk: 500_000_000);

        $this->assertTrue(self::klasifikasi([$terima])->klasifikasi($terima)->penerimaanPelanggan);
    }

    public function test_dp_dan_pelunasan_dipasangkan_ke_invoice_yang_sama_meski_bulan_romawi_berbeda(): void
    {
        $invoice = self::invoice('001/LNS-CP/VII/2025', '2025-07-30', 'PT. CONTOH PELAYARAN', 'JASA PANDU MV. CONTOH JAYA', 100_000_000);
        $dp = self::baris(1, '2025-08-07', 'PEMBAYARAN DP 80% MV. CONTOH JAYA - INV. 001/LNS-CP/VIII/2025', 'PT. CONTOH PELAYARAN', masuk: 80_000_000);
        $lunas = self::baris(2, '2025-10-27', 'PELUNASAN 20% MV. CONTOH JAYA - INV. 001/LNS-CP/VIII/2025', 'PT. CONTOH PELAYARAN', masuk: 20_000_000);

        $pencocokan = new PencocokanPenerimaan([$invoice]);
        $hasil = $pencocokan->cocokkan([$dp, $lunas]);

        $this->assertSame([['invoice' => 0, 'jumlah' => 80_000_000]], $hasil['alokasi'][0]);
        $this->assertSame([['invoice' => 0, 'jumlah' => 20_000_000]], $hasil['alokasi'][1]);
        $this->assertSame([0 => 0], $pencocokan->sisaTagihan());
    }

    public function test_nama_kapal_salah_ketik_satu_huruf_tetap_cocok(): void
    {
        $invoice = self::invoice('006/LNS-CP/VIII/2025', '2025-08-21', 'PT. CONTOH PELAYARAN', 'JASA PANDU MV. CONTOH JAYA', 50_000_000);
        $terima = self::baris(1, '2025-12-05', 'PELUNASAN 20% MV. CONTOH JAYO', 'PT. CONTOH PELAYARAN', masuk: 10_000_000);

        $hasil = (new PencocokanPenerimaan([$invoice]))->cocokkan([$terima]);

        $this->assertSame([['invoice' => 0, 'jumlah' => 10_000_000]], $hasil['alokasi'][0]);
    }

    public function test_sisa_penerimaan_dibedakan_menurut_rujukannya(): void
    {
        $invoice = self::invoice('001/LNS-CP/I/2025', '2025-01-10', 'PT. CONTOH PELAYARAN', 'JASA MV. CONTOH JAYA', 10_000_000);
        $dobel = self::baris(1, '2025-02-01', 'PELUNASAN MV. CONTOH JAYA - INV. 001/LNS-CP/I/2025', 'PT. CONTOH PELAYARAN', masuk: 15_000_000);
        $milikLain = self::baris(2, '2025-02-02', 'PELUNASAN MV. KAPAL LAIN - INV. 005/AOE-XYZ/I/2025', 'PT. CONTOH PELAYARAN', masuk: 2_000_000);
        $tanpaRujukan = self::baris(3, '2025-02-03', 'TERIMA TRANSFER', 'PT. PELANGGAN BARU', masuk: 3_000_000);

        $hasil = (new PencocokanPenerimaan([$invoice]))->cocokkan([$dobel, $milikLain, $tanpaRujukan]);

        $this->assertSame(5_000_000, $hasil['sisa'][0]);
        $this->assertSame(PencocokanPenerimaan::SISA_BELUM_TERIDENTIFIKASI, $hasil['jenisSisa'][0]);
        $this->assertSame(PencocokanPenerimaan::SISA_TITIPAN, $hasil['jenisSisa'][1]);
        $this->assertSame(PencocokanPenerimaan::SISA_PENDAPATAN, $hasil['jenisSisa'][2]);
    }

    public function test_alias_hanya_dari_kode_yang_singkatan_nama_klien(): void
    {
        $this->assertTrue(NamaPihak::singkatanDari('CSM', 'PT. CONTOH SAMUDRA MANDIRI'));
        $this->assertTrue(NamaPihak::singkatanDari('PLM', 'PT. PERUSAHAAN BONGKAR MUAT PUTRALAUT MANDIRI'));
        $this->assertFalse(NamaPihak::singkatanDari('XYZ', 'PT. CONTOH PELAYARAN'), 'kode lokasi');
        $this->assertTrue(NamaPihak::sama(NamaPihak::kunci('PT. PUTRA LAUT JAYA TAMA'), NamaPihak::kunci('PUTRA LAUT JAYATAMA')));
    }

    /** @param  list<BarisArusKas>  $semua */
    private static function klasifikasi(array $semua): KlasifikasiArusKas
    {
        return new KlasifikasiArusKas('PT ABDI OCEAN ENERGY', 'AOE', $semua, grup: self::GRUP, direksi: ['SUSANTO WIJAYA']);
    }

    /** @return array{0: string, 1: string} */
    private static function hasil(KlasifikasiArusKas $klasifikasi, BarisArusKas $baris): array
    {
        $hasil = $klasifikasi->klasifikasi($baris);

        return [$hasil->type, $hasil->kategori];
    }

    private static function baris(int $nomor, string $tanggal, string $deskripsi, string $pihak, int $masuk = 0, int $keluar = 0): BarisArusKas
    {
        return new BarisArusKas($nomor, null, CarbonImmutable::parse($tanggal), $deskripsi, $pihak, $masuk, $keluar, null);
    }

    private static function invoice(string $nomor, string $tanggal, string $pelanggan, string $deskripsi, int $total): InvoiceMentah
    {
        return new InvoiceMentah($nomor, CarbonImmutable::parse($tanggal), $pelanggan, null, false, [
            ['deskripsi' => $deskripsi, 'dpp' => $total, 'ppn' => 0, 'total' => $total, 'catatan' => null],
        ]);
    }
}
