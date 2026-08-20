<?php

namespace Tests\Feature;

use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Loan;
use App\Models\TransactionCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

/**
 * Regresi BUG-L2 & BUG-L3.
 */
class LoanIntegrityTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private BankAccount $rekening;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['view loans', 'create loans', 'edit loans', 'delete loans', 'pay loans'] as $name) {
            Permission::findOrCreate($name, 'web');
        }

        setPermissionsTeamId(self::TEST_COMPANY);
        $this->admin = User::factory()->create();
        $this->admin->companies()->syncWithoutDetaching([self::TEST_COMPANY]);
        $this->admin->givePermissionTo(Permission::all());

        $this->rekening = BankAccount::create([
            'account_name' => 'Kas Uji',
            'bank_name' => 'BCA',
            'account_number' => '123',
            'initial_balance' => 0,
        ]);
    }

    private function pinjaman(string $nomor, int $pokok = 10_000_000): Loan
    {
        return Loan::create([
            'loan_number' => $nomor,
            'lender_name' => 'Bank Uji',
            'principal_amount' => $pokok,
            'interest_type' => 'fixed',
            'interest_amount' => 500_000,
            'term_months' => 12,
            'start_date' => now(),
            'maturity_date' => now()->addYear(),
            'bank_account_id' => $this->rekening->id,
            'status' => 'active',
            'remaining_principal' => $pokok,
        ]);
    }

    private function pencairan(Loan $loan): BankTransaction
    {
        return BankTransaction::create([
            'bank_account_id' => $this->rekening->id,
            'category_id' => TransactionCategory::create(['label' => 'Pencairan', 'type' => 'income'])->id,
            'transaction_type' => 'credit',
            'transaction_date' => now(),
            'amount' => $loan->principal_amount,
            'description' => 'Pencairan pinjaman',
            'reference_number' => $loan->loan_number,
        ]);
    }

    /** BUG-L2 — nomor berikutnya tidak boleh bentrok dengan nomor yang ada. */
    public function test_nomor_pinjaman_berikutnya_tidak_bentrok(): void
    {
        // id 1 dihapus nanti, tetapi nomornya sengaja jauh di depan urutan id.
        $this->pinjaman('LOAN-00007');

        $response = $this->actingAs($this->admin)->get('/loans');
        $response->assertOk();

        $berikutnya = $response->viewData('page')['props']['nextLoanNumber'];

        $this->assertSame('LOAN-00008', $berikutnya,
            'Nomor berikutnya harus mengikuti nomor terbesar, bukan id terakhir.');
        $this->assertFalse(Loan::where('loan_number', $berikutnya)->exists());
    }

    /** BUG-L3 — menghapus pinjaman harus ikut membalik mutasi pencairannya. */
    public function test_hapus_pinjaman_ikut_menghapus_mutasi_pencairan(): void
    {
        $loan = $this->pinjaman('LOAN-00001');
        $this->pencairan($loan);

        $this->assertSame(10_000_000, (int) $this->rekening->fresh()->balance);

        $this->actingAs($this->admin)->delete("/loans/{$loan->id}");

        $this->assertDatabaseMissing('loans', ['id' => $loan->id]);
        $this->assertSame(0, (int) $this->rekening->fresh()->balance,
            'Saldo harus kembali seperti sebelum pencairan, bukan menyisakan dana masuk yatim.');
    }

    /** BUG-L3 — pokok & tanggal mulai terkunci setelah pencairan tercatat. */
    public function test_pokok_tidak_dapat_diubah_setelah_pencairan(): void
    {
        $loan = $this->pinjaman('LOAN-00002');
        $this->pencairan($loan);

        $this->actingAs($this->admin)->put("/loans/{$loan->id}", [
            'lender_name' => 'Bank Uji (diubah)',
            'principal_amount' => 999_000_000,
            'interest_type' => 'fixed',
            'interest_amount' => 500_000,
            'term_months' => 12,
            'start_date' => now()->addMonth()->toDateString(),
            'maturity_date' => now()->addYear()->toDateString(),
        ]);

        $segar = $loan->fresh();

        $this->assertSame(10_000_000, (int) $segar->principal_amount,
            'Nominal pokok tidak boleh berubah setelah pencairannya tercatat di bank.');
        $this->assertSame('Bank Uji (diubah)', $segar->lender_name,
            'Kolom yang tidak tercermin di mutasi bank tetap boleh disunting.');
    }
}
