<?php

namespace Database\Seeders\DataPerusahaan;

use Carbon\CarbonImmutable;

/**
 * Satu invoice dari sheet 08 Invoice Jual. Baris berikutnya yang tidak punya nomor/tanggal/pelanggan
 * adalah item invoice di atasnya; baris lain dengan nomor yang sama digabung menjadi satu invoice.
 * Nominal item mengikuti kolom sheet persis: total = kolom Total (DPP + PPN), PPN = total − DPP.
 */
final class InvoiceMentah
{
    /**
     * @param  list<array{deskripsi: string, dpp: int, ppn: int, total: int, catatan: string|null}>  $item
     * @param  list<int>  $baris  nomor baris sheet asal
     * @param  list<string>  $faktur
     */
    public function __construct(
        public ?string $nomor,
        public CarbonImmutable $tanggal,
        public string $pelanggan,
        public ?string $npwp,
        public bool $lunas,
        public array $item = [],
        public array $baris = [],
        public array $faktur = [],
    ) {}

    public function dpp(): int
    {
        return array_sum(array_column($this->item, 'dpp'));
    }

    public function ppn(): int
    {
        return array_sum(array_column($this->item, 'ppn'));
    }

    public function total(): int
    {
        return array_sum(array_column($this->item, 'total'));
    }
}
