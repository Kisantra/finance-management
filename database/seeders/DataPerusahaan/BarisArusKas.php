<?php

namespace Database\Seeders\DataPerusahaan;

use Carbon\CarbonImmutable;

/**
 * Satu baris tabel "B. Rincian Transaksi" di sheet 07 Arus Kas, sudah dibersihkan: tanggal terurai,
 * nominal dibulatkan ke rupiah penuh. Tepat satu dari $masuk / $keluar bernilai > 0.
 */
final readonly class BarisArusKas
{
    public function __construct(
        public int $baris,
        /** Penanda seksi di kolom A (OPS / PC / PNBP) yang berlaku untuk baris ini, atau null. */
        public ?string $seksi,
        public CarbonImmutable $tanggal,
        public string $deskripsi,
        public string $pihak,
        public int $masuk,
        public int $keluar,
        public ?string $referensi,
    ) {}

    public function nominal(): int
    {
        return $this->masuk > 0 ? $this->masuk : $this->keluar;
    }

    public function isMasuk(): bool
    {
        return $this->masuk > 0;
    }
}
