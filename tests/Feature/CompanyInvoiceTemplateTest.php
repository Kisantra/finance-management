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
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Template invoice statis per perusahaan (resources/views/pdf/perusahaan/{slug}/invoice.blade.php).
 * PT Samboja Laju Utama punya template sendiri; perusahaan test tidak, sehingga tetap memakai
 * template bawaan seperti sebelumnya.
 */
class CompanyInvoiceTemplateTest extends TestCase
{
    use RefreshDatabase;

    private const SLU = 'samboja-laju-utama';

    protected User $admin;

    protected Client $client;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
        $permissions = ['view invoices', 'create invoices', 'edit invoices'];
        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
        }
        Role::firstOrCreate(['name' => 'admin'])->syncPermissions($permissions);

        Company::withoutEvents(fn () => Company::firstOrCreate(['id' => self::SLU], [
            'organization_id' => Organization::firstOrFail()->id,
            'name' => 'PT Samboja Laju Utama',
            'abbreviation' => 'SLU',
            'status' => 'active',
        ]));

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
        $this->admin->companies()->syncWithoutDetaching([self::SLU]);
        setPermissionsTeamId(self::SLU);
        $this->admin->unsetRelation('roles')->assignRole('admin');
        setPermissionsTeamId(self::TEST_COMPANY);

        $this->client = Client::factory()->create([
            'name' => 'PT. CONTOH BATUBARA NUSANTARA',
            'address' => 'Gedung Contoh Lantai 3, Jakarta Selatan',
            'person_in_charge' => 'Direktur Finance & Accounting',
        ]);
    }

    public function test_perusahaan_tanpa_template_sendiri_tetap_memakai_template_bawaan(): void
    {
        $invoice = $this->invoice();

        $this->actingAs($this->admin)->get("/invoice/{$invoice->id}/preview")
            ->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->actingAs($this->admin)->get("/invoice/{$invoice->id}/preview?template=semesta-invoice")->assertOk();
        $this->actingAs($this->admin)->get("/invoice/{$invoice->id}/preview?template=perusahaan")->assertNotFound();

        $this->actingAs($this->admin)->get('/invoices')
            ->assertInertia(fn ($page) => $page->where('companyTemplate', null));
    }

    public function test_perusahaan_bertemplate_hanya_memakai_templatenya_sendiri(): void
    {
        $invoice = $this->invoice();
        $base = '/c/'.self::SLU;

        $this->actingAs($this->admin)->get("{$base}/invoice/{$invoice->id}/preview")
            ->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->actingAs($this->admin)->get("{$base}/invoice/{$invoice->id}/download?template=perusahaan")->assertOk();

        // Template bawaan milik perusahaan lain tidak boleh dipakai lewat URL.
        $this->actingAs($this->admin)->get("{$base}/invoice/{$invoice->id}/preview?template=kisantra-invoice")->assertNotFound();
        $this->actingAs($this->admin)->post("{$base}/invoices/preview", [...$this->payload(), 'template' => 'agsa-invoice'])
            ->assertSessionHasErrors('template');

        $this->actingAs($this->admin)->get("{$base}/invoices")
            ->assertInertia(fn ($page) => $page->where('companyTemplate', ['value' => 'perusahaan', 'label' => 'PT Samboja Laju Utama']));
        $this->actingAs($this->admin)->get("{$base}/invoices/create")
            ->assertInertia(fn ($page) => $page->where('companyTemplate.value', 'perusahaan'));
        $this->actingAs($this->admin)->getJson("{$base}/invoices/{$invoice->id}/data")
            ->assertJsonPath('company_template.value', 'perusahaan');
    }

    public function test_pratinjau_editor_perusahaan_bertemplate_memakai_template_perusahaan(): void
    {
        $response = $this->actingAs($this->admin)->post('/c/'.self::SLU.'/invoices/preview', $this->payload());

        $response->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringStartsWith('%PDF-', $response->getContent());
        // Font judul dari folder template ikut tertanam (subset). Tanpa chroot proyek DomPDF
        // menolak berkas itu diam-diam dan judul jatuh ke Helvetica.
        $this->assertStringContainsString('Carlito-Bold', $response->getContent());
    }

    public function test_template_slu_menampilkan_desain_statis_dan_data_invoice(): void
    {
        $invoice = $this->invoice();
        Storage::fake('public')->put('images/ttd.png', 'ttd-unggahan');
        CompanyProfile::factory()->create(['signature_path' => 'images/ttd.png', 'stamp_path' => null]);

        tenancy()->initialize(Company::findOrFail(self::SLU));

        try {
            $html = view(
                CompanyInvoiceTemplate::view(),
                (new InvoicePrintService)->buildViewData($invoice->load(['client', 'items.client', 'payments']), null, null, CompanyInvoiceTemplate::KEY),
            )->render();
        } finally {
            tenancy()->end();
        }

        // Statis di template.
        $this->assertStringContainsString('PT. SAMBOJA LAJU UTAMA', $html);
        $this->assertStringContainsString('148-00-2346343-6', $html);
        $this->assertStringContainsString('Telegraphic Transfer (T/T)', $html);
        $this->assertStringContainsString('data:image/jpeg;base64,', $html);
        // Tanda tangan dari upload Profil perusahaan, bukan berkas di repo.
        $this->assertStringContainsString('src="data:image/png;base64,'.base64_encode('ttd-unggahan').'"', $html);

        // Data invoice.
        $this->assertStringContainsString('037/SLU-CBN/INV-FINAL/X/2026', $html);
        $this->assertStringContainsString('Invoice FINAL MV. CONTOH JAYA', $html);
        $this->assertStringContainsString('Direktur Finance &amp; Accounting', $html);
        $this->assertStringContainsString('Loading Port : Muara Jawa<br />', $html);
        $this->assertStringContainsString('Quantity (MT)', $html);
        $this->assertStringContainsString('480.000.000', $html);
        $this->assertStringContainsString('52.800.000', $html);
        $this->assertStringContainsString('532.800.000', $html);
        $this->assertStringContainsString('Samarinda, 10 Oktober 2026', $html);
    }

    public function test_aset_template_hanya_dari_folder_perusahaan_aktif(): void
    {
        $this->assertSame('', CompanyInvoiceTemplate::asset('logo.jpg'), 'tanpa konteks perusahaan tidak ada aset');

        tenancy()->initialize(Company::findOrFail(self::SLU));

        try {
            $this->assertStringStartsWith('data:image/jpeg;base64,', CompanyInvoiceTemplate::asset('logo.jpg'));
            $this->assertSame('', CompanyInvoiceTemplate::asset('../invoice.blade.php'));
            $this->assertSame('', CompanyInvoiceTemplate::asset('tidak-ada.png'));
            $this->assertStringEndsWith('/samboja-laju-utama/fonts/Carlito-Bold.ttf', CompanyInvoiceTemplate::path('fonts/Carlito-Bold.ttf'));
            $this->assertSame('', CompanyInvoiceTemplate::path('fonts/../invoice.blade.php'));
            $this->assertSame('', CompanyInvoiceTemplate::path('/etc/hosts'));
        } finally {
            tenancy()->end();
        }
    }

    public function test_perihal_dan_keterangan_item_tersimpan_dan_dikirim_ke_editor(): void
    {
        $this->actingAs($this->admin)->post('/invoices', $this->payload())->assertRedirect();

        $invoice = Invoice::with('items')->sole();
        $this->assertSame('Invoice FINAL MV. CONTOH JAYA', $invoice->subject);
        $this->assertSame("Loading Port : Muara Jawa\nAnchorage ( Stevedoring )", $invoice->items->first()->description);

        $this->actingAs($this->admin)->get("/invoices/{$invoice->id}/edit")
            ->assertInertia(fn ($page) => $page
                ->where('invoice.subject', 'Invoice FINAL MV. CONTOH JAYA')
                ->where('invoice.items.0.description', "Loading Port : Muara Jawa\nAnchorage ( Stevedoring )"));
        $this->actingAs($this->admin)->getJson("/invoices/{$invoice->id}/data")
            ->assertJsonPath('subject', 'Invoice FINAL MV. CONTOH JAYA')
            ->assertJsonPath('items.0.description', "Loading Port : Muara Jawa\nAnchorage ( Stevedoring )");

        // Isian kosong disimpan sebagai null, bukan string kosong.
        $this->actingAs($this->admin)->put("/invoices/{$invoice->id}", [
            ...$this->payload(),
            'subject' => '   ',
            'items' => [[...$this->payload()['items'][0], 'description' => '']],
        ])->assertRedirect();

        $invoice->refresh()->load('items');
        $this->assertNull($invoice->subject);
        $this->assertNull($invoice->items->first()->description);
    }

    public function test_keterangan_item_dibatasi_2000_karakter(): void
    {
        $this->actingAs($this->admin)->post('/invoices', [
            ...$this->payload(),
            'items' => [[...$this->payload()['items'][0], 'description' => str_repeat('a', 2001)]],
        ])->assertSessionHasErrors('items.0.description');
    }

    private function invoice(): Invoice
    {
        $invoice = Invoice::factory()->sent()->create([
            'billed_to_id' => $this->client->id,
            'invoice_number' => '037/SLU-CBN/INV-FINAL/X/2026',
            'subject' => 'Invoice FINAL MV. CONTOH JAYA',
            'issue_date' => '2026-10-10',
            'due_date' => '2026-10-24',
            'subtotal' => 480_000_000,
            'discount_amount' => 0,
            'discount_type' => 'fixed',
            'discount_value' => 0,
            'ppn_rate' => 11,
            'ppn_amount' => 52_800_000,
            'total_amount' => 532_800_000,
        ]);
        InvoiceItem::factory()->create([
            'invoice_id' => $invoice->id,
            'client_id' => $this->client->id,
            'service_name' => 'MV. CONTOH JAYA',
            'description' => "Loading Port : Muara Jawa\nAnchorage ( Stevedoring )",
            'quantity' => 40000,
            'unit' => 'MT',
            'unit_price' => 12_000,
            'amount' => 480_000_000,
            'cogs_amount' => 0,
            'is_tax_deposit' => false,
        ]);

        return $invoice;
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(): array
    {
        return [
            'client_id' => $this->client->id,
            'subject' => 'Invoice FINAL MV. CONTOH JAYA',
            'issue_date' => '2026-10-10',
            'due_date' => '2026-10-24',
            'items' => [[
                'service_name' => 'MV. CONTOH JAYA',
                'description' => "Loading Port : Muara Jawa\nAnchorage ( Stevedoring )",
                'quantity' => 40000,
                'unit' => 'MT',
                'unit_price' => 12_000,
                'cogs_amount' => 0,
                'is_tax_deposit' => false,
            ]],
        ];
    }
}
