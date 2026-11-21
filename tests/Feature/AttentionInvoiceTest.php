<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Company;
use App\Models\CompanyProfile;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Organization;
use App\Models\User;
use App\Services\CompanyInvoiceTemplate;
use App\Services\InvoicePrintService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * ATTENTION per dokumen (`invoices.attention`): mengganti PIC klien di baris ATTENTION header template
 * perusahaan; TO tetap nama & alamat klien. Kosong = PIC di data klien seperti sebelumnya. Semua data fiktif.
 */
class AttentionInvoiceTest extends TestCase
{
    use RefreshDatabase;

    /** Semua template perusahaan yang punya baris ATTENTION. */
    private const PERUSAHAAN = [
        'samboja-laju-utama' => ['PT Samboja Laju Utama', 'SLU'],
        'berkah-andalan-samboja' => ['PT Berkah Andalan Samboja', 'BAS'],
        'mitra-kellian-baruna' => ['PT Mitra Kellian Baruna', 'MKB'],
        'bahtera-cipta-bersama' => ['PT Bahtera Cipta Bersama', 'BCB'],
        'abdi-ocean-energy' => ['PT Abdi Ocean Energy', 'AOE'],
        'nusantara-armada-indonesia' => ['PT Nusantara Armada Indonesia', 'NAI'],
    ];

    private const BCB = '/c/bahtera-cipta-bersama';

    private User $admin;

    private Client $client;

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

        foreach (self::PERUSAHAAN as $slug => [$name, $abbreviation]) {
            Company::withoutEvents(fn () => Company::firstOrCreate(['id' => $slug], [
                'organization_id' => Organization::firstOrFail()->id,
                'name' => $name,
                'abbreviation' => $abbreviation,
                'status' => 'active',
            ]));
            $this->admin->companies()->syncWithoutDetaching([$slug]);
            setPermissionsTeamId($slug);
            $this->admin->unsetRelation('roles')->assignRole('admin');
        }
        setPermissionsTeamId(self::TEST_COMPANY);

        CompanyProfile::factory()->create([
            'name' => 'PT. CONTOH PERUSAHAAN',
            'abbreviation' => 'BCB',
            'address' => "Jl. Contoh No. 2,\nKota Samarinda",
            'email' => 'contoh@example.com',
            'phone' => '0811-0000-000',
            'finance_manager_name' => 'Nama Direktur',
            'finance_manager_position' => 'Direktur Utama',
            'signature_city' => 'Samarinda',
            'signature_path' => null,
            'stamp_path' => null,
            'bank_accounts' => [['bank' => 'Bank Contoh', 'account_number' => '000-00-0000000-0', 'account_name' => 'PT. CONTOH PERUSAHAAN']],
            'invoice_number_format' => '{NO}/{PT}-{KLIEN}/{KODE}/{BLN_ROMAWI}/{THN}',
        ]);

        $this->client = Client::factory()->company()->create([
            'name' => 'PT. CONTOH AGEN PELAYARAN',
            'alias' => 'CAP',
            'address' => 'Jl. Contoh Agen No. 1, Samarinda',
            'person_in_charge' => 'Bagian Keuangan',
        ]);
    }

    /** @return array<string, mixed> */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'client_id' => $this->client->id,
            'issue_date' => '2026-11-16',
            'due_date' => '2026-11-30',
            'subject' => 'Proforma Debit Note MV. CONTOH FLAME',
            'attention' => '  Direktur Finance & Accounting  ',
            'items' => [
                ['service_name' => 'MV. CONTOH FLAME', 'quantity' => 1, 'unit' => 'LS', 'unit_price' => 10_000_000, 'cogs_amount' => 0, 'is_tax_deposit' => false],
            ],
        ], $overrides);
    }

    private function dokumen(?string $attention): Invoice
    {
        $invoice = Invoice::factory()->sent()->create([
            'billed_to_id' => $this->client->id,
            'invoice_number' => sprintf('%03d/BCB-CAP/INV-FINAL/XI/2026', Invoice::count() + 1),
            'subject' => 'Invoice FINAL MV. CONTOH FLAME',
            'attention' => $attention,
            'issue_date' => '2026-11-16',
            'due_date' => '2026-11-30',
            'subtotal' => 10_000_000,
            'discount_amount' => 0,
            'discount_type' => 'fixed',
            'discount_value' => 0,
            'ppn_rate' => 0,
            'ppn_amount' => 0,
            'total_amount' => 10_000_000,
        ]);
        InvoiceItem::factory()->create([
            'invoice_id' => $invoice->id,
            'client_id' => $this->client->id,
            'service_name' => 'MV. CONTOH FLAME',
            'quantity' => 1,
            'unit' => 'LS',
            'unit_price' => 10_000_000,
            'amount' => 10_000_000,
            'cogs_amount' => 0,
            'is_tax_deposit' => false,
        ]);

        return $invoice;
    }

    private function render(string $slug, Invoice $invoice): string
    {
        tenancy()->initialize(Company::findOrFail($slug));

        try {
            return view(
                CompanyInvoiceTemplate::viewFor(CompanyInvoiceTemplate::KEY, $invoice),
                (new InvoicePrintService)->buildViewData($invoice->load(['client', 'items.client', 'payments']), null, null, CompanyInvoiceTemplate::KEY),
            )->render();
        } finally {
            tenancy()->end();
        }
    }

    public function test_attention_tersimpan_dirapikan_dan_dikirim_ke_editor(): void
    {
        $this->actingAs($this->admin)->post(self::BCB.'/invoices', $this->payload())->assertSessionHasNoErrors();

        $invoice = Invoice::sole();
        $this->assertSame('Direktur Finance & Accounting', $invoice->attention);

        $this->actingAs($this->admin)->get(self::BCB."/invoices/{$invoice->id}/edit")->assertInertia(fn ($page) => $page
            ->where('invoice.attention', 'Direktur Finance & Accounting')
            // PIC klien = ATTENTION bawaan, untuk placeholder isian.
            ->where('clients.0.person_in_charge', 'Bagian Keuangan'));

        // Isian kosong = kembali ke PIC klien (null, bukan string kosong).
        $this->actingAs($this->admin)->put(self::BCB."/invoices/{$invoice->id}", $this->payload(['attention' => '   ']))
            ->assertSessionHasNoErrors();
        $this->assertNull($invoice->fresh()->attention);
    }

    public function test_attention_dibatasi_255_karakter(): void
    {
        $this->actingAs($this->admin)->post(self::BCB.'/invoices', $this->payload(['attention' => str_repeat('a', 256)]))
            ->assertSessionHasErrors('attention');

        $this->assertSame(0, Invoice::count());
    }

    public function test_baris_attention_semua_template_perusahaan_memakai_isian_atau_pic_klien(): void
    {
        $diisi = $this->dokumen('Direktur Finance & Accounting');
        $bawaan = $this->dokumen(null);

        foreach (array_keys(self::PERUSAHAAN) as $slug) {
            $html = $this->render($slug, $diisi);
            $this->assertMatchesRegularExpression('#ATTENTION</td>.*?Direktur Finance &amp; Accounting#s', $html, $slug);
            $this->assertStringNotContainsString('Bagian Keuangan', $html, $slug);
            // TO tetap nama & alamat klien.
            $this->assertStringContainsString('PT. CONTOH AGEN PELAYARAN', $html, $slug);
            $this->assertStringContainsString('Jl. Contoh Agen No. 1, Samarinda', $html, $slug);

            $html = $this->render($slug, $bawaan);
            $this->assertMatchesRegularExpression('#ATTENTION</td>.*?Bagian Keuangan#s', $html, $slug);
            $this->assertStringNotContainsString('Direktur Finance &amp; Accounting', $html, $slug);
        }
    }

    public function test_tanpa_isian_dan_tanpa_pic_klien_baris_attention_tidak_tercetak(): void
    {
        $this->client->update(['person_in_charge' => null]);

        $html = $this->render('bahtera-cipta-bersama', $this->dokumen(null));

        $this->assertStringNotContainsString('>ATTENTION</td>', $html);
    }
}
