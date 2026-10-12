<?php

namespace Tests\Feature;

use App\Exports\InvoiceRecapExport;
use App\Exports\InvoiceRecapJsmExport;
use App\Models\Client;
use App\Models\CompanyProfile;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Payment;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class InvoiceRecapJsmExportTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Client $tcm;

    private Client $bek;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
        Permission::firstOrCreate(['name' => 'view invoices']);
        $this->user = User::factory()->create();
        $this->user->givePermissionTo('view invoices');

        CompanyProfile::create([
            'name' => 'PT Jaya Samudra Makmur',
            'address' => 'Samarinda',
            'phone' => '0541-000000',
            'npwp' => '01.234.567.8-000.000',
            'finance_manager_name' => 'Nisa',
            'email' => 'finance@jsm.test',
            'ppn_rate' => 11,
        ]);

        $this->tcm = Client::factory()->create(['name' => 'PT. Trubaindo Coal Mining']);
        $this->bek = Client::factory()->create(['name' => 'PT. Bharinto Ekatama']);

        $this->travelTo(Carbon::parse('2026-10-12 09:00:00'));
    }

    private function invoice(Client $client, string $number, string $date, int $total, string $service): Invoice
    {
        $invoice = Invoice::factory()->sent()->create([
            'billed_to_id' => $client->id,
            'invoice_number' => $number,
            'issue_date' => $date,
            'subtotal' => $total,
            'total_amount' => $total,
        ]);
        InvoiceItem::factory()->create(['invoice_id' => $invoice->id, 'client_id' => $client->id, 'service_name' => $service, 'quantity' => 1, 'unit' => 'paket', 'unit_price' => $total, 'amount' => $total]);

        return $invoice;
    }

    /** @return array<int, array<int, mixed>> */
    private function downloadJsmGrid(string $query): array
    {
        Excel::fake();
        $this->actingAs($this->user)->get('/invoices/export/excel?template=jsm&'.$query)->assertOk();

        $grid = null;
        Excel::assertDownloaded('rekap-invoice-jsm-20261012-090000.xlsx', function (InvoiceRecapJsmExport $export) use (&$grid) {
            $grid = $export->array();

            return true;
        });

        return $grid;
    }

    public function test_jsm_template_groups_by_month_with_formula_totals(): void
    {
        $jan = $this->invoice($this->tcm, '001/JSM-TCM/I/2026', '2026-01-20', 240_840_000, 'Trip Lumpsum & Additional JSM-TCM Desember 2025');
        $this->invoice($this->bek, '002/JSM-BEK/I/2026', '2026-01-20', 483_000_000, 'Trip Lumpsum & Additional JSM-BEK Desember 2025');
        $this->invoice($this->tcm, '038/JSM-TCM/II/2026', '2026-02-26', 335_200_000, 'Trip Lumpsum & Additional JSM-TCM Januari 2026');
        Payment::factory()->create(['invoice_id' => $jan->id, 'amount' => 100_000_000, 'payment_date' => '2026-02-01']);
        Payment::factory()->create(['invoice_id' => $jan->id, 'amount' => 50_000_000, 'payment_date' => '2026-03-05']);

        $grid = $this->downloadJsmGrid('date_from=2026-01-01&date_to=2026-12-31');

        $this->assertSame('Recap Invoice - JSM', $grid[1][1]);
        $this->assertSame('Periode 2026', $grid[2][1]);
        $this->assertSame(['', 'No.', 'No. Invoice', 'Date Invoice', 'Company', 'Total Invoice', 'PPN 11%', 'Grand Total', 'Payment', 'Keterangan'], $grid[3]);

        // Januari: baris bulan (row 5), dua invoice (row 6-7), Total (row 8).
        $this->assertSame('Januari 2026', $grid[4][1]);
        $this->assertSame(['1', '001/JSM-TCM/I/2026'], [$grid[5][1], $grid[5][2]]);
        $this->assertSame(240_840_000, $grid[5][5]);
        $this->assertSame('=F6*11%', $grid[5][6]);
        $this->assertSame('=SUM(F6:G6)', $grid[5][7]);
        $this->assertSame('2026-03-05', ExcelDate::excelToDateTimeObject($grid[5][8])->format('Y-m-d'), 'Payment = tanggal bayar terakhir');
        $this->assertSame('Trip Lumpsum & Additional JSM-TCM Desember 2025', $grid[5][9]);
        $this->assertSame('', $grid[6][8], 'Belum dibayar → Payment kosong');
        $this->assertSame(['', 'Total', '', '', '', '=SUM(F6:F7)', '=SUM(G6:G7)', '=SUM(H6:H7)', '', ''], $grid[7]);

        // Februari: penomoran berlanjut, lalu Grand Total menjumlahkan total per bulan.
        $this->assertSame('Februari 2026', $grid[8][1]);
        $this->assertSame('3', $grid[9][1]);
        $this->assertSame(['', 'Grand Total', '', '', '', '=SUM(F8+F11)', '=SUM(G8+G11)', '=SUM(H8+H11)', '', ''], end($grid));
    }

    public function test_jsm_title_names_the_client_when_exported_for_one_client(): void
    {
        $this->invoice($this->tcm, '001/JSM-TCM/I/2026', '2026-01-20', 1_000_000, 'Trip');

        $grid = $this->downloadJsmGrid('date_from=2026-01-01&date_to=2026-12-31&client_ids[]='.$this->tcm->id);

        $this->assertSame('Recap Invoice PT. Trubaindo Coal Mining - JSM', $grid[1][1]);
    }

    public function test_jsm_period_label_for_month_and_partial_range(): void
    {
        $this->invoice($this->tcm, '001/JSM-TCM/I/2026', '2026-01-20', 1_000_000, 'Trip');

        $this->assertSame('Periode Januari 2026', $this->downloadJsmGrid('month=2026-01')[2][1]);
        $this->assertSame('Periode 1 Januari 2026 – 31 Maret 2026', $this->downloadJsmGrid('date_from=2026-01-01&date_to=2026-03-31')[2][1]);
    }

    public function test_jsm_template_excludes_drafts_like_the_default_recap(): void
    {
        $this->invoice($this->tcm, '001/JSM-TCM/I/2026', '2026-01-20', 1_000_000, 'Trip');
        Invoice::factory()->draft()->create(['billed_to_id' => $this->tcm->id, 'issue_date' => '2026-01-21', 'total_amount' => 9_000_000]);

        $flat = collect($this->downloadJsmGrid('date_from=2026-01-01&date_to=2026-12-31'))->flatten()->implode('|');

        $this->assertStringNotContainsString('9000000', $flat);
    }

    public function test_default_template_is_unchanged_without_template_param(): void
    {
        $this->invoice($this->tcm, '001/JSM-TCM/I/2026', '2026-01-20', 1_000_000, 'Trip');
        Excel::fake();

        $this->actingAs($this->user)->get('/invoices/export/excel?date_from=2026-01-01&date_to=2026-12-31')->assertOk();

        Excel::assertDownloaded('rekap-invoice-20261012-090000.xlsx', fn (InvoiceRecapExport $export) => $export->array()[0][0] === 'REKAP INVOICE');
    }

    public function test_jsm_download_produces_styled_workbook(): void
    {
        $this->invoice($this->tcm, '001/JSM-TCM/I/2026', '2026-01-20', 240_840_000, 'Trip Lumpsum');

        $response = $this->actingAs($this->user)->get('/invoices/export/excel?template=jsm&date_from=2026-01-01&date_to=2026-12-31');
        $response->assertOk();

        $path = tempnam(sys_get_temp_dir(), 'jsm').'.xlsx';
        file_put_contents($path, $response->streamedContent() ?: file_get_contents($response->baseResponse->getFile()->getPathname()));
        $sheet = IOFactory::load($path)->getActiveSheet();
        @unlink($path);

        $this->assertSame('Recap Invoice - JSM', $sheet->getCell('B2')->getValue());
        $this->assertContains('B5:J5', array_keys($sheet->getMergeCells()), 'Baris bulan digabung B:J');
        $this->assertSame('4472C4', $sheet->getStyle('B4')->getFill()->getStartColor()->getRGB());
        $this->assertSame('FFC000', $sheet->getStyle('B5')->getFill()->getStartColor()->getRGB());
        $this->assertSame('FFFF00', $sheet->getStyle('H7')->getFill()->getStartColor()->getRGB(), 'Grand total bulan disorot kuning');
        $this->assertSame(267_332_400, (int) $sheet->getCell('H6')->getCalculatedValue());
        $this->assertSame('A5', $sheet->getFreezePane());
    }
}
