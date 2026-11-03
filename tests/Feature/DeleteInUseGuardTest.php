<?php

namespace Tests\Feature;

use App\Models\BankAccount;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Keputusan produk 2026-08-19: penghapusan klien dan rekening bank DITOLAK
 * selama masih terpakai, dan pesannya menyebutkan data apa yang menahannya.
 *
 * Sebelumnya keduanya destruktif diam-diam: menghapus klien ikut menghapus
 * seluruh invoice + item (termasuk item milik klien itu yang menempel di
 * invoice pihak lain) dan pembayarannya lewat FK cascade; menghapus rekening
 * menghapus pembayaran tanpa menghitung ulang status invoice.
 */
class DeleteInUseGuardTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
        $izin = ['view clients', 'delete clients', 'view bank-accounts', 'delete bank-accounts'];
        foreach ($izin as $p) {
            Permission::firstOrCreate(['name' => $p]);
        }
        Role::firstOrCreate(['name' => 'admin'])->syncPermissions($izin);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
    }

    private function klien(string $nama = 'PT Uji'): Client
    {
        return Client::create(['name' => $nama, 'type' => 'company', 'status' => 'Active']);
    }

    public function test_klien_dengan_invoice_tidak_dapat_dihapus(): void
    {
        $client = $this->klien();
        Invoice::create([
            'invoice_number' => '001/INV/UJI/VIII/2026',
            'billed_to_id' => $client->id,
            'subtotal' => 1000000,
            'total_amount' => 1000000,
            'issue_date' => '2026-08-01',
            'due_date' => '2026-08-31',
            'status' => 'sent',
        ]);

        $this->actingAs($this->admin)
            ->delete("/clients/{$client->id}")
            ->assertSessionHasErrors('delete');

        $this->assertDatabaseHas('clients', ['id' => $client->id]);
        $this->assertDatabaseCount('invoices', 1);
    }

    public function test_pesan_penolakan_menyebut_nomor_invoice(): void
    {
        $client = $this->klien();
        Invoice::create([
            'invoice_number' => '007/INV/UJI/VIII/2026',
            'billed_to_id' => $client->id,
            'subtotal' => 500000,
            'total_amount' => 500000,
            'issue_date' => '2026-08-01',
            'due_date' => '2026-08-31',
            'status' => 'sent',
        ]);

        $response = $this->actingAs($this->admin)->delete("/clients/{$client->id}");

        $pesan = session('errors')->first('delete');
        $this->assertStringContainsString('007/INV/UJI/VIII/2026', $pesan);
    }

    public function test_klien_tanpa_relasi_tetap_dapat_dihapus(): void
    {
        $client = $this->klien('PT Tanpa Invoice');

        $this->actingAs($this->admin)
            ->delete("/clients/{$client->id}")
            ->assertSessionHasNoErrors();

        $this->assertDatabaseMissing('clients', ['id' => $client->id]);
    }

    public function test_rekening_dengan_pembayaran_tidak_dapat_dihapus(): void
    {
        $client = $this->klien();
        $rekening = BankAccount::factory()->create();
        $invoice = Invoice::create([
            'invoice_number' => '002/INV/UJI/VIII/2026',
            'billed_to_id' => $client->id,
            'subtotal' => 1000000,
            'total_amount' => 1000000,
            'issue_date' => '2026-08-01',
            'due_date' => '2026-08-31',
            'status' => 'partially_paid',
        ]);
        Payment::create([
            'invoice_id' => $invoice->id,
            'bank_account_id' => $rekening->id,
            'amount' => 400000,
            'payment_date' => '2026-08-05',
            'payment_method' => 'bank_transfer',
        ]);

        $this->actingAs($this->admin)
            ->delete("/bank-accounts/{$rekening->id}")
            ->assertSessionHasErrors('delete');

        $this->assertDatabaseHas('bank_accounts', ['id' => $rekening->id]);
        $this->assertDatabaseCount('payments', 1);
    }

    public function test_rekening_kosong_tetap_dapat_dihapus(): void
    {
        $rekening = BankAccount::factory()->create();

        $this->actingAs($this->admin)
            ->delete("/bank-accounts/{$rekening->id}")
            ->assertSessionHasNoErrors();

        $this->assertDatabaseMissing('bank_accounts', ['id' => $rekening->id]);
    }
}
