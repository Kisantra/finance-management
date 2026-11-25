<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

/**
 * Ubah nomor invoice yang sudah terbit (`PUT /invoices/{invoice}/number`, menu "Ubah nomor" di drawer):
 * nomor diganti tanpa kembali ke draft, urutan nomor ikut nomor baru, status & pembayaran tidak tersentuh.
 */
class UbahNomorInvoiceTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Client $klien;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['view invoices', 'create invoices', 'edit invoices', 'delete invoices'] as $name) {
            Permission::findOrCreate($name, 'web');
        }

        $this->admin = User::factory()->create();
        $this->admin->companies()->syncWithoutDetaching([self::TEST_COMPANY]);
        setPermissionsTeamId(self::TEST_COMPANY);
        $this->admin->givePermissionTo(Permission::all());

        $this->klien = Client::factory()->create(['name' => 'Klien Contoh', 'type' => 'individual']);
    }

    /**
     * @param  array<string, mixed>  $attrs
     */
    private function invoice(array $attrs = []): Invoice
    {
        return Invoice::create(array_merge([
            'billed_to_id' => $this->klien->id,
            'issue_date' => '2026-11-10',
            'due_date' => '2026-11-24',
            'subtotal' => 1_000_000,
            'total_amount' => 1_000_000,
            'status' => 'sent',
            'invoice_number' => '001/INV/SPI-KC/XI/2026',
        ], $attrs));
    }

    public function test_nomor_invoice_terbit_bisa_diubah_dan_urutannya_ikut(): void
    {
        $invoice = $this->invoice();

        $this->actingAs($this->admin)
            ->putJson("/invoices/{$invoice->id}/number", ['invoice_number' => '005/INV/SPI-KC/XI/2026'])
            ->assertOk()
            ->assertJson(['message' => 'Nomor diubah menjadi 005/INV/SPI-KC/XI/2026']);

        $invoice->refresh();
        $this->assertSame('005/INV/SPI-KC/XI/2026', $invoice->invoice_number);
        $this->assertSame(5, $invoice->invoice_sequence);
        $this->assertSame('sent', $invoice->status);

        // Nomor otomatis berikutnya melanjutkan nomor urut tertinggi di periode itu.
        $this->assertStringStartsWith('006/', Invoice::generateInvoiceNumber($invoice->issue_date, $this->klien->id));
    }

    public function test_invoice_lunas_tetap_lunas_setelah_nomornya_diubah(): void
    {
        $invoice = $this->invoice(['status' => 'paid']);

        $this->actingAs($this->admin)
            ->putJson("/invoices/{$invoice->id}/number", ['invoice_number' => 'INV-MANUAL-77'])
            ->assertOk();

        $invoice->refresh();
        $this->assertSame('INV-MANUAL-77', $invoice->invoice_number);
        // Nomor di luar format: tidak punya urutan, sama seperti nomor manual saat terbit.
        $this->assertNull($invoice->invoice_sequence);
        $this->assertSame('paid', $invoice->status);
    }

    public function test_nomor_yang_sudah_dipakai_invoice_lain_ditolak(): void
    {
        $this->invoice(['invoice_number' => '002/INV/SPI-KC/XI/2026']);
        $invoice = $this->invoice();

        $this->actingAs($this->admin)
            ->putJson("/invoices/{$invoice->id}/number", ['invoice_number' => '002/INV/SPI-KC/XI/2026'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['invoice_number' => 'Nomor ini sudah dipakai invoice lain.']);

        $this->assertSame('001/INV/SPI-KC/XI/2026', $invoice->fresh()->invoice_number);
    }

    public function test_nomor_kosong_ditolak(): void
    {
        $invoice = $this->invoice();

        $this->actingAs($this->admin)
            ->putJson("/invoices/{$invoice->id}/number", ['invoice_number' => '   '])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['invoice_number' => 'Nomor invoice wajib diisi.']);

        $this->assertSame('001/INV/SPI-KC/XI/2026', $invoice->fresh()->invoice_number);
    }

    public function test_draft_belum_bernomor_tidak_bisa_diberi_nomor_lewat_sini(): void
    {
        $invoice = $this->invoice(['invoice_number' => null, 'status' => 'draft']);

        $this->actingAs($this->admin)
            ->putJson("/invoices/{$invoice->id}/number", ['invoice_number' => '009/INV/SPI-KC/XI/2026'])
            ->assertUnprocessable()
            ->assertJson(['message' => 'Invoice draft belum bernomor. Nomor diberikan saat diterbitkan.']);

        $invoice->refresh();
        $this->assertNull($invoice->invoice_number);
        $this->assertSame('draft', $invoice->status);
    }

    public function test_pemegang_hak_baca_tidak_bisa_mengubah_nomor(): void
    {
        $pembaca = User::factory()->create();
        $pembaca->companies()->syncWithoutDetaching([self::TEST_COMPANY]);
        setPermissionsTeamId(self::TEST_COMPANY);
        $pembaca->givePermissionTo('view invoices');

        $invoice = $this->invoice();

        $this->actingAs($pembaca)
            ->putJson("/invoices/{$invoice->id}/number", ['invoice_number' => '005/INV/SPI-KC/XI/2026'])
            ->assertForbidden();

        $this->assertSame('001/INV/SPI-KC/XI/2026', $invoice->fresh()->invoice_number);
    }
}
