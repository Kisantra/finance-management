<?php

namespace App\Http\Requests\Concerns;

use App\Models\TransactionCategory;

/**
 * Aturan kategori untuk transaksi Pemasukan/Pengeluaran yang dicatat atau diubah manual
 * (Store/UpdateBankTransactionRequest). Satu tempat agar pencatatan dan pengubahan tidak berbeda.
 */
trait MemeriksaKategoriTransaksi
{
    /**
     * Pesan galat bila kategori tidak boleh dipakai untuk transaksi `$tipe` (credit/debit), atau null.
     *
     * - Kategori sistem (pokok utang/piutang, bunga) dipakai otomatis modul Utang/Piutang.
     * - Kategori yang PUNYA ANAK adalah judul grup. Kategori datar tanpa anak tetap sah — kecuali
     *   pendanaan, yang wajib sub: induk pendanaan yang dipakai langsung membuat Pakai Template
     *   melewati grupnya (penjaga induk), dan pemilih memang hanya menawarkan sub.
     * - Tipe harus searah: `income` untuk masuk, `expense` untuk keluar. `financing` boleh dua arah
     *   (setoran modal masuk, prive keluar) dan tidak masuk Laba Rugi. `transfer` tetap diterima
     *   seperti sebelumnya.
     */
    protected function pesanKategoriTidakSah(TransactionCategory $kategori, string $tipe): ?string
    {
        if ($kategori->isSystem()) {
            return __('Kategori ":nama" dipakai otomatis oleh modul Utang/Piutang dan tidak bisa dipilih di sini. Catat lewat menu Utang atau Piutang.', ['nama' => $kategori->label]);
        }

        if ($kategori->children()->exists()) {
            return __('Kategori ":nama" adalah kategori induk. Pilih salah satu subkategorinya.', ['nama' => $kategori->label]);
        }

        if ($kategori->type === 'financing') {
            return $kategori->parent_id === null
                ? __('Kategori ":nama" adalah kategori induk pendanaan. Pilih subkategorinya; bila belum ada, tambahkan lewat Pakai Template atau halaman Kategori Transaksi.', ['nama' => $kategori->label])
                : null;
        }

        $diharapkan = $tipe === 'credit' ? 'income' : 'expense';

        if ($kategori->type && $kategori->type !== $diharapkan && $kategori->type !== 'transfer') {
            return $tipe === 'credit'
                ? __('Kategori pemasukan atau pendanaan diperlukan untuk transaksi masuk.')
                : __('Kategori pengeluaran atau pendanaan diperlukan untuk transaksi keluar.');
        }

        return null;
    }
}
