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
            ['jenis' => 'dpp', 'nomor' => null, 'label' => 'Total Invoice (Sebelum PPN)', 'jumlah' => 520_000_000],
            ['jenis' => 'ppn', 'nomor' => 2, 'label' => 'PPN 11%', 'jumlah' => 57_200_000],
            ['jenis' => 'tagihan', 'nomor' => null, 'label' => 'GRAND TOTAL', 'jumlah' => 577_200_000],
        ], InvoiceTotalRows::for($this->invoice()));
    }

    public function test_diskon_dan_nomor_ppn_melanjutkan_nomor_item(): void
    {
        $invoice = $this->invoice(discount: 20_000_000, reason: 'Potongan waiting', items: 3);

        $this->assertSame([
            ['jenis' => 'diskon', 'nomor' => null, 'label' => 'Discount (Potongan waiting)', 'jumlah' => 20_000_000],
            ['jenis' => 'dpp', 'nomor' => null, 'label' => 'Total Invoice (Sebelum PPN)', 'jumlah' => 500_000_000],
            ['jenis' => 'ppn', 'nomor' => 4, 'label' => 'PPN 11%', 'jumlah' => 55_000_000],
            ['jenis' => 'tagihan', 'nomor' => null, 'label' => 'GRAND TOTAL', 'jumlah' => 555_000_000],
        ], InvoiceTotalRows::for($invoice));
    }

    public function test_tanpa_ppn_hanya_grand_total_dan_tarif_pecahan_berformat_indonesia(): void
    {
        $this->assertSame(
            [['jenis' => 'tagihan', 'nomor' => null, 'label' => 'GRAND TOTAL', 'jumlah' => 520_000_000]],
            InvoiceTotalRows::for($this->invoice(ppnRate: 0)),
        );

        // Invoice lama sebelum fitur PPN (ppn_rate NULL) juga tanpa baris PPN.
        $this->assertSame(['tagihan'], array_column(InvoiceTotalRows::for($this->invoice(ppnRate: null)), 'jenis'));

        $this->assertSame('PPN 1,1%', InvoiceTotalRows::for($this->invoice(ppnRate: 1.1))[1]['label']);
    }

    public function test_tagihan_uang_muka(): void
    {
        $rows = InvoiceTotalRows::for($this->invoice(), dpAmount: 200_000_000, dpPercentage: '38%');

        $this->assertSame(['dpp', 'ppn', 'total', 'tagihan'], array_column($rows, 'jenis'));
        $this->assertSame(['jenis' => 'total', 'nomor' => null, 'label' => 'Total Invoice', 'jumlah' => 577_200_000], $rows[2]);
        $this->assertSame(['jenis' => 'tagihan', 'nomor' => null, 'label' => 'TAGIHAN UANG MUKA (DP 38%)', 'jumlah' => 200_000_000], $rows[3]);
    }

    public function test_tagihan_pelunasan_memuat_pembayaran_diterima(): void
    {
        $invoice = $this->invoice();
        $invoice->setRelation('payments', collect([new Payment(['amount' => 150_000_000]), new Payment(['amount' => 50_000_000])]));

        $rows = InvoiceTotalRows::for($invoice, pelunasanAmount: 377_200_000);

        $this->assertSame(['dpp', 'ppn', 'total', 'diterima', 'tagihan'], array_column($rows, 'jenis'));
        $this->assertSame(200_000_000, $rows[3]['jumlah']);
        $this->assertSame(['jenis' => 'tagihan', 'nomor' => null, 'label' => 'TAGIHAN PELUNASAN', 'jumlah' => 377_200_000], $rows[4]);
    }

    private function invoice(int $discount = 0, ?string $reason = null, int $items = 1, float|int|null $ppnRate = 11): Invoice
    {
        $subtotal = 520_000_000;
        $ppn = Invoice::ppnFor($subtotal - $discount, $ppnRate);

        $invoice = new Invoice([
            'subtotal' => $subtotal,
            'discount_amount' => $discount,
            'discount_reason' => $reason,
            'ppn_rate' => $ppnRate,
            'ppn_amount' => $ppn,
            'total_amount' => $subtotal - $discount + $ppn,
        ]);
        $invoice->setRelation('items', collect(range(1, $items))->map(fn () => new InvoiceItem));
        $invoice->setRelation('payments', collect());

        return $invoice;
    }
}
