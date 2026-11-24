<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Company;
use App\Models\CompanyProfile;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Organization;
use App\Services\CompanyInvoiceTemplate;
use App\Services\InvoicePrintService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Kotak alamat & rekening di bawah tabel item selebar tabel itu di semua template perusahaan, supaya tepi
 * kanannya sejajar. Dokumen Word asli memakai lebar kotak tetap, sehingga kotak menjorok melewati tabel
 * Debit Note yang lebih sempit (BCB, NBM, AOE) atau berhenti sebelum tepi tabel invoice (BCB, NBM, MKB, NAI, BAS).
 */
class KotakInfoSelebarTabelTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array<string, array{string, string, float, float}>
     *                                                            slug, jenis dokumen, lebar tabel item (cm), padding + garis kedua kotak (cm)
     */
    public static function dokumen(): array
    {
        return [
            'BCB invoice' => ['bahtera-cipta-bersama', Invoice::TYPE_INVOICE, 16.86, 1.08],
            'BCB debit note' => ['bahtera-cipta-bersama', Invoice::TYPE_DEBIT_NOTE, 16.0, 1.08],
            'NBM invoice' => ['namora-berlian-mahakam', Invoice::TYPE_INVOICE, 16.86, 1.08],
            'NBM debit note' => ['namora-berlian-mahakam', Invoice::TYPE_DEBIT_NOTE, 16.0, 1.08],
            'MKB invoice' => ['mitra-kellian-baruna', Invoice::TYPE_INVOICE, 16.86, 1.08],
            'MKB debit note' => ['mitra-kellian-baruna', Invoice::TYPE_DEBIT_NOTE, 16.45, 1.08],
            'AOE invoice' => ['abdi-ocean-energy', Invoice::TYPE_INVOICE, 16.86, 1.08],
            'AOE debit note' => ['abdi-ocean-energy', Invoice::TYPE_DEBIT_NOTE, 15.54, 1.08],
            'NAI invoice' => ['nusantara-armada-indonesia', Invoice::TYPE_INVOICE, 16.06, 1.08],
            // BAS: garis & padding ada di div di dalam sel, jadi sel = kotak.
            'BAS invoice' => ['berkah-andalan-samboja', Invoice::TYPE_INVOICE, 16.86, 0.0],
            'BAS debit note' => ['berkah-andalan-samboja', Invoice::TYPE_DEBIT_NOTE, 16.86, 0.0],
        ];
    }

    #[DataProvider('dokumen')]
    public function test_kotak_info_selebar_tabel_item(string $slug, string $jenis, float $lebarTabel, float $paddingDanGaris): void
    {
        $html = $this->render($slug, $jenis);

        // Tabel item: lebar tetap, atau 100% = area cetak.
        $this->assertMatchesRegularExpression('/\.items-table,\s*\.totals-table \{\s*width: ([0-9.]+cm|100%);/', $html);
        preg_match('/\.items-table,\s*\.totals-table \{\s*width: ([0-9.]+cm|100%);/', $html, $tabel);
        if ($tabel[1] !== '100%') {
            $this->assertEqualsWithDelta($lebarTabel, (float) $tabel[1], 0.001, 'lebar tabel item');
        }

        preg_match('/table\.info \{\s*width: ([0-9.]+)cm;/', $html, $info);
        $this->assertEqualsWithDelta($lebarTabel, (float) ($info[1] ?? 0), 0.001, 'kotak info selebar tabel item');
        $this->assertStringNotContainsString('margin-left: -', substr($html, (int) strpos($html, 'table.info {'), 200));

        // Lebar kedua sel + sela + padding & garis = lebar kotak info.
        $tabelInfo = substr($html, (int) strpos($html, '<table class="info">'));
        preg_match_all('/<td(?: class="kotak")? style="width: ([0-9.]+)cm;">/', $tabelInfo, $sel);
        preg_match('/table\.info td\.sela \{\s*width: ([0-9.]+)cm;/', $html, $sela);
        $this->assertCount(2, array_slice($sel[1], 0, 2));
        $this->assertEqualsWithDelta($lebarTabel, $sel[1][0] + $sel[1][1] + (float) $sela[1] + $paddingDanGaris, 0.02);
    }

    private function render(string $slug, string $jenis): string
    {
        $company = Company::withoutEvents(fn () => Company::firstOrCreate(['id' => $slug], [
            'organization_id' => Organization::firstOrFail()->id,
            'name' => 'PT Contoh',
            'abbreviation' => 'CTH',
            'status' => 'active',
        ]));
        CompanyProfile::factory()->create([
            'bank_accounts' => [['bank' => 'Bank Mandiri', 'account_number' => '000-00-0000000-0', 'account_name' => 'PT. CONTOH']],
        ]);
        $client = Client::factory()->create();

        $invoice = new Invoice([
            'document_type' => $jenis,
            'billed_to_id' => $client->id,
            'subject' => 'Contoh',
            'subtotal' => 1_000_000,
            'discount_amount' => 0,
            'ppn_rate' => 0,
            'ppn_amount' => 0,
            'total_amount' => 1_000_000,
            'issue_date' => '2026-11-03',
            'due_date' => '2026-11-17',
            'status' => 'sent',
        ]);
        $invoice->invoice_number = '001/CTH-XXX/INV/XI/2026';
        $invoice->setRelation('client', $client);
        $invoice->setRelation('payments', collect());
        $invoice->setRelation('items', collect([(new InvoiceItem([
            'client_id' => $client->id,
            'service_name' => 'Jasa contoh',
            'quantity' => 1,
            'unit' => 'Lot',
            'unit_price' => 1_000_000,
            'amount' => 1_000_000,
            'cogs_amount' => 0,
            'is_tax_deposit' => $jenis === Invoice::TYPE_DEBIT_NOTE,
        ]))->setRelation('client', $client)]));

        tenancy()->initialize($company);

        try {
            return view(
                CompanyInvoiceTemplate::viewFor(CompanyInvoiceTemplate::KEY, $invoice),
                (new InvoicePrintService)->buildViewData($invoice, null, null, CompanyInvoiceTemplate::KEY),
            )->render();
        } finally {
            tenancy()->end();
        }
    }
}
