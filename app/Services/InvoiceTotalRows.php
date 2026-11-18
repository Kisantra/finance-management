<?php

namespace App\Services;

use App\Models\Invoice;

/**
 * Baris total di bawah tabel item untuk template invoice per perusahaan: urutan, label bawaan,
 * nomor baris, dan nominalnya diputuskan di sini; template hanya menata tampilannya (per `jenis`).
 * Aturan baru cukup ditambahkan di sini agar semua template perusahaan ikut.
 *
 * Nominal selalu dari data tersimpan (`subtotal`, `discount_amount`, `ppn_amount`, `pph_amount`,
 * `total_amount`, pembayaran) — tidak ada hitungan pajak baru. Label berbahasa Indonesia seperti
 * seluruh isi dokumen.
 *
 * Jenis baris: `diskon`, `dpp` (total sebelum PPN/PPh), `ppn` (bernomor, melanjutkan nomor item),
 * `bruto` (total + PPN sebelum dipotong PPh, hanya bila keduanya ada), `pph` (potongan PPh 23 oleh
 * klien, bernomor), `total` (total invoice, hanya untuk tagihan uang muka/pelunasan), `diterima`
 * (pembayaran yang sudah masuk, potongan), `tagihan` (baris terakhir: GRAND TOTAL / uang muka /
 * pelunasan). Semua nominal positif; potongan tersirat dari labelnya, seperti dokumen asli.
 */
class InvoiceTotalRows
{
    /**
     * Relasi `items` dan `payments` harus sudah terpasang.
     *
     * @return list<array{jenis: string, nomor: ?int, label: string, jumlah: int}>
     */
    public static function for(Invoice $invoice, ?int $dpAmount = null, ?int $pelunasanAmount = null, ?string $dpPercentage = null): array
    {
        $discount = (int) $invoice->discount_amount;
        $ppnAmount = (int) $invoice->ppn_amount;
        $pphAmount = (int) $invoice->pph_amount;
        $dpp = max(0, (int) $invoice->subtotal - $discount);
        $nomor = $invoice->items->count();
        $rows = [];

        if ($discount > 0) {
            $reason = filled($invoice->discount_reason) ? " ({$invoice->discount_reason})" : '';
            $rows[] = self::row('diskon', "Discount{$reason}", $discount);
        }

        if ($ppnAmount > 0) {
            $rows[] = self::row('dpp', 'Total Invoice (Sebelum PPN)', $dpp);
            $rows[] = self::row('ppn', 'PPN '.self::percent($invoice->ppn_rate).'%', $ppnAmount, ++$nomor);
        }

        // Potongan PPh 23 oleh klien: total_amount (GRAND TOTAL) sudah dikurangi potongan ini.
        if ($pphAmount > 0) {
            $rows[] = $ppnAmount > 0
                ? self::row('bruto', 'Total Invoice + PPN (belum dipotong PPh)', $dpp + $ppnAmount)
                : self::row('dpp', 'Total Invoice (belum dipotong PPh)', $dpp);
            $rows[] = self::row('pph', 'PPh 23 ('.self::percent($invoice->pph_rate).'%)', $pphAmount, ++$nomor);
        }

        if ($dpAmount !== null && $dpAmount > 0) {
            $rows[] = self::row('total', 'Total Invoice', (int) $invoice->total_amount);
            $rows[] = self::row('tagihan', 'TAGIHAN UANG MUKA (DP'.($dpPercentage ? ' '.$dpPercentage : '').')', $dpAmount);
        } elseif ($pelunasanAmount !== null && $pelunasanAmount > 0) {
            $rows[] = self::row('total', 'Total Invoice', (int) $invoice->total_amount);
            $rows[] = self::row('diterima', 'Pembayaran Diterima', (int) $invoice->payments->sum('amount'));
            $rows[] = self::row('tagihan', 'TAGIHAN PELUNASAN', $pelunasanAmount);
        } else {
            $rows[] = self::row('tagihan', 'GRAND TOTAL', (int) $invoice->total_amount);
        }

        return $rows;
    }

    /**
     * @return array{jenis: string, nomor: ?int, label: string, jumlah: int}
     */
    private static function row(string $jenis, string $label, int $jumlah, ?int $nomor = null): array
    {
        return ['jenis' => $jenis, 'nomor' => $nomor, 'label' => $label, 'jumlah' => $jumlah];
    }

    /** 11.00 → "11", 1.10 → "1,1". */
    private static function percent(float|string|null $rate): string
    {
        return rtrim(rtrim(number_format((float) $rate, 2, ',', '.'), '0'), ',');
    }
}
