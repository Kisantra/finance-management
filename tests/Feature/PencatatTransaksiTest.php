<?php

namespace Tests\Feature;

use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\TransactionCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * "Siapa yang input" (MencatatPengguna): pencatat dan yang terakhir mengubah uang masuk/keluar.
 * Isinya id pengguna di database pusat; data tanpa pengguna login tetap kosong.
 */
class PencatatTransaksiTest extends TestCase
{
    use RefreshDatabase;

    private User $pencatat;

    private User $pengubah;

    private BankAccount $rekening;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
        $izin = [
            'view bank-accounts', 'view income', 'create income', 'edit income',
            'view transfer', 'create transfer', 'edit transfer',
            'view invoices', 'create invoices', 'edit invoices',
        ];
        foreach ($izin as $nama) {
            Permission::firstOrCreate(['name' => $nama]);
        }
        Role::firstOrCreate(['name' => 'admin'])->syncPermissions($izin);

        $this->pencatat = User::factory()->create();
        $this->pencatat->assignRole('admin');
        $this->pengubah = User::factory()->create();
        $this->pengubah->assignRole('admin');

        $this->rekening = BankAccount::factory()->create(['initial_balance' => 0]);
    }

    public function test_transaksi_kas_merekam_pencatat_lalu_yang_terakhir_mengubah(): void
    {
        $kategori = TransactionCategory::create(['type' => 'income', 'label' => 'Pendapatan Lain']);

        $this->actingAs($this->pencatat)->post('/bank-transactions', [
            'bank_account_id' => $this->rekening->id,
            'category_id' => $kategori->id,
            'amount' => 250_000,
            'transaction_date' => '2026-11-05',
            'transaction_type' => 'credit',
            'description' => 'Bunga giro',
        ])->assertSessionHasNoErrors();

        $transaksi = BankTransaction::query()->where('description', 'Bunga giro')->firstOrFail();
        $this->assertSame($this->pencatat->id, $transaksi->created_by);
        $this->assertNull($transaksi->updated_by, 'Belum pernah diubah: updated_by harus kosong.');

        $this->actingAs($this->pengubah)->post("/bank-transactions/{$transaksi->id}", [
            '_method' => 'put',
            'amount' => 300_000,
            'transaction_date' => '2026-11-05',
            'description' => 'Bunga giro November',
            'category_id' => $kategori->id,
        ])->assertSessionHasNoErrors();

        $transaksi->refresh();
        $this->assertSame($this->pencatat->id, $transaksi->created_by, 'Mengubah tidak boleh menimpa pencatat.');
        $this->assertSame($this->pengubah->id, $transaksi->updated_by);
    }

    /** Kaki lawan transfer diubah lewat update massal yang tidak memicu event model. */
    public function test_mengubah_satu_kaki_transfer_merekam_pengubah_di_kedua_kaki(): void
    {
        $tujuan = BankAccount::factory()->create(['initial_balance' => 0]);
        $kategori = TransactionCategory::create(['type' => 'transfer', 'label' => 'Transfer Internal']);

        $this->actingAs($this->pencatat)->post('/bank-transactions/transfer', [
            'from_account_id' => $this->rekening->id,
            'to_account_id' => $tujuan->id,
            'category_id' => $kategori->id,
            'amount' => 1_000_000,
            'admin_fee' => 0,
            'description' => 'Pindah ke kas kecil',
            'transfer_date' => '2026-11-05',
        ])->assertSessionHasNoErrors();

        $kaki = BankTransaction::query()->where('category_id', $kategori->id)->get();
        $this->assertCount(2, $kaki);
        $this->assertSame([$this->pencatat->id, $this->pencatat->id], $kaki->pluck('created_by')->all());

        $this->actingAs($this->pengubah)->post("/bank-transactions/{$kaki->firstWhere('transaction_type', 'debit')->id}", [
            '_method' => 'put',
            'transaction_date' => '2026-11-06',
            'description' => 'Pindah ke kas kecil (koreksi tanggal)',
        ])->assertSessionHasNoErrors();

        $this->assertSame(
            [$this->pengubah->id, $this->pengubah->id],
            BankTransaction::query()->where('category_id', $kategori->id)->pluck('updated_by')->all(),
        );
    }

    public function test_pembayaran_invoice_merekam_pencatat_lalu_yang_terakhir_mengubah(): void
    {
        $invoice = Invoice::factory()->sent()->create([
            'billed_to_id' => Client::factory()->create()->id,
            'subtotal' => 1_000_000,
            'total_amount' => 1_000_000,
        ]);

        $this->actingAs($this->pencatat)->postJson("/invoices/{$invoice->id}/payments", [
            'amount' => 400_000,
            'payment_date' => '2026-11-05',
            'payment_method' => 'bank_transfer',
            'bank_account_id' => $this->rekening->id,
        ])->assertOk();

        $pembayaran = Payment::query()->where('invoice_id', $invoice->id)->firstOrFail();
        $this->assertSame($this->pencatat->id, $pembayaran->created_by);
        $this->assertNull($pembayaran->updated_by);

        $this->actingAs($this->pengubah)->postJson("/payments/{$pembayaran->id}", [
            'amount' => 500_000,
            'payment_date' => '2026-11-05',
            'payment_method' => 'bank_transfer',
            'bank_account_id' => $this->rekening->id,
        ])->assertOk();

        $pembayaran->refresh();
        $this->assertSame($this->pencatat->id, $pembayaran->created_by);
        $this->assertSame($this->pengubah->id, $pembayaran->updated_by);
    }

    public function test_tanpa_pengguna_login_kolom_pencatat_tetap_kosong(): void
    {
        $transaksi = BankTransaction::factory()->create(['bank_account_id' => $this->rekening->id]);
        $transaksi->update(['description' => 'Diubah oleh proses tanpa login']);

        $this->assertNull($transaksi->fresh()->created_by);
        $this->assertNull($transaksi->fresh()->updated_by);
    }
}
