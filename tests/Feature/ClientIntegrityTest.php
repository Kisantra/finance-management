<?php

namespace Tests\Feature;

use App\Models\BankAccount;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

/**
 * Regresi TEMUAN C-01..C-04 pada modul Clients.
 */
class ClientIntegrityTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'view clients', 'create clients', 'edit clients', 'delete clients',
            'view invoices', 'create invoices', 'delete invoices',
        ] as $name) {
            Permission::findOrCreate($name, 'web');
        }

        $this->admin = User::factory()->create();
        $this->admin->companies()->syncWithoutDetaching([self::TEST_COMPANY]);
        setPermissionsTeamId(self::TEST_COMPANY);
        $this->admin->givePermissionTo(Permission::all());
    }

    private function client(array $attrs = []): Client
    {
        return Client::create(array_merge([
            'name' => 'Klien Uji',
            'type' => 'company',
            'status' => Client::STATUS_ACTIVE,
        ], $attrs));
    }

    /** TEMUAN C-01 — grup OR tanpa closure membuat filter tipe bocor. */
    public function test_pencarian_digabung_filter_tipe_tidak_bocor(): void
    {
        $this->client(['name' => 'Rina Perorangan', 'type' => 'individual']);
        $this->client(['name' => 'PT Alpha Beta Gamma', 'type' => 'company']);

        $response = $this->actingAs($this->admin)
            ->get('/clients?search=Rina&type=company');

        $response->assertOk();
        $nama = collect($response->viewData('page')['props']['clients']['data'])->pluck('name');

        $this->assertNotContains('Rina Perorangan', $nama,
            'Klien individual tidak boleh muncul saat filter type=company.');
        $this->assertCount(0, $nama);
    }

    /** TEMUAN C-01 — hal yang sama untuk filter status. */
    public function test_pencarian_digabung_filter_status_tidak_bocor(): void
    {
        $this->client(['name' => 'Rina Perorangan', 'type' => 'individual']);

        $response = $this->actingAs($this->admin)
            ->get('/clients?search=Rina&status='.Client::STATUS_INACTIVE);

        $response->assertOk();
        $this->assertCount(0, $response->viewData('page')['props']['clients']['data']);
    }

    /** Kolom urut sembarang dulu menghasilkan 500 beserta nama database. */
    public function test_kolom_urut_sembarang_tidak_menjatuhkan_halaman(): void
    {
        $this->client();

        $this->actingAs($this->admin)
            ->get('/clients?sort=(select+1)&direction=drop')
            ->assertOk();
    }

    /** TEMUAN C-02 — klien yang masih punya invoice tidak boleh terhapus. */
    public function test_klien_dengan_invoice_tidak_dapat_dihapus(): void
    {
        $klien = $this->client();
        Invoice::create([
            'billed_to_id' => $klien->id,
            'invoice_number' => '001/INV/TST/VIII/2026',
            'issue_date' => now(),
            'due_date' => now()->addDays(7),
            'subtotal' => 1_000_000,
            'total_amount' => 1_000_000,
            'status' => 'sent',
        ]);

        $this->actingAs($this->admin)
            ->delete("/clients/{$klien->id}")
            ->assertSessionHasErrors('delete');

        $this->assertDatabaseHas('clients', ['id' => $klien->id]);
    }

    /** TEMUAN C-02 — pembayaran tidak boleh lenyap bersama invoice. */
    public function test_invoice_dengan_pembayaran_tidak_dapat_dihapus(): void
    {
        $klien = $this->client();
        $rekening = BankAccount::create([
            'account_name' => 'Kas Uji',
            'bank_name' => 'BCA',
            'account_number' => '123',
            'initial_balance' => 0,
        ]);

        $invoice = Invoice::create([
            'billed_to_id' => $klien->id,
            'invoice_number' => '002/INV/TST/VIII/2026',
            'issue_date' => now(),
            'due_date' => now()->addDays(7),
            'subtotal' => 1_000_000,
            'total_amount' => 1_000_000,
            'status' => 'partially_paid',
        ]);

        InvoiceItem::create([
            'invoice_id' => $invoice->id,
            'client_id' => $klien->id,
            'service_name' => 'Jasa',
            'description' => 'Jasa',
            'quantity' => 1,
            'unit_price' => 1_000_000,
            'amount' => 1_000_000,
        ]);

        Payment::create([
            'invoice_id' => $invoice->id,
            'bank_account_id' => $rekening->id,
            'amount' => 400_000,
            'payment_date' => now(),
        ]);

        // InvoiceController::destroy memakai actionResult(): flash 'error' untuk
        // kunjungan biasa, 422 JSON untuk drawer. Bukti sesungguhnya bahwa penolakan
        // bekerja adalah barisnya masih ada di database, bukan bentuk responsnya.
        $this->actingAs($this->admin)
            ->delete("/invoices/{$invoice->id}")
            ->assertSessionHas('error');

        $this->assertDatabaseHas('invoices', ['id' => $invoice->id]);
        $this->assertDatabaseCount('payments', 1);
    }

    /** TEMUAN C-04 — klien nonaktif hanya disaring di frontend. */
    public function test_invoice_tidak_dapat_dibuat_untuk_klien_nonaktif(): void
    {
        $nonaktif = $this->client(['status' => Client::STATUS_INACTIVE]);

        $this->actingAs($this->admin)
            ->post('/invoices', [
                'client_id' => $nonaktif->id,
                'invoice_date' => now()->toDateString(),
                'due_date' => now()->addDays(7)->toDateString(),
                'items' => [[
                    'description' => 'Jasa',
                    'quantity' => 1,
                    'unit_price' => 1_000_000,
                ]],
            ])
            ->assertSessionHasErrors('client_id');

        $this->assertDatabaseCount('invoices', 0);
    }
}
