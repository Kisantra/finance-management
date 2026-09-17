<?php

namespace Tests\Feature;

use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\TransactionCategory;
use App\Models\User;
use Database\Seeders\TransactionCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Laporan error produksi 2026-09-17 (ERR-YWPSETE9FI): menyimpan pinjaman gagal 500
 * dengan "Unknown column 'code'". Kolom `code` di-drop migration 2026_02_05, tetapi
 * Loans/Receivables masih mencari kategori sistem lewat kolom itu di enam tempat.
 * Penggantinya kolom `system_key` + TransactionCategory::findSystem().
 */
class SystemTransactionCategoryTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @var list<string>
     */
    private const SYSTEM_KEYS = [
        'FIN-LOAN-IN', 'FIN-LOAN-OUT', 'FIN-RCV-OUT', 'FIN-RCV-IN', 'EXP-INTEREST', 'REV-INTEREST',
    ];

    private User $admin;

    private BankAccount $bankAccount;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $permissions = ['view loans', 'create loans', 'edit loans', 'delete loans', 'pay loans'];
        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
        }

        Role::firstOrCreate(['name' => 'admin'])->syncPermissions($permissions);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');

        $this->bankAccount = BankAccount::factory()->create(['initial_balance' => 0]);
    }

    /**
     * @return array<string, mixed>
     */
    private function loanPayload(array $overrides = []): array
    {
        return array_merge([
            'loan_number' => 'LN-2026-001',
            'lender_name' => 'Bank Mandiri',
            'principal_amount' => 10_000_000,
            'interest_type' => 'fixed',
            'interest_amount' => 500_000,
            'term_months' => 12,
            'start_date' => '2026-01-01',
            'maturity_date' => '2027-01-01',
            'bank_account_id' => $this->bankAccount->id,
        ], $overrides);
    }

    public function test_kolom_code_memang_sudah_tidak_ada(): void
    {
        // Inti bug produksi: enam lookup masih memakai kolom ini, padahal migration
        // 2026_02_05 menghapusnya — query-nya mustahil berhasil di database mana pun.
        $this->assertFalse(Schema::hasColumn('transaction_categories', 'code'));
        $this->assertTrue(Schema::hasColumn('transaction_categories', 'system_key'));
    }

    public function test_seeder_menandai_enam_kategori_sistem(): void
    {
        $this->seed(TransactionCategorySeeder::class);

        foreach (self::SYSTEM_KEYS as $key) {
            $this->assertNotNull(TransactionCategory::findSystem($key), "Kategori sistem {$key} tidak tertandai.");
        }
    }

    public function test_menyimpan_pinjaman_tidak_lagi_gagal_dan_transaksi_masuk_kategori_sistem(): void
    {
        $this->seed(TransactionCategorySeeder::class);

        $this->actingAs($this->admin)
            ->post('/loans', $this->loanPayload())
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $transaction = BankTransaction::sole();

        $this->assertSame(
            TransactionCategory::findSystem('FIN-LOAN-IN')->id,
            $transaction->category_id,
            'Penerimaan pinjaman harus masuk kategori sistem FIN-LOAN-IN agar terbaca di Arus Kas.'
        );
        $this->assertSame('credit', $transaction->transaction_type);
        $this->assertSame(10_000_000, (int) $transaction->amount);
    }

    public function test_tanpa_kategori_sistem_pinjaman_tetap_tersimpan_tanpa_error(): void
    {
        // Database lama yang kategorinya sudah diubah nama: backfill tidak menemukan
        // pasangannya. Itu bukan alasan untuk menjatuhkan penyimpanan pinjaman.
        $this->assertNull(TransactionCategory::findSystem('FIN-LOAN-IN'));

        $this->actingAs($this->admin)
            ->post('/loans', $this->loanPayload())
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $this->assertNull(BankTransaction::sole()->category_id);
    }

    public function test_system_key_tidak_bisa_diubah_lewat_mass_assignment(): void
    {
        $category = TransactionCategory::create([
            'type' => 'expense',
            'label' => 'Kategori Buatan Pengguna',
            'system_key' => 'EXP-INTEREST',
        ]);

        $this->assertNull($category->fresh()->system_key,
            'system_key menandai kategori bawaan sistem — jangan sampai bisa diklaim lewat form.');
    }
}
