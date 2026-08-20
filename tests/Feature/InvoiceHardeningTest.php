<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\CompanyProfile;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

/**
 * Regresi TEMUAN I-04..I-09 pada modul Invoices.
 */
class InvoiceHardeningTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Client $klien;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'view invoices', 'create invoices', 'edit invoices', 'delete invoices',
        ] as $name) {
            Permission::findOrCreate($name, 'web');
        }

        $this->admin = User::factory()->create();
        $this->admin->companies()->syncWithoutDetaching([self::TEST_COMPANY]);
        setPermissionsTeamId(self::TEST_COMPANY);
        $this->admin->givePermissionTo(Permission::all());

        $this->klien = Client::factory()->create();
    }

    private function invoice(array $attrs = []): Invoice
    {
        $invoice = Invoice::create(array_merge([
            'billed_to_id' => $this->klien->id,
            'issue_date' => now(),
            'due_date' => now()->addDays(7),
            'subtotal' => 1_000_000,
            'total_amount' => 1_000_000,
            'status' => 'sent',
            'invoice_number' => '001/INV/TST-KL/VIII/2026',
        ], $attrs));

        InvoiceItem::create([
            'invoice_id' => $invoice->id,
            'client_id' => $this->klien->id,
            'service_name' => 'Jasa',
            'description' => 'Jasa',
            'quantity' => 1,
            'unit_price' => 1_000_000,
            'amount' => 1_000_000,
        ]);

        return $invoice;
    }

    /** TEMUAN I-04 — invoice bernomor tidak boleh jatuh ke draft saat pembayarannya nol. */
    public function test_invoice_bernomor_kembali_ke_sent_bukan_draft(): void
    {
        $invoice = $this->invoice(['status' => 'partially_paid']);
        $invoice->updateStatus();

        $this->assertSame('sent', $invoice->fresh()->status);
    }

    /** Invoice tanpa nomor tetap draft — nomor adalah penanda dokumen pernah terbit. */
    public function test_invoice_tanpa_nomor_tetap_draft(): void
    {
        $invoice = $this->invoice(['invoice_number' => null, 'status' => 'draft']);
        $invoice->updateStatus();

        $this->assertSame('draft', $invoice->fresh()->status);
    }

    /** TEMUAN I-05 — diskon persen di atas 100% ditolak. */
    public function test_diskon_persen_di_atas_seratus_ditolak(): void
    {
        $this->actingAs($this->admin)
            ->post('/invoices', $this->payloadInvoice(['discount_type' => 'percentage', 'discount_value' => 150]))
            ->assertSessionHasErrors('discount_value');
    }

    /** TEMUAN I-05 — diskon nominal melebihi subtotal ditolak. */
    public function test_diskon_nominal_melebihi_subtotal_ditolak(): void
    {
        $this->actingAs($this->admin)
            ->post('/invoices', $this->payloadInvoice(['discount_type' => 'fixed', 'discount_value' => 5_000_000]))
            ->assertSessionHasErrors('discount_value');
    }

    /** TEMUAN I-06 — diskon pecahan ditolak terang-terangan, bukan dipotong diam-diam. */
    public function test_diskon_pecahan_ditolak_dengan_pesan(): void
    {
        $this->actingAs($this->admin)
            ->post('/invoices', $this->payloadInvoice(['discount_type' => 'percentage', 'discount_value' => 12.5]))
            ->assertSessionHasErrors('discount_value');

        $this->assertDatabaseCount('invoices', 0);
    }

    /** Diskon yang wajar tetap diterima. */
    public function test_diskon_dalam_batas_diterima(): void
    {
        $this->actingAs($this->admin)
            ->post('/invoices', $this->payloadInvoice(['discount_type' => 'percentage', 'discount_value' => 10]))
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas('invoices', ['discount_amount' => 100_000]);
    }

    /** TEMUAN I-07 — kirim & rollback bukan aksi baca. */
    public function test_pemegang_hak_baca_tidak_dapat_mengirim_atau_rollback(): void
    {
        $pembaca = User::factory()->create();
        $pembaca->companies()->syncWithoutDetaching([self::TEST_COMPANY]);
        setPermissionsTeamId(self::TEST_COMPANY);
        $pembaca->givePermissionTo('view invoices');

        $invoice = $this->invoice(['invoice_number' => null, 'status' => 'draft']);

        $this->actingAs($pembaca)
            ->post("/invoices/{$invoice->id}/send", ['invoice_number' => '009/INV/TST-KL/VIII/2026'])
            ->assertForbidden();

        $this->actingAs($pembaca)
            ->post("/invoices/{$invoice->id}/rollback")
            ->assertForbidden();

        $this->assertNull($invoice->fresh()->invoice_number);
    }

    /** TEMUAN I-08 — PDF tidak boleh 500 saat rekening perusahaan belum diisi. */
    public function test_unduh_pdf_tetap_berhasil_saat_rekening_perusahaan_kosong(): void
    {
        // Kondisi tenant yang baru diprovisioning: profil terisi, rekening belum.
        CompanyProfile::factory()->create(['bank_accounts' => null]);

        $invoice = $this->invoice();

        $this->actingAs($this->admin)
            ->get("/invoice/{$invoice->id}/download")
            ->assertOk();
    }

    /** TEMUAN I-09 — nama template sembarang menghasilkan 404, bukan 500. */
    public function test_template_pdf_tak_dikenal_menghasilkan_404(): void
    {
        $invoice = $this->invoice();

        $this->actingAs($this->admin)
            ->get("/invoice/{$invoice->id}/download?template=tidak-ada")
            ->assertNotFound();
    }

    /**
     * @param  array<string, mixed>  $tambahan
     * @return array<string, mixed>
     */
    private function payloadInvoice(array $tambahan = []): array
    {
        return array_merge([
            'client_id' => $this->klien->id,
            'issue_date' => now()->toDateString(),
            'due_date' => now()->addDays(7)->toDateString(),
            'items' => [[
                'service_name' => 'Jasa',
                'quantity' => 1,
                'unit_price' => 1_000_000,
            ]],
        ], $tambahan);
    }
}
