<?php

namespace Database\Seeders\DataPerusahaan;

/**
 * Isi satu berkas Template Kelengkapan Data yang sudah dibaca. $totalSheet menyimpan angka baris
 * TOTAL di sheet itu sendiri (nilai sel, belum dibulatkan) sebagai pembanding hasil impor.
 */
final readonly class DataMentah
{
    /**
     * @param  array{npwp: string|null, alamat: string|null, telepon: string|null, email: string|null}  $identitas
     * @param  list<array{bank: string, nomor: string|null, atas_nama: string|null}>  $rekening
     * @param  list<BarisArusKas>  $arusKas
     * @param  list<InvoiceMentah>  $invoices
     * @param  array{masuk: float|null, keluar: float|null, invoice: float}  $totalSheet
     * @param  list<string>  $catatan  koreksi yang dilakukan saat membaca (tanggal salah ketik, dsb.)
     */
    public function __construct(
        public string $berkas,
        public string $namaPerusahaan,
        public int $tahunBuku,
        public array $identitas,
        public array $rekening,
        public array $arusKas,
        public array $invoices,
        public array $totalSheet,
        public array $catatan,
    ) {}
}
