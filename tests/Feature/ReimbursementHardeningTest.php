<?php

namespace Tests\Feature;

use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Reimbursement;
use App\Models\ReimbursementPayment;
use App\Models\TransactionCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Regresi BUG-R2, BUG-R3, BUG-R7.
 */
class ReimbursementHardeningTest extends TestCase
{
    use RefreshDatabase;

    private User $pemohon;

    private TransactionCategory $kategori;

    private BankAccount $rekening;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'view reimbursements', 'create reimbursements', 'edit reimbursements',
            'delete reimbursements', 'approve reimbursements', 'pay reimbursements',
        ] as $name) {
            Permission::findOrCreate($name, 'web');
        }
        Role::findOrCreate('admin', 'web');

        setPermissionsTeamId(self::TEST_COMPANY);

        $this->pemohon = User::factory()->create();
        $this->pemohon->companies()->syncWithoutDetaching([self::TEST_COMPANY]);
        $this->pemohon->givePermissionTo(Permission::all());

        $this->kategori = TransactionCategory::create(['label' => 'Operasional', 'type' => 'expense']);

        $this->rekening = BankAccount::create([
            'account_name' => 'Kas Uji',
            'bank_name' => 'BCA',
            'account_number' => '123',
            'initial_balance' => 10_000_000,
        ]);
    }

    private function bayar(Reimbursement $r, int $amount): ReimbursementPayment
    {
        $trx = BankTransaction::create([
            'bank_account_id' => $this->rekening->id,
            'category_id' => $this->kategori->id,
            'transaction_type' => 'debit',
            'transaction_date' => now(),
            'amount' => $amount,
            'description' => 'Pembayaran reimbursement',
        ]);

        return ReimbursementPayment::create([
            'reimbursement_id' => $r->id,
            'bank_transaction_id' => $trx->id,
            'amount' => $amount,
            'payment_date' => now(),
            'paid_by' => $this->pemohon->id,
        ]);
    }

    private function reimbursement(string $status = 'draft', int $amount = 500_000): Reimbursement
    {
        return Reimbursement::create([
            'user_id' => $this->pemohon->id,
            'category_id' => $this->kategori->id,
            'title' => 'Reimbursement Uji',
            'category_input' => 'Operasional',
            'amount' => $amount,
            'expense_date' => now()->subDay(),
            'status' => $status,
            'payment_status' => 'unpaid',
            'amount_paid' => 0,
        ]);
    }

    /** BUG-R3 — menghapus pembayaran harus menurunkan amount_paid kembali. */
    public function test_amount_paid_direkonsiliasi_saat_pembayaran_dihapus(): void
    {
        $r = $this->reimbursement('approved');

        $bayar = $this->bayar($r, 500_000);

        $this->assertSame(500_000, $r->fresh()->amount_paid);
        $this->assertSame('paid', $r->fresh()->payment_status);

        $bayar->delete();

        $this->assertSame(0, $r->fresh()->amount_paid,
            'amount_paid harus turun kembali saat pembayarannya dihapus.');
        $this->assertSame('unpaid', $r->fresh()->payment_status);
    }

    /** Pembayaran sebagian menghasilkan status partial. */
    public function test_pembayaran_sebagian_menghasilkan_status_partial(): void
    {
        $r = $this->reimbursement('approved');

        $this->bayar($r, 200_000);

        $this->assertSame(200_000, $r->fresh()->amount_paid);
        $this->assertSame('partial', $r->fresh()->payment_status);
    }

    /** BUG-R7 — reimbursement yang sudah dibayar tidak boleh dihapus. */
    public function test_reimbursement_dengan_pembayaran_tidak_dapat_dihapus(): void
    {
        $r = $this->reimbursement('approved');
        $this->pemohon->assignRole('admin');

        $this->bayar($r, 300_000);

        $this->actingAs($this->pemohon)
            ->delete("/reimbursements/{$r->id}")
            ->assertSessionHasErrors('delete');

        $this->assertDatabaseHas('reimbursements', ['id' => $r->id]);
    }

    /** BUG-R2 — pengajuan ulang setelah ditolak harus benar-benar terkirim. */
    public function test_pengajuan_ulang_setelah_ditolak_benar_benar_terkirim(): void
    {
        $r = $this->reimbursement('rejected');

        $this->actingAs($this->pemohon)
            ->put("/reimbursements/{$r->id}", [
                'title' => 'Reimbursement Uji (revisi)',
                'category' => 'transport',
                'amount' => 500_000,
                'expense_date' => now()->subDay()->toDateString(),
                'action' => 'submit',
            ]);

        $this->assertSame('pending', $r->fresh()->status,
            'Status harus berpindah ke pending, bukan diam di rejected sementara pengguna melihat flash sukses.');
    }
}
