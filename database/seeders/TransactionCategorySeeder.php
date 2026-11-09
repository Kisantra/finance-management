<?php

namespace Database\Seeders;

use App\Models\TransactionCategory;
use App\Services\CategoryTemplateService;
use Illuminate\Database\Seeder;

/**
 * Kategori awal perusahaan baru. Dijalankan pipeline provisioning lewat
 * TenantDatabaseSeeder; deploy TIDAK menjalankannya, jadi perusahaan yang sudah
 * ada tidak berubah (mereka memakai tombol Pakai Template). Idempoten.
 *
 * Isi: kategori sistem modul Utang/Piutang, Setoran & Penarikan Modal,
 * Transfer Internal → Antar Rekening Sendiri, lalu template kategori lewat
 * CategoryTemplateService — sumber yang sama dengan tombol Pakai Template.
 */
class TransactionCategorySeeder extends Seeder
{
    /**
     * Kategori induk di luar template. system_key menandai kategori sistem yang dipakai
     * otomatis oleh modul Utang/Piutang (tidak boleh diedit/dihapus pengguna).
     *
     * @var list<array{type: string, label: string, system_key?: string, pl_group?: string}>
     */
    private const KATEGORI_TETAP = [
        ['type' => 'financing', 'label' => 'Penerimaan Pinjaman', 'system_key' => 'FIN-LOAN-IN'],
        ['type' => 'financing', 'label' => 'Pembayaran Pokok Pinjaman', 'system_key' => 'FIN-LOAN-OUT'],
        ['type' => 'financing', 'label' => 'Setoran Modal'],
        ['type' => 'financing', 'label' => 'Penarikan Modal'],
        ['type' => 'financing', 'label' => 'Piutang Diberikan', 'system_key' => 'FIN-RCV-OUT'],
        ['type' => 'financing', 'label' => 'Pembayaran Piutang Diterima', 'system_key' => 'FIN-RCV-IN'],
        // pl_group WAJIB terisi: tanpa ini bunga pinjaman & bunga piutang
        // jatuh ke bucket "belum diklasifikasi" dan tidak pernah masuk baris
        // Beban Lain / Pendapatan Lain di Laporan Laba Rugi.
        ['type' => 'expense', 'label' => 'Beban Bunga Pinjaman', 'system_key' => 'EXP-INTEREST', 'pl_group' => 'other_expense'],
        ['type' => 'income', 'label' => 'Pendapatan Bunga', 'system_key' => 'REV-INTEREST', 'pl_group' => 'other_income'],
    ];

    public function run(CategoryTemplateService $template): void
    {
        foreach (self::KATEGORI_TETAP as $kategori) {
            $category = TransactionCategory::firstOrCreate(
                ['type' => $kategori['type'], 'label' => $kategori['label'], 'parent_id' => null]
            );

            $patch = [];

            if (isset($kategori['system_key']) && $category->system_key !== $kategori['system_key']) {
                $patch['system_key'] = $kategori['system_key'];
            }

            // pl_group hanya diisi bila masih kosong — klasifikasi yang sudah
            // disesuaikan pengguna lewat panel Laba Rugi tidak boleh ditimpa
            // saat seeder dijalankan ulang.
            if (isset($kategori['pl_group']) && $category->pl_group === null) {
                $patch['pl_group'] = $kategori['pl_group'];
            }

            if ($patch) {
                $category->forceFill($patch)->save();
            }
        }

        // WAJIB ada minimal satu anak. Pemilih kategori hanya menawarkan
        // kategori ANAK — induknya dirender sebagai baris non-aktif. Selama
        // "Transfer Internal" tidak punya anak, pemilih di dialog Transfer
        // tampil kosong dan transfer antar rekening MUSTAHIL dilakukan di
        // perusahaan yang baru dibuat. Ditemukan QC 2026-11-03.
        $transfer = TransactionCategory::firstOrCreate(
            ['type' => 'transfer', 'label' => 'Transfer Internal', 'parent_id' => null]
        );
        TransactionCategory::firstOrCreate(
            ['type' => 'transfer', 'label' => 'Antar Rekening Sendiri', 'parent_id' => $transfer->id]
        );

        $hasil = $template->apply();

        $this->command?->info("Template kategori: {$hasil['created']} dibuat, {$hasil['existing']} sudah ada, {$hasil['skipped']} dilewati.");
    }
}
