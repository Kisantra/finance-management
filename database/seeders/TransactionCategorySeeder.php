<?php

namespace Database\Seeders;

use App\Models\TransactionCategory;
use Illuminate\Database\Seeder;

class TransactionCategorySeeder extends Seeder
{
    public function run(): void
    {
        // Parent categories — system_key menandai kategori sistem yang dipakai
        // otomatis oleh modul Loans/Receivables (tidak boleh diedit/dihapus user)
        $parents = [
            ['type' => 'expense', 'label' => 'Operational Expenses'],
            ['type' => 'expense', 'label' => 'PENGELUARAN LAIN-LAIN'],
            ['type' => 'expense', 'label' => 'HPP'],
            ['type' => 'expense', 'label' => 'CAPEX'],
            ['type' => 'income', 'label' => 'Penghasilan'],
            ['type' => 'transfer', 'label' => 'Transfer Internal'],
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

        foreach ($parents as $parent) {
            $category = TransactionCategory::firstOrCreate(
                ['type' => $parent['type'], 'label' => $parent['label'], 'parent_id' => null]
            );

            $patch = [];

            if (isset($parent['system_key']) && $category->system_key !== $parent['system_key']) {
                $patch['system_key'] = $parent['system_key'];
            }

            // pl_group hanya diisi bila masih kosong — klasifikasi yang sudah
            // disesuaikan pengguna lewat panel Laba Rugi tidak boleh ditimpa
            // saat seeder dijalankan ulang.
            if (isset($parent['pl_group']) && $category->pl_group === null) {
                $patch['pl_group'] = $parent['pl_group'];
            }

            if ($patch) {
                $category->forceFill($patch)->save();
            }
        }

        // Child categories: 'parent_label' => children
        $children = [
            'Operational Expenses' => [
                ['type' => 'expense', 'label' => 'MAKAN MINUM'],
                ['type' => 'expense', 'label' => 'KASBON'],
                ['type' => 'expense', 'label' => 'PAJAK PERUSAHAAN'],
                ['type' => 'expense', 'label' => 'OPERASIONAL LUAR KOTA'],
                ['type' => 'expense', 'label' => 'OPERASIONAL'],
                ['type' => 'expense', 'label' => 'OPEX BULANAN'],
            ],
            'PENGELUARAN LAIN-LAIN' => [
                ['type' => 'expense', 'label' => 'ADMIN BANK'],
                ['type' => 'expense', 'label' => 'PEMBAYARAN PIUTANG'],
            ],
            'HPP' => [
                ['type' => 'expense', 'label' => 'HPP SISTEM DIGITAL'],
                ['type' => 'expense', 'label' => 'HPP LEGAL'],
                ['type' => 'expense', 'label' => 'HPP DIGITAL MARKETING'],
                ['type' => 'expense', 'label' => 'HPP PERPAJAKAN'],
            ],
            'CAPEX' => [
                ['type' => 'expense', 'label' => 'ASET PERUSAHAAN'],
            ],
            'Penghasilan' => [
                ['type' => 'income', 'label' => 'Kembali Dana'],
            ],
        ];

        foreach ($children as $parentLabel => $childCategories) {
            $parent = TransactionCategory::where('label', $parentLabel)->whereNull('parent_id')->first();

            if ($parent) {
                foreach ($childCategories as $child) {
                    TransactionCategory::firstOrCreate(
                        ['type' => $child['type'], 'label' => $child['label'], 'parent_id' => $parent->id]
                    );
                }
            }
        }
    }
}
