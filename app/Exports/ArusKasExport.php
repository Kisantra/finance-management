<?php

namespace App\Exports;

use Carbon\Carbon;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithColumnFormatting;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Ekspor tab Arus Kas › Semua: pemasukan dan pengeluaran dalam satu lembar, urut tanggal.
 * Baris = keluaran CashFlowController::barisKas().
 */
class ArusKasExport implements FromArray, ShouldAutoSize, WithColumnFormatting, WithHeadings, WithStyles
{
    /** @param  list<array<string, mixed>>  $rows */
    public function __construct(private array $rows) {}

    /** @return list<list<mixed>> */
    public function array(): array
    {
        return array_map(fn (array $r) => [
            Carbon::parse($r['date'])->format('d/m/Y'),
            $r['direction'] === 'in' ? 'Masuk' : 'Keluar',
            $r['source_type'] === 'payment' ? 'Pembayaran invoice' : 'Transaksi langsung',
            $r['bank_name'],
            $r['source_type'] === 'payment' ? trim(($r['client_name'] ?? '').' · '.($r['invoice_number'] ?? ''), ' ·') : ($r['description'] ?? ''),
            $r['category_label'] ?? '',
            $r['input_by'] ?? 'Tidak tercatat',
            $r['direction'] === 'in' ? $r['amount'] : null,
            $r['direction'] === 'out' ? $r['amount'] : null,
            $r['reference_number'] ?? '',
        ], $this->rows);
    }

    /** @return list<string> */
    public function headings(): array
    {
        return ['Tanggal', 'Jenis', 'Sumber', 'Rekening', 'Keterangan', 'Kategori', 'Diinput oleh', 'Masuk (Rp)', 'Keluar (Rp)', 'No. Referensi'];
    }

    /** @return array<string, string> */
    public function columnFormats(): array
    {
        return ['H' => '#,##0', 'I' => '#,##0'];
    }

    /** @return array<int, array<string, mixed>> */
    public function styles(Worksheet $sheet): array
    {
        return [1 => ['font' => ['bold' => true]]];
    }
}
