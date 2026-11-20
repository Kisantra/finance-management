<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Payment;
use App\Services\InvoiceTotalRows;
use Tests\TestCase;

/**
 * Baris total template invoice per perusahaan disusun sistem: template hanya menata tampilannya.
 * Nominal dari data tersimpan invoice, tanpa hitungan pajak baru.
 */
class InvoiceTotalRowsTest extends TestCase
{
    public function test_invoice_ber_ppn_tanpa_diskon(): void
    {
        $this->assertSame([
            ['jenis' => 'dpp', 'nomor' => null, 'label' => 'Total Invoice (Sebelum PPN)', 'jumlah' => 520_000_000, 'mata_uang' => 'IDR'],
            ['jenis' => 'ppn', 'nomor' => 2, 'label' => 'PPN 11%', 'jumlah' => 57_200_000, 'mata_uang' => 'IDR'],
            ['jenis' => 'tagihan', 'nomor' => null, 'label' => 'GRAND TOTAL', 'jumlah' => 577_200_000, 'mata_uang' => 'IDR'],
        ], InvoiceTotalRows::for($this->invoice()));
    }

    public function test_diskon_dan_nomor_ppn_melanjutkan_nomor_item(): void
    {
        $invoice = $this->invoice(discount: 20_000_000, reason: 'Potongan waiting', items: 3);

        $this->assertSame([
            ['jenis' => 'diskon', 'nomor' => null, 'label' => 'Discount (Potongan waiting)', 'jumlah' => 20_000_000, 'mata_uang' => 'IDR'],
            ['jenis' => 'dpp', 'nomor' => null, 'label' => 'Total Invoice (Sebelum PPN)', 'jumlah' => 500_000_000, 'mata_uang' => 'IDR'],
            ['jenis' => 'ppn', 'nomor' => 4, 'label' => 'PPN 11%', 'jumlah' => 55_000_000, 'mata_uang' => 'IDR'],
            ['jenis' => 'tagihan', 'nomor' => null, 'label' => 'GRAND TOTAL', 'jumlah' => 555_000_000, 'mata_uang' => 'IDR'],
        ], InvoiceTotalRows::for($invoice));
    }

    public function test_tanpa_ppn_hanya_grand_total_dan_tarif_pecahan_berformat_indonesia(): void
    {
        $this->assertSame(
            [['jenis' => 'tagihan', 'nomor' => null, 'label' => 'GRAND TOTAL', 'jumlah' => 520_000_000, 'mata_uang' => 'IDR']],
            InvoiceTotalRows::for($this->invoice(ppnRate: 0)),
        );

        // Invoice lama sebelum fitur PPN (ppn_rate NULL) juga tanpa baris PPN.
        $this->assertSame(['tagihan'], array_column(InvoiceTotalRows::for($this->invoice(ppnRate: null)), 'jenis'));

        $this->assertSame('PPN 1,1%', InvoiceTotalRows::for($this->invoice(ppnRate: 1.1))[1]['label']);
    }

    /** Persis invoice SLU asli: PPN lalu potongan PPh 23, nomor melanjutkan nomor item. */
    public function test_potongan_pph_23_setelah_ppn(): void
    {
        $this->assertSame([
            ['jenis' => 'dpp', 'nomor' => null, 'label' => 'Total Invoice (Sebelum PPN)', 'jumlah' => 30_000_000, 'mata_uang' => 'IDR'],
            ['jenis' => 'ppn', 'nomor' => 2, 'label' => 'PPN 11%', 'jumlah' => 3_300_000, 'mata_uang' => 'IDR'],
            ['jenis' => 'bruto', 'nomor' => null, 'label' => 'Total Invoice + PPN (belum dipotong PPh)', 'jumlah' => 33_300_000, 'mata_uang' => 'IDR'],
            ['jenis' => 'pph', 'nomor' => 3, 'label' => 'PPh 23 (2%)', 'jumlah' => 600_000, 'mata_uang' => 'IDR'],
            ['jenis' => 'tagihan', 'nomor' => null, 'label' => 'GRAND TOTAL', 'jumlah' => 32_700_000, 'mata_uang' => 'IDR'],
        ], InvoiceTotalRows::for($this->invoice(pphRate: 2, subtotal: 30_000_000)));
    }

    public function test_potongan_pph_tanpa_ppn_dan_tarif_pecahan(): void
    {
        $this->assertSame([
            ['jenis' => 'dpp', 'nomor' => null, 'label' => 'Total Invoice (belum dipotong PPh)', 'jumlah' => 520_000_000, 'mata_uang' => 'IDR'],
            ['jenis' => 'pph', 'nomor' => 2, 'label' => 'PPh 23 (0,5%)', 'jumlah' => 2_600_000, 'mata_uang' => 'IDR'],
            ['jenis' => 'tagihan', 'nomor' => null, 'label' => 'GRAND TOTAL', 'jumlah' => 517_400_000, 'mata_uang' => 'IDR'],
        ], InvoiceTotalRows::for($this->invoice(ppnRate: 0, pphRate: 0.5)));
    }

    public function test_uang_muka_dari_total_setelah_potongan_pph(): void
    {
        $rows = InvoiceTotalRows::for($this->invoice(pphRate: 2, subtotal: 30_000_000), dpAmount: 16_350_000, dpPercentage: '55%');

        $this->assertSame(['dpp', 'ppn', 'bruto', 'pph', 'total', 'tagihan'], array_column($rows, 'jenis'));
        $this->assertSame(32_700_000, $rows[4]['jumlah']);
    }

    public function test_tagihan_uang_muka(): void
    {
        $rows = InvoiceTotalRows::for($this->invoice(), dpAmount: 200_000_000, dpPercentage: '38%');

        $this->assertSame(['dpp', 'ppn', 'total', 'tagihan'], array_column($rows, 'jenis'));
        $this->assertSame(['jenis' => 'total', 'nomor' => null, 'label' => 'Total Invoice', 'jumlah' => 577_200_000, 'mata_uang' => 'IDR'], $rows[2]);
        $this->assertSame(['jenis' => 'tagihan', 'nomor' => null, 'label' => 'TAGIHAN UANG MUKA (DP 38%)', 'jumlah' => 200_000_000, 'mata_uang' => 'IDR'], $rows[3]);
    }

    public function test_tagihan_pelunasan_memuat_pembayaran_diterima(): void
    {
        $invoice = $this->invoice();
        $invoice->setRelation('payments', collect([new Payment(['amount' => 150_000_000]), new Payment(['amount' => 50_000_000])]));

        $rows = InvoiceTotalRows::for($invoice, pelunasanAmount: 377_200_000);

        $this->assertSame(['dpp', 'ppn', 'total', 'diterima', 'tagihan'], array_column($rows, 'jenis'));
        $this->assertSame(200_000_000, $rows[3]['jumlah']);
        $this->assertSame(['jenis' => 'tagihan', 'nomor' => null, 'label' => 'TAGIHAN PELUNASAN', 'jumlah' => 377_200_000, 'mata_uang' => 'IDR'], $rows[4]);
    }

    private function invoice(int $discount = 0, ?string $reason = null, int $items = 1, float|int|null $ppnRate = 11, float|int|null $pphRate = null, int $subtotal = 520_000_000): Invoice
    {
        $ppn = Invoice::ppnFor($subtotal - $discount, $ppnRate);
        $pph = Invoice::pphFor($subtotal - $discount, $pphRate);

        $invoice = new Invoice([
            'subtotal' => $subtotal,
            'discount_amount' => $discount,
            'discount_reason' => $reason,
            'ppn_rate' => $ppnRate,
            'ppn_amount' => $ppn,
            'pph_rate' => $pphRate,
            'pph_amount' => $pph,
            'total_amount' => $subtotal - $discount + $ppn - $pph,
        ]);
        $invoice->setRelation('items', collect(range(1, $items))->map(fn () => new InvoiceItem));
        $invoice->setRelation('payments', collect());

        return $invoice;
    }
}
