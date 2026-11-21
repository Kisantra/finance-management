<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Company;
use App\Models\CompanyProfile;
use App\Models\Invoice;
use App\Models\Organization;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Sakelar Debit Note di Profil perusahaan (`company_profiles.debit_note_enabled`, bawaan mati): editor baru
 * menawarkan jenis dokumen Invoice / Debit Note setelah dinyalakan, dan hanya untuk perusahaan bertemplate
 * Debit Note. Debit Note yang sudah ada tetap bisa dibuka, diubah, dan diterbitkan walau sakelarnya mati.
 */
class DebitNoteSakelarTest extends TestCase
{
    use RefreshDatabase;

    private const SLU = 'samboja-laju-utama';

    private const BASE = '/c/'.self::SLU;

    private User $admin;

    private Client $client;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
        $permissions = ['view invoices', 'create invoices', 'edit invoices', 'manage company profile'];
        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
        }
        Role::firstOrCreate(['name' => 'admin'])->syncPermissions($permissions);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');

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

        CompanyProfile::factory()->create([
            'name' => 'PT. SAMBOJA LAJU UTAMA',
            'abbreviation' => 'SLU',
            'is_pkp' => true,
            'ppn_rate' => 11,
            'bank_accounts' => [],
            'invoice_number_format' => '{NO}/{PT}-{KLIEN}/{KODE}/{BLN_ROMAWI}/{THN}',
            'invoice_number_padding' => 3,
            'invoice_number_reset' => 'yearly',
        ]);

        $this->client = Client::factory()->company()->create(['name' => 'PT. CONTOH BATUBARA NUSANTARA', 'alias' => 'CBN']);

        $this->travelTo(Carbon::parse('2026-11-18 10:00:00'));
    }

    /** @return array<string, mixed> */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'client_id' => $this->client->id,
            'issue_date' => '2026-11-18',
            'due_date' => '2026-12-02',
            'document_type' => Invoice::TYPE_DEBIT_NOTE,
            'document_code' => 'PNBP',
            'items' => [
                ['service_name' => 'PNBP Jasa Kepelabuhanan', 'quantity' => 1, 'unit' => 'LS', 'unit_price' => 24_000_000, 'cogs_amount' => 0, 'is_tax_deposit' => false],
            ],
        ], $overrides);
    }

    /** @return array<string, mixed> */
    private function profil(array $overrides = []): array
    {
        return array_merge([
            'name' => 'PT. SAMBOJA LAJU UTAMA',
            'abbreviation' => 'SLU',
            'address' => 'Jl. Contoh No. 1, Samboja',
            'email' => 'slu@example.com',
            'phone' => '0811-0000-000',
            'ppn_rate' => 11,
            'finance_manager_name' => 'Nama Direktur',
            'finance_manager_position' => 'Direktur Utama',
        ], $overrides);
    }

    public function test_bawaan_mati_editor_hanya_invoice_dan_debit_note_ditolak(): void
    {
        $this->assertFalse(CompanyProfile::current()->debit_note_enabled);

        $this->actingAs($this->admin)->get(self::BASE.'/invoices/create')
            ->assertInertia(fn ($page) => $page->where('documents.debitNote', false)->where('documents.code', true));

        $this->actingAs($this->admin)->post(self::BASE.'/invoices', $this->payload())->assertSessionHasErrors('document_type');
        $this->actingAs($this->admin)->post(self::BASE.'/invoices/preview', $this->payload())->assertSessionHasErrors('document_type');
        $this->assertSame(0, Invoice::count());

        // Invoice biasa tetap bisa, dengan kode jenis.
        $this->actingAs($this->admin)->post(self::BASE.'/invoices', $this->payload(['document_type' => Invoice::TYPE_INVOICE, 'document_code' => 'FINAL']))
            ->assertSessionHasNoErrors();
        $this->assertSame(Invoice::TYPE_INVOICE, Invoice::sole()->document_type);
    }

    public function test_dinyalakan_dari_profil_perusahaan_lalu_editor_menawarkan_debit_note(): void
    {
        $this->actingAs($this->admin)->get(self::BASE.'/settings/company')->assertInertia(fn ($page) => $page
            ->where('debitNoteTemplate', true)
            ->where('companyProfile.debit_note_enabled', false));

        $this->actingAs($this->admin)->post(self::BASE.'/settings/company', $this->profil(['debit_note_enabled' => '1']))
            ->assertSessionHasNoErrors();
        $this->assertTrue(CompanyProfile::current()->debit_note_enabled);

        $this->actingAs($this->admin)->get(self::BASE.'/invoices/create')
            ->assertInertia(fn ($page) => $page->where('documents.debitNote', true));
        $this->actingAs($this->admin)->post(self::BASE.'/invoices', $this->payload())->assertSessionHasNoErrors();
        $this->assertTrue(Invoice::sole()->isDebitNote());

        // Checkbox tak dicentang tidak terkirim = mati.
        $this->actingAs($this->admin)->post(self::BASE.'/settings/company', $this->profil())->assertSessionHasNoErrors();
        $this->assertFalse(CompanyProfile::current()->debit_note_enabled);
    }

    public function test_debit_note_lama_tetap_bisa_diubah_dan_diterbitkan_saat_sakelar_mati(): void
    {
        CompanyProfile::current()->update(['debit_note_enabled' => true]);
        $this->actingAs($this->admin)->post(self::BASE.'/invoices', $this->payload())->assertSessionHasNoErrors();
        $debitNote = Invoice::sole();
        CompanyProfile::current()->update(['debit_note_enabled' => false]);

        // Editor dokumen ini tetap menawarkan jenis dokumen (agar tidak diam-diam menjadi invoice).
        $this->actingAs($this->admin)->get(self::BASE."/invoices/{$debitNote->id}/edit")
            ->assertInertia(fn ($page) => $page->where('documents.debitNote', true)->where('invoice.document_type', Invoice::TYPE_DEBIT_NOTE));

        $this->actingAs($this->admin)->put(self::BASE."/invoices/{$debitNote->id}", $this->payload([
            'items' => [['service_name' => 'PNBP Jasa Kepelabuhanan', 'quantity' => 1, 'unit' => 'LS', 'unit_price' => 25_000_000, 'cogs_amount' => 0, 'is_tax_deposit' => false]],
        ]))->assertSessionHasNoErrors();
        $this->assertSame(25_000_000, $debitNote->fresh()->total_amount);
        $this->assertTrue($debitNote->fresh()->isDebitNote());

        // Pratinjau & nomor berikutnya untuk draft Debit Note itu tetap jalan.
        $this->actingAs($this->admin)->post(self::BASE.'/invoices/preview', $this->payload(['invoice_id' => $debitNote->id]))->assertOk();
        $this->actingAs($this->admin)->getJson(self::BASE.'/invoices/next-number?'.http_build_query([
            'client_id' => $this->client->id,
            'issue_date' => '2026-11-18',
            'document_type' => Invoice::TYPE_DEBIT_NOTE,
            'document_code' => 'PNBP',
        ]))->assertOk()->assertJsonPath('number', '001/SLU-CBN/DN-PNBP/XI/2026');

        // Dokumen lain (invoice) tidak bisa diubah menjadi Debit Note selama sakelar mati.
        $this->actingAs($this->admin)->post(self::BASE.'/invoices', $this->payload(['document_type' => Invoice::TYPE_INVOICE]))->assertSessionHasNoErrors();
        $invoice = Invoice::latest('id')->first();
        $this->actingAs($this->admin)->put(self::BASE."/invoices/{$invoice->id}", $this->payload())->assertSessionHasErrors('document_type');
    }

    public function test_perusahaan_tanpa_template_debit_note_tidak_melihat_sakelar_dan_tetap_ditolak(): void
    {
        CompanyProfile::current()->update(['debit_note_enabled' => true]);

        $this->actingAs($this->admin)->get('/settings/company')
            ->assertInertia(fn ($page) => $page->where('debitNoteTemplate', false));
        $this->actingAs($this->admin)->get('/invoices/create')
            ->assertInertia(fn ($page) => $page->where('documents.debitNote', false));
        $this->actingAs($this->admin)->post('/invoices', $this->payload())->assertSessionHasErrors('document_type');
    }
}
