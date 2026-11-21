<?php

namespace Tests\Feature;

use App\Models\BankAccount;
use App\Models\Client;
use App\Models\Company;
use App\Models\CompanyProfile;
use App\Models\Invoice;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\User;
use App\Services\CompanyInvoiceTemplate;
use App\Services\InvoicePrintService;
use App\Services\JournalService;
use App\Services\ProfitLossService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Potongan PPh 23 oleh klien, untuk perusahaan yang memakainya (Profil perusahaan, seperti PKP): PPh =
 * tarif × DPP (layanan − titipan − diskon), total (GRAND TOTAL) = yang ditransfer klien = DPP + PPN −
 * PPh. Status Lunas memakai total itu; potongannya tetap pendapatan (kredit pajak, jurnal "PPh 23
 * Dibayar di Muka"). Angka contoh = invoice SLU asli: 30.000.000 + PPN 11% 3.300.000 − PPh 23 2%
 * 600.000 = 32.700.000.
 */
class InvoicePphTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Client $client;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
        $permissions = ['view invoices', 'create invoices', 'edit invoices', 'view dashboard'];
        foreach ($permissions as $perm) {
            Permission::firstOrCreate(['name' => $perm]);
        }
        Role::firstOrCreate(['name' => 'admin'])->syncPermissions($permissions);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
        $this->client = Client::factory()->create();

        CompanyProfile::factory()->create(['is_pkp' => true, 'ppn_rate' => 11, 'pph_enabled' => true, 'pph_rate' => 2, 'debit_note_enabled' => true, 'bank_accounts' => []]);
    }

    /** @return array<string, mixed> */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'client_id' => $this->client->id,
            'issue_date' => '2026-10-01',
            'due_date' => '2026-10-31',
            'apply_pph' => true,
            'pph_rate' => 2,
            'items' => [
                ['service_name' => 'Stevedoring', 'quantity' => 2500, 'unit' => 'MT', 'unit_price' => 12_000, 'cogs_amount' => 10_000_000, 'is_tax_deposit' => false],
            ],
        ], $overrides);
    }

    private function buat(array $overrides = []): Invoice
    {
        $this->actingAs($this->admin)->post('/invoices', $this->payload($overrides))->assertSessionHasNoErrors();

        return Invoice::with('items')->latest('id')->firstOrFail();
    }

    public function test_pph_dipotong_dari_dpp_dan_total_adalah_yang_ditransfer_klien(): void
    {
        $invoice = $this->buat();

        $this->assertSame('2.00', $invoice->pph_rate);
        $this->assertSame(600_000, $invoice->pph_amount);
        $this->assertSame(3_300_000, $invoice->ppn_amount);
        $this->assertSame(32_700_000, $invoice->total_amount);
        // Potongan PPh bukan pengurang pendapatan: laba kotor = DPP − HPP.
        $this->assertSame(20_000_000, $invoice->gross_profit);
    }

    public function test_dasar_pph_sama_dengan_dpp_ppn_tanpa_titipan_dan_setelah_diskon(): void
    {
        $invoice = $this->buat([
            'discount_type' => 'fixed',
            'discount_value' => 1_000_000,
            'items' => [
                ['service_name' => 'Jasa', 'quantity' => 1, 'unit_price' => 11_000_000, 'cogs_amount' => 0, 'is_tax_deposit' => false],
                ['service_name' => 'Titipan PNBP', 'quantity' => 1, 'unit_price' => 500_000, 'cogs_amount' => 0, 'is_tax_deposit' => true],
            ],
        ]);

        // DPP = 11.000.000 − 1.000.000 = 10.000.000 (titipan tidak ikut) → PPN 1.100.000, PPh 200.000.
        $this->assertSame(10_000_000, $invoice->dpp_amount);
        $this->assertSame(200_000, $invoice->pph_amount);
        // 11.500.000 − 1.000.000 + 1.100.000 − 200.000.
        $this->assertSame(11_400_000, $invoice->total_amount);
    }

    public function test_perusahaan_yang_memakai_pph_memotong_invoice_baru_secara_bawaan(): void
    {
        $payload = $this->payload();
        unset($payload['apply_pph'], $payload['pph_rate']);
        CompanyProfile::current()->update(['pph_rate' => 0.5]);

        $this->actingAs($this->admin)->post('/invoices', $payload)->assertSessionHasNoErrors();

        // Tarif bawaan dari Profil perusahaan.
        $this->assertSame('0.50', Invoice::sole()->pph_rate);
        $this->assertSame(150_000, Invoice::sole()->pph_amount);
    }

    public function test_perusahaan_yang_tidak_memakai_pph_tidak_bisa_memotong(): void
    {
        CompanyProfile::current()->update(['pph_enabled' => false]);

        $this->actingAs($this->admin)->get('/invoices/create')->assertInertia(fn ($page) => $page->where('pph.enabled', false));

        // Sakelar tidak tampil di editor; kiriman langsung pun diabaikan (bukan galat), seperti PPN non-PKP.
        $invoice = $this->buat();
        $this->assertNull($invoice->pph_rate);
        $this->assertSame(0, $invoice->pph_amount);
        $this->assertSame(33_300_000, $invoice->total_amount);
    }

    public function test_mematikan_pengaturan_tidak_mengubah_invoice_yang_sudah_dipotong(): void
    {
        $invoice = $this->buat();
        CompanyProfile::current()->update(['pph_enabled' => false]);
        $payload = $this->payload(['discount_type' => 'fixed', 'discount_value' => 0]);
        unset($payload['apply_pph'], $payload['pph_rate']);

        $this->actingAs($this->admin)->put("/invoices/{$invoice->id}", $payload)->assertSessionHasNoErrors();

        $this->assertSame('2.00', $invoice->refresh()->pph_rate);
        $this->assertSame(32_700_000, $invoice->total_amount);
        $this->actingAs($this->admin)->get("/invoices/{$invoice->id}/edit")->assertInertia(fn ($page) => $page
            ->where('pph.enabled', false)
            ->where('invoice.pph_rate', 2));
    }

    public function test_tanpa_sakelar_tidak_dipotong_dan_tarif_pecahan_tersimpan(): void
    {
        // 0 = sengaja tidak dipotong (diingat untuk klien ini), bukan null "perusahaan tidak memakai PPh".
        $tanpa = $this->buat(['apply_pph' => false]);
        $this->assertSame('0.00', $tanpa->pph_rate);
        $this->assertSame(0, $tanpa->pph_amount);
        $this->assertSame(33_300_000, $tanpa->total_amount);

        $setengah = $this->buat(['pph_rate' => '0.5']);
        $this->assertSame('0.50', $setengah->pph_rate);
        $this->assertSame(150_000, $setengah->pph_amount);
    }

    public function test_tarif_wajib_dan_dibatasi_bila_dipotong(): void
    {
        $this->actingAs($this->admin)->post('/invoices', $this->payload(['pph_rate' => null]))->assertSessionHasErrors('pph_rate');
        $this->actingAs($this->admin)->post('/invoices', $this->payload(['pph_rate' => 0]))->assertSessionHasErrors('pph_rate');
        $this->actingAs($this->admin)->post('/invoices', $this->payload(['pph_rate' => 101]))->assertSessionHasErrors('pph_rate');
        $this->assertSame(0, Invoice::count());
    }

    public function test_ubah_invoice_mempertahankan_atau_mematikan_potongan(): void
    {
        $invoice = $this->buat();
        $payload = $this->payload();
        unset($payload['apply_pph'], $payload['pph_rate']);

        // Isian tidak dikirim = keadaan tersimpan.
        $this->actingAs($this->admin)->put("/invoices/{$invoice->id}", $payload)->assertSessionHasNoErrors();
        $this->assertSame(600_000, $invoice->refresh()->pph_amount);

        $this->actingAs($this->admin)->get("/invoices/{$invoice->id}/edit")->assertInertia(fn ($page) => $page->where('invoice.pph_rate', 2));

        $this->actingAs($this->admin)->put("/invoices/{$invoice->id}", [...$payload, 'apply_pph' => false])->assertSessionHasNoErrors();
        $invoice->refresh();
        $this->assertSame('0.00', $invoice->pph_rate);
        $this->assertSame(33_300_000, $invoice->total_amount);
    }

    public function test_lunas_saat_klien_mentransfer_total_setelah_potongan(): void
    {
        $invoice = $this->buat(['publish' => true]);

        Payment::factory()->create(['invoice_id' => $invoice->id, 'amount' => 32_700_000]);
        $invoice->refresh()->updateStatus();

        $this->assertSame('paid', $invoice->status);
        $this->assertSame(0, $invoice->amount_remaining);

        $this->actingAs($this->admin)->getJson("/invoices/{$invoice->id}/data")
            ->assertJsonPath('pph_rate', 2)
            ->assertJsonPath('pph_amount', 600_000)
            ->assertJsonPath('total_amount', 32_700_000)
            ->assertJsonPath('amount_remaining', 0);
    }

    public function test_laba_rugi_mengakui_dpp_penuh_dan_mencatat_potongan_sebagai_memo(): void
    {
        $invoice = $this->buat();
        Payment::factory()->create(['invoice_id' => $invoice->id, 'amount' => 32_700_000, 'payment_date' => '2026-10-10']);

        $report = app(ProfitLossService::class)->generate(Carbon::parse('2026-10-01'), Carbon::parse('2026-10-31'));

        $this->assertSame(30_000_000, $report['revenue']['invoice']);
        $this->assertSame(3_300_000, $report['ppn_output']);
        $this->assertSame(600_000, $report['pph_withheld']);
        $this->assertSame(10_000_000, $report['cogs']['invoice']);
    }

    public function test_jurnal_pembayaran_mendebit_pph_dibayar_di_muka_dan_sama_dengan_laba_rugi(): void
    {
        $bank = BankAccount::factory()->create(['account_name' => 'Mandiri Operasional', 'bank_name' => 'Mandiri']);
        $invoice = $this->buat();
        // Dua termin: potongan PPh ikut lunas sebanding dengan uang yang masuk.
        $dp = Payment::factory()->create(['invoice_id' => $invoice->id, 'bank_account_id' => $bank->id, 'amount' => 16_350_000, 'payment_date' => '2026-10-05']);
        $lunas = Payment::factory()->create(['invoice_id' => $invoice->id, 'bank_account_id' => $bank->id, 'amount' => 16_350_000, 'payment_date' => '2026-10-20']);

        $ringkas = fn (array $baris) => array_map(fn (array $b) => [$b['account'], $b['side'], $b['amount']], $baris);
        $rekening = $bank->journalName();

        $this->assertSame([
            [$rekening, 'debit', 16_350_000],
            ['PPh 23 Dibayar di Muka', 'debit', 300_000],
            ['PPN Keluaran', 'credit', 3_300_000],
            ['Pendapatan dari Invoice', 'credit', 13_350_000],
        ], $ringkas(JournalService::forPayment($dp)));
        $this->assertSame([
            [$rekening, 'debit', 16_350_000],
            ['PPh 23 Dibayar di Muka', 'debit', 300_000],
            ['Pendapatan dari Invoice', 'credit', 16_650_000],
        ], $ringkas(JournalService::forPayment($lunas)));

        $report = app(ProfitLossService::class)->generate(Carbon::parse('2026-10-01'), Carbon::parse('2026-10-31'));
        $jurnal = collect([$dp, $lunas])->flatMap(fn (Payment $p) => JournalService::forPayment($p));
        $this->assertSame($report['revenue']['invoice'], $jurnal->where('account', 'Pendapatan dari Invoice')->sum('amount'));
        $this->assertSame($report['pph_withheld'], $jurnal->where('account', 'PPh 23 Dibayar di Muka')->sum('amount'));
    }

    public function test_alokasi_proporsional_dan_selalu_berjumlah_dibayar_ditambah_potongan(): void
    {
        foreach ([0, 1, 1_000_000, 16_350_000, 32_699_999, 32_700_000] as $dibayar) {
            $a = Invoice::allocatePayments($dibayar, 0, 3_300_000, 600_000, 32_700_000);
            $this->assertSame($dibayar + $a['pph'], $a['tax_deposit'] + $a['ppn'] + $a['revenue'], "dibayar {$dibayar}");
            $this->assertLessThanOrEqual(600_000, $a['pph']);
        }

        $this->assertSame(['tax_deposit' => 0, 'ppn' => 3_300_000, 'revenue' => 30_000_000, 'pph' => 600_000], Invoice::allocatePayments(32_700_000, 0, 3_300_000, 600_000, 32_700_000));
    }

    public function test_ringkasan_dan_statistik_daftar_mengembalikan_potongan_ke_laba(): void
    {
        $this->travelTo(Carbon::parse('2026-10-20 10:00:00'));
        $invoice = $this->buat(['publish' => true]);
        Payment::factory()->create(['invoice_id' => $invoice->id, 'amount' => 32_700_000]);
        $invoice->refresh()->updateStatus();

        $this->actingAs($this->admin)->get('/invoices?month=2026-10')->assertInertia(fn ($page) => $page
            ->where('stats.total_revenue', 32_700_000)
            ->where('stats.total_pph', 600_000)
            // 32.700.000 + 600.000 − 3.300.000 PPN − 10.000.000 HPP.
            ->where('stats.gross_profit', 20_000_000)
            ->where('stats.total_outstanding', 0));

        $this->actingAs($this->admin)->get('/dashboard')->assertInertia(fn ($page) => $page
            // 32.700.000 masuk − 3.300.000 PPN + 600.000 PPh − 10.000.000 HPP.
            ->where('financialOverview.total_profit', 20_000_000));
    }

    public function test_debit_note_tidak_pernah_dipotong_pph(): void
    {
        Company::withoutEvents(fn () => Company::firstOrCreate(['id' => 'samboja-laju-utama'], [
            'organization_id' => Organization::firstOrFail()->id,
            'name' => 'PT Samboja Laju Utama',
            'abbreviation' => 'SLU',
            'status' => 'active',
        ]));
        $this->admin->companies()->syncWithoutDetaching(['samboja-laju-utama']);
        setPermissionsTeamId('samboja-laju-utama');
        $this->admin->unsetRelation('roles')->assignRole('admin');
        setPermissionsTeamId(self::TEST_COMPANY);

        $this->actingAs($this->admin)->post('/c/samboja-laju-utama/invoices', $this->payload(['document_type' => Invoice::TYPE_DEBIT_NOTE]))->assertSessionHasNoErrors();

        $invoice = Invoice::sole();
        $this->assertTrue($invoice->isDebitNote());
        $this->assertNull($invoice->pph_rate);
        $this->assertSame(30_000_000, $invoice->total_amount);
    }

    public function test_editor_mengikuti_pengaturan_perusahaan_dan_keputusan_terakhir_tiap_klien(): void
    {
        $this->actingAs($this->admin)->get('/invoices/create')->assertInertia(fn ($page) => $page
            ->where('pph.enabled', true)
            ->where('pph.rate', 2)
            ->where('pph.clients', []));

        $this->buat(['pph_rate' => '0.5']);
        $tidakMemotong = Client::factory()->create();
        $this->buat(['client_id' => $tidakMemotong->id, 'apply_pph' => false]);
        // Invoice dari sebelum fitur (null) bukan keputusan: tidak menimpa keputusan terakhir.
        Invoice::factory()->create(['billed_to_id' => $tidakMemotong->id, 'pph_rate' => null]);

        $this->actingAs($this->admin)->get('/invoices/create')->assertInertia(fn ($page) => $page
            ->where('pph.rate', 2)
            ->where("pph.clients.{$this->client->id}", 0.5)
            ->where("pph.clients.{$tidakMemotong->id}", 0));
    }

    public function test_pengaturan_pph_disimpan_di_profil_perusahaan(): void
    {
        Permission::firstOrCreate(['name' => 'manage company profile']);
        $this->admin->givePermissionTo('manage company profile');
        $profil = CompanyProfile::current();
        $isian = [
            'name' => 'PT Contoh', 'abbreviation' => 'CTH', 'address' => 'Jl. Contoh', 'email' => 'contoh@example.com',
            'phone' => '0811', 'is_pkp' => '1', 'ppn_rate' => 11, 'finance_manager_name' => 'Nama', 'finance_manager_position' => 'Direktur',
        ];

        $this->actingAs($this->admin)->post('/settings/company', [...$isian, 'pph_enabled' => '1', 'pph_rate' => ''])->assertSessionHasErrors('pph_rate');

        $this->actingAs($this->admin)->post('/settings/company', [...$isian, 'pph_enabled' => '1', 'pph_rate' => '0.5'])->assertSessionHasNoErrors();
        $this->assertTrue($profil->refresh()->pph_enabled);
        $this->assertSame('0.50', $profil->pph_rate);

        $this->actingAs($this->admin)->post('/settings/company', [...$isian, 'pph_enabled' => '0'])->assertSessionHasNoErrors();
        $this->assertFalse($profil->refresh()->pph_enabled);
        $this->assertSame('0.50', $profil->pph_rate, 'tarif bawaan tetap tersimpan saat dimatikan');
    }

    public function test_template_perusahaan_mencetak_baris_pph_seperti_invoice_asli(): void
    {
        $invoice = $this->buat(['publish' => true])->load(['client', 'items.client', 'payments']);

        Company::withoutEvents(fn () => Company::firstOrCreate(['id' => 'samboja-laju-utama'], [
            'organization_id' => Organization::firstOrFail()->id,
            'name' => 'PT Samboja Laju Utama',
            'abbreviation' => 'SLU',
            'status' => 'active',
        ]));
        tenancy()->initialize(Company::findOrFail('samboja-laju-utama'));

        try {
            $html = view(CompanyInvoiceTemplate::view(), (new InvoicePrintService)->buildViewData($invoice, null, null, CompanyInvoiceTemplate::KEY))->render();
            $pdf = (new InvoicePrintService)->renderPdf($invoice, null, null, CompanyInvoiceTemplate::KEY)->output();
        } finally {
            tenancy()->end();
        }

        $this->assertMatchesRegularExpression('#Total Invoice \(Sebelum PPN\)</td>\s*<td class="c-total">.*?30\.000\.000#s', $html);
        $this->assertMatchesRegularExpression('#<td class="c-no">2</td>\s*<td colspan="3" class="label">PPN 11%</td>#', $html);
        $this->assertStringContainsString('Total Invoice + PPN (belum dipotong PPH)', $html);
        $this->assertStringContainsString('33.300.000', $html);
        $this->assertMatchesRegularExpression('#<td class="c-no">3</td>\s*<td colspan="3" class="label">PPH 23 \(2%\)</td>#', $html);
        $this->assertStringContainsString('600.000', $html);
        $this->assertMatchesRegularExpression('#GRAND TOTAL</td>\s*<td class="c-total">.*?32\.700\.000#s', $html);
        // Times New Roman → Tinos tertanam (subset), bukan core font "times" yang bergantung penampil PDF.
        $this->assertStringContainsString('Tinos-Regular', $pdf);
        $this->assertStringContainsString('Tinos-Bold', $pdf);
    }

    public function test_template_bawaan_mencetak_baris_pph_dan_total_setelah_potongan(): void
    {
        $invoice = $this->buat()->load(['client', 'items.client', 'payments']);

        foreach (['kisantra-invoice' => 'PPH 23 2%', 'invoice' => 'PPH 23 2%:', 'semesta-invoice' => 'PPH 23 2%'] as $template => $label) {
            $data = (new InvoicePrintService)->buildViewData($invoice, null, null, $template);
            $html = view("pdf.{$template}", $data)->render();

            $this->assertStringContainsString($label, $html, $template);
            $this->assertStringContainsString('600.000', $html, $template);
            $this->assertStringContainsString('32.700.000', $html, $template);
            $this->assertSame(32_700_000, (int) $data['grand_total'], $template);
        }
    }
}
