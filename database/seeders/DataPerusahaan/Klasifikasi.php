<?php

namespace Database\Seeders\DataPerusahaan;

/** Hasil klasifikasi satu baris arus kas: kategori sub (tipe + label) dan apakah ia penerimaan dari pelanggan. */
final readonly class Klasifikasi
{
    public function __construct(
        public string $type,
        public string $kategori,
        public bool $penerimaanPelanggan = false,
    ) {}
}
