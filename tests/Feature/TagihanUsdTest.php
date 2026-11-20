<?php

namespace Tests\Feature;

use App\Models\BankAccount;
use App\Models\Client;
use App\Models\CompanyProfile;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use App\Services\InvoicePrintService;
use App\Services\InvoiceTotalRows;
use App\Services\JournalService;
use App\Services\ProfitLossService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Symfony\Component\HttpFoundation\Response;
use Tests\TestCase;

/**
 * Tagihan USD dengan kurs manual. Pembukuan tetap Rupiah (kurs invoice); USD = utang klien
 * (`total_foreign`), dibayar dalam USD dengan kurs saat diterima. Angka contoh dari dokumen BCB & MKB:
 * PROFORMA 103 (53.800 MT × $0,82, kurs 18.250), TKBM 097 (Rupiah + PPN, kurs 18.218), FINAL 046 MKB
 * (tagihan Rupiah bertarif USD: 55.070 MT × $0,75 × 17.898).
 */
class TagihanUsdTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Client $client;

    private BankAccount $rekening;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
        $permissions = ['view invoices', 'create invoices', 'edit invoices'];
        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
        }
        Role::firstOrCreate(['name' => 'admin'])->syncPermissions($permissions);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');

        CompanyProfile::factory()->create([
            'is_pkp' => true,
            'ppn_rate' => 11,
            'pph_enabled' => false,
            'foreign_currency_enabled' => true,
            'invoice_number_format' => '{NO}/INV/{PT}-{KLIEN}/{BLN_ROMAWI}/{THN}',
        ]);

        $this->client = Client::factory()->company()->create(['name' => 'AVRA COMMODITIES FZE', 'alias' => 'AVRA']);
        $this->rekening = BankAccount::factory()->create();

        $this->travelTo(Carbon::parse('2026-11-17 10:00:00'));
    }

    /**
     * @param  list<array<string, mixed>>  $items
     * @param  array<string, mixed>  $extra
     */
    private function simpan(array $items, array $extra = []): Invoice
    {
        $this->actingAs($this->admin)->post('/invoices', [
            'client_id' => $this->client->id,
            'issue_date' => '2026-11-17',
            'due_date' => '2026-12-01',
            'apply_ppn' => false,
            'publish' => true,
            'items' => collect($items)->map(fn (array $item) => [
                'service_name' => 'MV. ALPHA FLAME',
                'unit' => 'MT',
                'unit_price' => 0,
                'cogs_amount' => 0,
                'is_tax_deposit' => false,
                ...$item,
            ])->all(),
            ...$extra,
        ])->assertSessionHasNoErrors();

        return Invoice::with('items')->latest('id')->firstOrFail();
    }

    private function proforma(): Invoice
    {
        return $this->simpan(
            [['quantity' => 53800, 'foreign_unit_price' => 0.82]],
            ['currency' => 'USD', 'exchange_rate' => 18250],
        );
    }

    /**
     * @return TestResponse<Response>
     */
    private function bayar(Invoice $invoice, float $usd, float $kurs, string $tanggal = '2026-11-20')
    {
        return $this->actingAs($this->admin)->postJson("/invoices/{$invoice->id}/payments", [
            'foreign_amount' => $usd,
            'exchange_rate' => $kurs,
            'payment_date' => $tanggal,
            'payment_method' => 'bank_transfer',
            'bank_account_id' => $this->rekening->id,
        ]);
    }

    public function test_tagihan_usd_berharga_usd_rupiahnya_dari_kurs_invoice(): void
    {
        $invoice = $this->proforma();

        $this->assertSame('USD', $invoice->currency);
        $this->assertSame('18250.00', $invoice->exchange_rate);
        // 53.800 × $0,82 × 18.250 = Rp 805.117.000 → utang $44.116,00.
        $this->assertSame(805_117_000, $invoice->total_amount);
        $this->assertSame('44116.00', $invoice->total_foreign);
        $item = $invoice->items->first();
        $this->assertSame('0.8200', $item->foreign_unit_price);
        // Rupiah per unit (ke sen) = harga USD × kurs; jumlah baris tetap dari harga USD.
        $this->assertSame(14_965.0, $item->unit_price);
        $this->assertSame(805_117_000, $item->amount);
        $this->assertSame(805_117_000, $invoice->amount_remaining);
        $this->assertSame(44116.0, $invoice->foreign_remaining);
    }

    public function test_tagihan_usd_berharga_rupiah_dengan_ppn_utangnya_grand_total_dibagi_kurs(): void
    {
        $invoice = $this->simpan([
            ['service_name' => 'THP TKBM', 'quantity' => 55000, 'unit_price' => 4990],
            ['service_name' => 'Transport TKBM', 'quantity' => 3, 'unit_price' => 17_500_000],
        ], ['currency' => 'USD', 'exchange_rate' => 18218, 'apply_ppn' => true]);

        // Rp 326.950.000 + PPN 11% 35.964.500 = 362.914.500 ÷ 18.218 = $19.920,66 (dokumen TKBM 097).
        $this->assertSame(362_914_500, $invoice->total_amount);
        $this->assertSame('19920.66', $invoice->total_foreign);
        $this->assertNull($invoice->items->first()->foreign_unit_price);
    }

    public function test_tagihan_rupiah_bertarif_usd_sama_persis_dengan_excel(): void
    {
        $invoice = $this->simpan(
            [['quantity' => 55070, 'foreign_unit_price' => 0.75]],
            ['currency' => 'IDR', 'exchange_rate' => 17898],
        );

        // 55.070 × $0,75 × 17.898 = Rp 739.232.145 (invoice FINAL 046 MKB), tagihan tetap Rupiah.
        $this->assertSame('IDR', $invoice->currency);
        $this->assertSame('17898.00', $invoice->exchange_rate);
        $this->assertNull($invoice->total_foreign);
        $this->assertSame(739_232_145, $invoice->items->first()->amount);
        $this->assertSame(739_232_145, $invoice->subtotal);
        $this->assertFalse($invoice->isForeign());
    }

    public function test_tanpa_sakelar_perusahaan_usd_dan_harga_usd_ditolak(): void
    {
        CompanyProfile::current()->update(['foreign_currency_enabled' => false]);

        $this->actingAs($this->admin)->post('/invoices', [
            'client_id' => $this->client->id,
            'issue_date' => '2026-11-17',
            'due_date' => '2026-12-01',
            'currency' => 'USD',
            'exchange_rate' => 18250,
            'items' => [['service_name' => 'Jasa', 'quantity' => 1, 'unit_price' => 1000, 'foreign_unit_price' => 0.5]],
        ])->assertSessionHasErrors(['currency', 'items']);

        $this->actingAs($this->admin)->get('/invoices/create')
            ->assertInertia(fn ($page) => $page->where('foreignCurrency.enabled', false));
    }

    public function test_kurs_wajib_untuk_tagihan_usd_dan_harga_usd(): void
    {
        $this->actingAs($this->admin)->post('/invoices', [
            'client_id' => $this->client->id,
            'issue_date' => '2026-11-17',
            'due_date' => '2026-12-01',
            'currency' => 'USD',
            'items' => [['service_name' => 'Jasa', 'quantity' => 1, 'unit_price' => 1000]],
        ])->assertSessionHasErrors(['exchange_rate' => __('Kurs wajib diisi untuk tagihan USD.')]);

        $this->actingAs($this->admin)->post('/invoices', [
            'client_id' => $this->client->id,
            'issue_date' => '2026-11-17',
            'due_date' => '2026-12-01',
            'items' => [['service_name' => 'Jasa', 'quantity' => 1, 'unit_price' => 0, 'foreign_unit_price' => 0.75]],
        ])->assertSessionHasErrors(['exchange_rate' => __('Kurs wajib diisi bila ada harga dalam USD.')]);
    }

    public function test_pembayaran_usd_lunas_menurut_usd_walau_kursnya_berubah(): void
    {
        $invoice = $this->proforma();

        $this->bayar($invoice, 20000, 18300)->assertOk()->assertJsonPath('foreign_amount', 20000);
        $invoice->refresh();
        $this->assertSame('partially_paid', $invoice->status);
        $this->assertSame(24116.0, $invoice->foreign_remaining);
        // Sisa USD × kurs invoice.
        $this->assertSame(440_117_000, $invoice->amount_remaining);
        // Rupiah yang masuk = USD × kurs saat diterima.
        $this->assertSame(366_000_000, Payment::sole()->amount);

        // Melebihi sisa USD ditolak, berapa pun Rupiahnya.
        $this->bayar($invoice, 24116.01, 18000)->assertStatus(422)->assertJsonValidationErrors('foreign_amount');

        $this->bayar($invoice, 24116, 18300)->assertOk();
        $invoice->refresh();
        $this->assertSame('paid', $invoice->status);
        $this->assertSame(0, $invoice->amount_remaining);
        // Kurs naik: Rupiah yang masuk (44.116 × 18.300) melebihi total_amount.
        $this->assertSame(807_322_800, $invoice->amount_paid);

        // Rupiah saja tidak cukup: tagihan USD wajib USD & kurs.
        $this->actingAs($this->admin)->postJson("/invoices/{$invoice->id}/payments", [
            'amount' => 1000, 'payment_date' => '2026-11-20', 'payment_method' => 'bank_transfer', 'bank_account_id' => $this->rekening->id,
        ])->assertStatus(422);
    }

    public function test_mata_uang_terkunci_setelah_ada_pembayaran(): void
    {
        $invoice = $this->proforma();
        $this->bayar($invoice, 1000, 18250)->assertOk();

        $this->actingAs($this->admin)->put("/invoices/{$invoice->id}", [
            'client_id' => $this->client->id,
            'issue_date' => '2026-11-17',
            'due_date' => '2026-12-01',
            'currency' => 'IDR',
            'exchange_rate' => 18250,
            'items' => [['service_name' => 'MV. ALPHA FLAME', 'quantity' => 53800, 'unit' => 'MT', 'unit_price' => 0, 'foreign_unit_price' => 0.82]],
        ])->assertSessionHasNoErrors();

        $this->assertSame('USD', $invoice->fresh()->currency);
        $this->actingAs($this->admin)->get("/invoices/{$invoice->id}/edit")
            ->assertInertia(fn ($page) => $page->where('invoice.currency', 'USD')->where('invoice.has_payments', true));
    }

    public function test_laba_rugi_dan_jurnal_mencatat_selisih_kurs(): void
    {
        $invoice = $this->proforma();
        $this->bayar($invoice, 44116, 18300)->assertOk();

        $laporan = app(ProfitLossService::class)->generate(Carbon::parse('2026-11-01'), Carbon::parse('2026-11-30'));

        // Pendapatan = tagihan dengan kurs invoice; selisihnya (44.116 × 50) = laba kurs, pendapatan lain.
        $this->assertSame(805_117_000, $laporan['revenue']['invoice']);
        $this->assertSame(2_205_800, $laporan['fx_difference']);
        $this->assertContains(['category_id' => null, 'category_label' => 'Laba selisih kurs', 'amount' => 2_205_800], $laporan['other_income']['by_category']);
        $this->assertSame(807_322_800, $laporan['pre_tax_profit']);

        $jurnal = JournalService::forPayment(Payment::sole());
        $debit = collect($jurnal)->where('side', 'debit')->sum('amount');
        $kredit = collect($jurnal)->where('side', 'credit')->sum('amount');
        $this->assertSame($debit, $kredit);
        $this->assertContains(['account' => 'Selisih Kurs', 'side' => 'credit', 'amount' => 2_205_800], $jurnal);
        $this->assertContains(['account' => 'Pendapatan dari Invoice', 'side' => 'credit', 'amount' => 805_117_000], $jurnal);
    }

    public function test_rugi_kurs_menjadi_beban_lain(): void
    {
        $invoice = $this->proforma();
        $this->bayar($invoice, 44116, 18200)->assertOk();

        $laporan = app(ProfitLossService::class)->generate(Carbon::parse('2026-11-01'), Carbon::parse('2026-11-30'));

        $this->assertSame(805_117_000, $laporan['revenue']['invoice']);
        $this->assertSame(-2_205_800, $laporan['fx_difference']);
        $this->assertContains(['category_id' => null, 'category_label' => 'Rugi selisih kurs', 'amount' => 2_205_800], $laporan['other_expense']['by_category']);
        $this->assertContains(['account' => 'Selisih Kurs', 'side' => 'debit', 'amount' => 2_205_800], JournalService::forPayment(Payment::sole()));
    }

    public function test_daftar_invoice_menghitung_sisa_usd_dengan_kurs_invoice(): void
    {
        $invoice = $this->proforma();
        $this->bayar($invoice, 20000, 18300)->assertOk();

        $this->actingAs($this->admin)->get('/invoices?month=2026-11')
            ->assertInertia(fn ($page) => $page
                ->where('invoices.data.0.currency', 'USD')
                ->where('invoices.data.0.total_foreign', 44116)
                ->where('invoices.data.0.foreign_remaining', 24116)
                ->where('invoices.data.0.amount_remaining', 440_117_000)
                ->where('stats.total_outstanding', 440_117_000));

        $this->actingAs($this->admin)->getJson("/invoices/{$invoice->id}/data")
            ->assertJsonPath('currency', 'USD')
            ->assertJsonPath('foreign_paid', 20000)
            ->assertJsonPath('foreign_remaining', 24116)
            ->assertJsonPath('payments.0.exchange_rate', 18300);
    }

    public function test_pdf_mencetak_kurs_total_usd_dan_rekening_usd(): void
    {
        CompanyProfile::current()->update(['bank_accounts' => [
            ['bank' => 'Bank Mandiri', 'account_number' => '148-00-2281085-0', 'account_name' => 'PT. CONTOH', 'currency' => 'IDR'],
            ['bank' => 'Bank Mandiri', 'account_number' => '148-00-2885477-9', 'account_name' => 'PT. CONTOH', 'currency' => 'USD', 'branch' => 'Samarinda Sempaja Branch', 'swift' => 'BMRIIDJA'],
        ]]);
        $invoice = $this->proforma();

        $baris = InvoiceTotalRows::for($invoice->load('payments'));
        $this->assertSame(['jenis' => 'tagihan_usd', 'nomor' => null, 'label' => 'TOTAL OUTSTANDING (USD)', 'jumlah' => 44116.0, 'mata_uang' => 'USD'], end($baris));
        $this->assertSame('44.116,00', InvoiceTotalRows::format(44116.0, 'USD'));
        $this->assertSame('13.423,50', InvoiceTotalRows::format(13423.5));
        $this->assertSame('0,825', InvoiceTotalRows::format(0.825, 'USD', 4));

        $data = (new InvoicePrintService)->buildViewData($invoice->load(['client', 'items', 'payments']));
        // Tagihan USD hanya mencetak rekening USD.
        $this->assertSame(['148-00-2885477-9'], array_column($data['company']['bank_accounts'], 'account_number'));

        $html = view('pdf.kisantra-invoice', $data)->render();
        $this->assertStringContainsString('TOTAL OUTSTANDING (USD): USD 44.116,00', $html);
        $this->assertStringContainsString('Kurs: 1 USD = Rp 18.250', $html);
    }

    public function test_profil_menyimpan_sakelar_dan_rekening_bermata_uang(): void
    {
        Permission::firstOrCreate(['name' => 'manage company profile']);
        Role::findByName('admin')->givePermissionTo('manage company profile');

        $this->actingAs($this->admin)->post('/settings/company', [
            'name' => 'PT. CONTOH',
            'abbreviation' => 'CTH',
            'address' => 'Jl. Contoh',
            'email' => 'contoh@example.com',
            'phone' => '0811',
            'ppn_rate' => 11,
            'finance_manager_name' => 'Nama',
            'finance_manager_position' => 'Direktur',
            'foreign_currency_enabled' => true,
            'bank_accounts' => [
                ['bank' => 'Bank Mandiri', 'account_number' => '1', 'account_name' => 'PT. CONTOH'],
                ['bank' => 'Bank Mandiri', 'account_number' => '2', 'account_name' => 'PT. CONTOH', 'currency' => 'USD', 'branch' => ' Sempaja ', 'swift' => 'bmriidja'],
            ],
        ])->assertSessionHasNoErrors();

        $profil = CompanyProfile::current();
        $this->assertTrue($profil->foreign_currency_enabled);
        $this->assertEquals([
            ['bank' => 'Bank Mandiri', 'account_number' => '1', 'account_name' => 'PT. CONTOH', 'currency' => 'IDR', 'branch' => null, 'swift' => null],
            ['bank' => 'Bank Mandiri', 'account_number' => '2', 'account_name' => 'PT. CONTOH', 'currency' => 'USD', 'branch' => 'Sempaja', 'swift' => 'BMRIIDJA'],
        ], $profil->bank_accounts);
    }
}
