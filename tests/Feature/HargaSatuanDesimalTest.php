<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Company;
use App\Models\CompanyProfile;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Organization;
use App\Models\User;
use App\Services\InvoicePrintService;
use App\Services\ItemColumns;
use App\Services\TemplateTokens;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Harga satuan item invoice & Debit Note boleh bersen (0,85; 4,35; 9.459,46) di semua perusahaan:
 * invoice_items.unit_price decimal(15,2), maksimal dua angka di belakang koma. Jumlah baris tetap Rupiah
 * bulat (round(qty × harga), sama dengan editor), sehingga PPN, PPh, total, pembayaran, dan laporan tetap
 * bilangan bulat.
 */
class HargaSatuanDesimalTest extends TestCase
{
    use RefreshDatabase;

    private const SLU = 'samboja-laju-utama';

    private User $admin;

    private Client $client;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
        $permissions = ['view invoices', 'create invoices', 'edit invoices', 'view dashboard'];
        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
        }
        Role::firstOrCreate(['name' => 'admin'])->syncPermissions($permissions);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');

        CompanyProfile::factory()->create(['is_pkp' => true, 'ppn_rate' => 11, 'bank_accounts' => []]);
        $this->client = Client::factory()->company()->create(['name' => 'PT. CONTOH HARGA BERSEN', 'alias' => 'CHB']);

        $this->travelTo(Carbon::parse('2026-11-20 10:00:00'));
    }

    /**
     * @param  list<array<string, mixed>>  $items
     * @param  array<string, mixed>  $extra
     */
    private function payload(array $items, array $extra = []): array
    {
        return [
            'client_id' => $this->client->id,
            'issue_date' => '2026-11-20',
            'due_date' => '2026-12-04',
            ...$extra,
            'items' => collect($items)->map(fn (array $item) => [
                'service_name' => 'Jasa',
                'quantity' => 1,
                'unit' => 'MT',
                'cogs_amount' => 0,
                'is_tax_deposit' => false,
                ...$item,
            ])->all(),
        ];
    }

    public function test_harga_satuan_bersen_disimpan_dan_jumlah_baris_dibulatkan_ke_rupiah(): void
    {
        $this->actingAs($this->admin)->post('/invoices', $this->payload([
            ['unit_price' => 0.85, 'quantity' => 3],
            ['unit_price' => 4.35, 'quantity' => 10],
            ['unit_price' => 9459.46, 'quantity' => 56000],
        ]))->assertSessionHasNoErrors();

        $invoice = Invoice::with('items')->latest('id')->firstOrFail();

        $this->assertSame([0.85, 4.35, 9459.46], $invoice->items->pluck('unit_price')->all());
        // 3 × 0,85 = 2,55 → 3; 10 × 4,35 = 43,5 → 44; 56.000 × 9.459,46 = 529.729.760 (invoice FINAL asli AOE).
        $this->assertSame([3, 44, 529_729_760], $invoice->items->pluck('amount')->all());
        $this->assertSame(529_729_807, $invoice->subtotal);
        // PPN dari DPP Rupiah bulat: round(529.729.807 × 11%) = 58.270.279.
        $this->assertSame(58_270_279, $invoice->ppn_amount);
        $this->assertSame(588_000_086, $invoice->total_amount);
    }

    public function test_harga_satuan_berlaku_juga_untuk_debit_note(): void
    {
        Company::withoutEvents(fn () => Company::firstOrCreate(['id' => self::SLU], [
            'organization_id' => Organization::firstOrFail()->id,
            'name' => 'PT Samboja Laju Utama',
            'abbreviation' => 'SLU',
            'status' => 'active',
        ]));
        $this->admin->companies()->syncWithoutDetaching([self::SLU]);
        setPermissionsTeamId(self::SLU);
        $this->admin->unsetRelation('roles')->assignRole('admin');
        setPermissionsTeamId(self::TEST_COMPANY);

        $this->actingAs($this->admin)->post('/c/'.self::SLU.'/invoices', $this->payload(
            [['service_name' => 'PNBP', 'unit_price' => 4.35, 'quantity' => 3]],
            ['document_type' => Invoice::TYPE_DEBIT_NOTE],
        ))->assertSessionHasNoErrors();

        $debitNote = Invoice::with('items')->latest('id')->firstOrFail();

        $this->assertTrue($debitNote->isDebitNote());
        $this->assertSame(4.35, $debitNote->items->first()->unit_price);
        // 3 × 4,35 = 13,05 → 13, talangan tanpa PPN.
        $this->assertSame(13, $debitNote->items->first()->amount);
        $this->assertSame(13, $debitNote->total_amount);
    }

    public function test_lebih_dari_dua_angka_di_belakang_koma_ditolak(): void
    {
        $this->actingAs($this->admin)->post('/invoices', $this->payload([['unit_price' => 0.855]]))
            ->assertSessionHasErrors(['items.0.unit_price' => 'Harga satuan baris 1 maksimal dua angka di belakang koma.']);

        $this->actingAs($this->admin)->post('/invoices', $this->payload([['unit_price' => 'abc']]))
            ->assertSessionHasErrors(['items.0.unit_price' => 'Harga satuan baris 1 harus berupa angka.']);

        $this->actingAs($this->admin)->post('/invoices/preview', $this->payload([['unit_price' => 0.855]]))
            ->assertSessionHasErrors('items.0.unit_price');

        $this->assertSame(0, Invoice::count());
    }

    public function test_editor_dan_drawer_menerima_harga_bersen_sebagai_angka(): void
    {
        $this->actingAs($this->admin)->post('/invoices/preview', $this->payload([['unit_price' => 0.85, 'quantity' => 3]]))
            ->assertOk()->assertHeader('Content-Type', 'application/pdf');

        $this->actingAs($this->admin)->post('/invoices', $this->payload([['unit_price' => 0.85, 'quantity' => 3]]))->assertSessionHasNoErrors();
        $invoice = Invoice::latest('id')->firstOrFail();

        $this->actingAs($this->admin)->getJson("/invoices/{$invoice->id}/data")
            ->assertOk()
            ->assertJsonPath('items.0.unit_price', 0.85)
            ->assertJsonPath('items.0.amount', 3);
    }

    public function test_pdf_bawaan_dan_template_builder_mencetak_sen(): void
    {
        $this->actingAs($this->admin)->post('/invoices', $this->payload([
            ['service_name' => 'Tarif bersen', 'unit_price' => 9459.46, 'quantity' => 2],
            ['service_name' => 'Tarif bulat', 'unit_price' => 1_500_000, 'quantity' => 1],
        ]))->assertSessionHasNoErrors();
        $invoice = Invoice::with(['client', 'items.client', 'payments'])->latest('id')->firstOrFail();

        foreach (['kisantra-invoice', 'invoice', 'semesta-invoice'] as $template) {
            $html = view('pdf.'.$template, (new InvoicePrintService)->buildViewData($invoice, null, null, $template))->render();

            $this->assertStringContainsString('9.459,46', $html, $template);
            $this->assertStringContainsString('18.919', $html, $template);
            $this->assertStringContainsString('1.500.000', $html, $template);
            $this->assertStringNotContainsString('1.500.000,00', $html, $template);
        }

        $kolom = collect(ItemColumns::catalog())->firstWhere('key', 'unit_price');
        $this->assertSame('Rp 9.459,46', $kolom['resolve']($invoice->items[0], 0));
        $this->assertSame('Rp 1.500.000', $kolom['resolve']($invoice->items[1], 1));
        $this->assertSame('Rp 1.500.000', TemplateTokens::formatRupiah(1_500_000));
        $this->assertSame('Rp 0,85', TemplateTokens::formatRupiah((new InvoiceItem(['unit_price' => 0.85]))->unit_price));
    }
}
