<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Company;
use App\Models\CompanyProfile;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Organization;
use App\Models\Payment;
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
 * PT Samboja Laju Utama dan PT Berkah Andalan Samboja punya template sendiri; perusahaan test tidak,
 * sehingga tetap memakai template bawaan seperti sebelumnya.
 */
class CompanyInvoiceTemplateTest extends TestCase
{
    use RefreshDatabase;

    private const SLU = 'samboja-laju-utama';

    private const BAS = 'berkah-andalan-samboja';

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

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');

        foreach ([self::SLU => ['PT Samboja Laju Utama', 'SLU'], self::BAS => ['PT Berkah Andalan Samboja', 'BAS']] as $slug => [$name, $abbreviation]) {
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
        $this->profil(self::SLU, ['signature_path' => 'images/ttd.png']);

        $html = $this->renderTemplate(self::SLU, $invoice);

        // Statis di template.
        $this->assertStringContainsString('Telegraphic Transfer (T/T)', $html);
        $this->assertStringContainsString('data:image/jpeg;base64,', $html);
        // Dari Profil perusahaan.
        $this->assertStringContainsString('PT. SAMBOJA LAJU UTAMA', $html);
        $this->assertStringContainsString('Email &nbsp;&nbsp;: sambojalajuutama@gmail.com', $html);
        $this->assertStringContainsString('Telepon: 0811-5513-232', $html);
        $this->assertStringContainsString('An. PT. SAMBOJA LAJU UTAMA', $html);
        $this->assertStringContainsString('148-00-2346343-6', $html);
        $this->assertStringContainsString('Salam Ilham', $html);
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

    public function test_bas_hanya_memakai_template_bas(): void
    {
        $invoice = $this->invoice();
        $base = '/c/'.self::BAS;

        $this->actingAs($this->admin)->get("{$base}/invoice/{$invoice->id}/preview")
            ->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->actingAs($this->admin)->get("{$base}/invoice/{$invoice->id}/preview?template=kisantra-invoice")->assertNotFound();

        $this->actingAs($this->admin)->get("{$base}/invoices")
            ->assertInertia(fn ($page) => $page->where('companyTemplate', ['value' => 'perusahaan', 'label' => 'PT Berkah Andalan Samboja']));
    }

    public function test_pratinjau_bas_menyematkan_font_template(): void
    {
        $response = $this->actingAs($this->admin)->post('/c/'.self::BAS.'/invoices/preview', $this->payload());

        $response->assertOk()->assertHeader('Content-Type', 'application/pdf');
        // Judul Carlito (pengganti Calibri), alamat & kotak info Caladea (pengganti Cambria), dari fonts/.
        $this->assertStringContainsString('Carlito-Bold', $response->getContent());
        $this->assertStringContainsString('Caladea-Regular', $response->getContent());
        $this->assertStringContainsString('Caladea-Bold', $response->getContent());
    }

    public function test_template_bas_menampilkan_desain_statis_dan_data_invoice(): void
    {
        $invoice = $this->invoiceBas();
        Storage::fake('public')->put('images/ttd.png', 'ttd-unggahan');
        $this->profil(self::BAS, ['signature_path' => 'images/ttd.png']);

        $html = $this->renderTemplate(self::BAS, $invoice);

        // Statis di template.
        $this->assertStringContainsString('I N V O I C E', $html);
        $this->assertStringContainsString('Telegraphic Transfer (T/T)', $html);
        $this->assertStringContainsString('data:image/jpeg;base64,', $html);
        // Dari Profil perusahaan; baris baru di alamat ikut tercetak.
        $this->assertStringContainsString('PT. BERKAH ANDALAN SAMBOJA', $html);
        $this->assertStringContainsString('JL. BPPN-HANDIL II RT.003 RW.000<br />', $html);
        $this->assertStringContainsString('Telepon : 0811-5513-232 / 0812-5324-784', $html);
        $this->assertStringContainsString('148-00-23719878', $html);
        $this->assertStringContainsString('Salam Ilham', $html);
        $this->assertStringContainsString('Direktur Utama', $html);
        // Tanda tangan dari upload Profil perusahaan, bukan berkas di repo.
        $this->assertStringContainsString('src="data:image/png;base64,'.base64_encode('ttd-unggahan').'"', $html);

        // Data invoice.
        $this->assertStringContainsString('012/BAS-CES/INV-FINAL/X/2026', $html);
        $this->assertStringContainsString('Invoice FINAL MV. CONTOH SAMUDRA', $html);
        $this->assertStringContainsString('PT. CONTOH ENERGI SAMUDRA', $html);
        $this->assertStringContainsString('Kabupaten Kutai Kartanegara', $html);
        $this->assertStringContainsString('Direktur Finance &amp; Accounting', $html);
        $this->assertStringContainsString('Loading Port : Muara Jawa Anchorage (stevedoring)', $html);
        $this->assertStringContainsString('Quantity (MT)', $html);
        $this->assertStringContainsString('50.000', $html);
        $this->assertStringContainsString('10.400', $html);
        $this->assertStringContainsString('Total Invoice (Sebelum PPN)', $html);
        $this->assertStringContainsString('520.000.000', $html);
        $this->assertStringContainsString('PPN 11%', $html);
        $this->assertStringContainsString('57.200.000', $html);
        $this->assertStringContainsString('GRAND TOTAL', $html);
        $this->assertStringContainsString('577.200.000', $html);
        $this->assertStringContainsString('Samarinda, 24 Oktober 2026', $html);
    }

    public function test_data_perusahaan_dibaca_dari_profil_bukan_dari_template(): void
    {
        $this->profil(self::BAS, [
            'name' => 'PT Berkah Andalan Samboja',
            'address' => 'Jl. Baru No. 2, Balikpapan',
            'phone' => '0812-0000-0000',
            'finance_manager_name' => 'Nama Baru',
            'finance_manager_position' => 'Direktur',
            'signature_city' => null,
            'bank_accounts' => [
                ['bank' => 'BCA', 'account_number' => '111-222', 'account_name' => 'PT. BAS'],
                ['bank' => 'BRI', 'account_number' => '333-444', 'account_name' => 'PT. BAS'],
            ],
        ]);

        $bas = $this->renderTemplate(self::BAS, $this->invoiceBas());

        // Nama & alamat di kotak BAS selalu kapital (desain), data lain apa adanya.
        $this->assertStringContainsString('PT BERKAH ANDALAN SAMBOJA', $bas);
        $this->assertStringContainsString('JL. BARU NO. 2, BALIKPAPAN', $bas);
        $this->assertStringContainsString('0812-0000-0000', $bas);
        $this->assertStringContainsString('111-222', $bas);
        $this->assertStringContainsString('333-444', $bas);
        $this->assertStringContainsString('Nama Baru', $bas);
        $this->assertStringNotContainsString('148-00-23719878', $bas);
        $this->assertStringNotContainsString('Salam Ilham', $bas);
        // Kota kosong: tanggal saja.
        $this->assertStringNotContainsString('Samarinda', $bas);
        $this->assertStringContainsString('<div>24 Oktober 2026</div>', $bas);

        $slu = $this->renderTemplate(self::SLU, $this->invoice());
        $this->assertStringContainsString('<div class="nama">PT BERKAH ANDALAN SAMBOJA</div>', $slu);
        $this->assertStringContainsString('Nomor rekening bank: 333-444', $slu);
        $this->assertStringNotContainsString('148-00-2346343-6', $slu);
    }

    public function test_template_bas_satuan_per_baris_bila_item_bersatuan_beda(): void
    {
        $invoice = $this->invoiceBas();
        InvoiceItem::factory()->create([
            'invoice_id' => $invoice->id,
            'client_id' => $invoice->billed_to_id,
            'service_name' => 'Sewa Floating Crane MV. CONTOH SAMUDRA',
            'description' => null,
            'quantity' => 3,
            'unit' => 'Day',
            'unit_price' => 15_000_000,
            'amount' => 45_000_000,
            'cogs_amount' => 0,
            'is_tax_deposit' => false,
        ]);

        $html = $this->renderTemplate(self::BAS, $invoice);

        $this->assertStringContainsString('<th class="c-qty">Quantity</th>', $html);
        $this->assertStringContainsString('50.000 MT', $html);
        $this->assertStringContainsString('3 Day', $html);
        // Nomor baris PPN melanjutkan nomor item, seperti dokumen asli.
        $this->assertMatchesRegularExpression('#<td class="c-no">3</td>\s*<td colspan="3" class="label">PPN 11%</td>#', $html);
    }

    public function test_template_bas_mode_uang_muka_dan_pelunasan(): void
    {
        $invoice = $this->invoiceBas();

        $dp = $this->renderTemplate(self::BAS, $invoice, dpAmount: 200_000_000);
        $this->assertStringContainsString('TAGIHAN UANG MUKA (DP 38%)', $dp);
        $this->assertStringContainsString('200.000.000', $dp);
        $this->assertStringNotContainsString('>GRAND TOTAL<', $dp);

        Payment::factory()->create(['invoice_id' => $invoice->id, 'amount' => 200_000_000]);
        $pelunasan = $this->renderTemplate(self::BAS, $invoice->refresh(), pelunasanAmount: 377_200_000);
        $this->assertStringContainsString('Pembayaran Diterima', $pelunasan);
        $this->assertStringContainsString('TAGIHAN PELUNASAN', $pelunasan);
        $this->assertStringContainsString('377.200.000', $pelunasan);
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
            $this->assertSame('', CompanyInvoiceTemplate::path('fonts/Caladea-Regular.ttf'), 'font BAS bukan milik SLU');
            $this->assertSame('', CompanyInvoiceTemplate::path('fonts/../invoice.blade.php'));
            $this->assertSame('', CompanyInvoiceTemplate::path('/etc/hosts'));
        } finally {
            tenancy()->end();
        }

        tenancy()->initialize(Company::findOrFail(self::BAS));

        try {
            $this->assertSame('pdf.perusahaan.berkah-andalan-samboja.invoice', CompanyInvoiceTemplate::view());
            $this->assertStringStartsWith('data:image/jpeg;base64,', CompanyInvoiceTemplate::asset('logo.jpg'));
            $this->assertStringEndsWith('/berkah-andalan-samboja/fonts/Caladea-Regular.ttf', CompanyInvoiceTemplate::path('fonts/Caladea-Regular.ttf'));
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

    /**
     * Profil perusahaan berisi data yang dulu tertulis di template SLU/BAS (suite ini satu database,
     * jadi satu profil untuk semua perusahaan).
     *
     * @param  array<string, mixed>  $override
     */
    private function profil(string $slug, array $override = []): CompanyProfile
    {
        $data = $slug === self::SLU ? [
            'name' => 'PT. SAMBOJA LAJU UTAMA',
            'address' => 'Jalan Raya Balikpapan – Handil II, Desa/Kelurahan Samboja Kuala, Kec. Samboja, Kab. Kutai Kartanegara, Provinsi Kalimantan Timur.',
            'email' => 'sambojalajuutama@gmail.com',
            'phone' => '0811-5513-232',
            'bank_accounts' => [['bank' => 'Bank Mandiri', 'account_number' => '148-00-2346343-6', 'account_name' => 'PT. SAMBOJA LAJU UTAMA']],
        ] : [
            'name' => 'PT. BERKAH ANDALAN SAMBOJA',
            'address' => "JL. BPPN-HANDIL II RT.003 RW.000\nTELUK PEMEDAS, SAMBOJA\nKAB. KUTAI KARTANEGARA\nKALIMANTAN TIMUR",
            'email' => 'berkahandalansamboja@example.com',
            'phone' => '0811-5513-232 / 0812-5324-784',
            'bank_accounts' => [['bank' => 'Bank Mandiri', 'account_number' => '148-00-23719878', 'account_name' => 'PT. BERKAH ANDALAN SAMBOJA']],
        ];

        return CompanyProfile::factory()->create([
            ...$data,
            'finance_manager_name' => 'Salam Ilham',
            'finance_manager_position' => 'Direktur Utama',
            'signature_city' => 'Samarinda',
            'signature_path' => null,
            'stamp_path' => null,
            ...$override,
        ]);
    }

    /**
     * HTML template perusahaan $slug untuk invoice ini (tanpa DomPDF), dengan data yang sama seperti cetak.
     */
    private function renderTemplate(string $slug, Invoice $invoice, ?int $dpAmount = null, ?int $pelunasanAmount = null): string
    {
        tenancy()->initialize(Company::findOrFail($slug));

        try {
            return view(
                CompanyInvoiceTemplate::view(),
                (new InvoicePrintService)->buildViewData($invoice->load(['client', 'items.client', 'payments']), $dpAmount, $pelunasanAmount, CompanyInvoiceTemplate::KEY),
            )->render();
        } finally {
            tenancy()->end();
        }
    }

    private function invoiceBas(): Invoice
    {
        $client = Client::factory()->create([
            'name' => 'PT. CONTOH ENERGI SAMUDRA',
            'address' => 'Jl. Contoh Pelabuhan No. 5, Desa Contoh Pesisir, Kabupaten Kutai Kartanegara, Provinsi Kalimantan Timur',
            'person_in_charge' => 'Direktur Finance & Accounting',
        ]);

        $invoice = Invoice::factory()->sent()->create([
            'billed_to_id' => $client->id,
            'invoice_number' => '012/BAS-CES/INV-FINAL/X/2026',
            'subject' => 'Invoice FINAL MV. CONTOH SAMUDRA',
            'issue_date' => '2026-10-24',
            'due_date' => '2026-11-07',
            'subtotal' => 520_000_000,
            'discount_amount' => 0,
            'discount_type' => 'fixed',
            'discount_value' => 0,
            'ppn_rate' => 11,
            'ppn_amount' => 57_200_000,
            'total_amount' => 577_200_000,
        ]);
        InvoiceItem::factory()->create([
            'invoice_id' => $invoice->id,
            'client_id' => $client->id,
            'service_name' => 'MV. CONTOH SAMUDRA',
            'description' => 'Loading Port : Muara Jawa Anchorage (stevedoring)',
            'quantity' => 50000,
            'unit' => 'MT',
            'unit_price' => 10_400,
            'amount' => 520_000_000,
            'cogs_amount' => 0,
            'is_tax_deposit' => false,
        ]);

        return $invoice;
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
