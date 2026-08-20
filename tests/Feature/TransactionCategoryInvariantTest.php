<?php

namespace Tests\Feature;

use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\TransactionCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

/**
 * Regresi BUG-TC-01, BUG-TC-03, BUG-TC-04, BUG-TC-05.
 */
class TransactionCategoryInvariantTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private BankAccount $rekening;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'view categories', 'manage categories',
            'view expense', 'view income', 'create income', 'create expense',
        ] as $name) {
            Permission::findOrCreate($name, 'web');
        }

        $this->admin = User::factory()->create();
        $this->admin->companies()->syncWithoutDetaching([self::TEST_COMPANY]);
        setPermissionsTeamId(self::TEST_COMPANY);
        $this->admin->givePermissionTo(Permission::all());

        $this->rekening = BankAccount::create([
            'account_name' => 'Kas Uji',
            'bank_name' => 'BCA',
            'account_number' => '123',
            'initial_balance' => 0,
        ]);
    }

    private function induk(string $type = 'expense'): TransactionCategory
    {
        return TransactionCategory::create(['label' => 'Induk '.$type, 'type' => $type]);
    }

    private function anak(TransactionCategory $induk, ?string $type = null, string $label = 'Anak'): TransactionCategory
    {
        return TransactionCategory::create([
            'label' => $label,
            'type' => $type ?? $induk->type,
            'parent_id' => $induk->id,
        ]);
    }

    /** BUG-TC-01 — kategori yang PUNYA ANAK tidak boleh dipakai transaksi. */
    public function test_kategori_induk_ditolak_untuk_transaksi(): void
    {
        $induk = $this->induk();
        $this->anak($induk);

        $this->actingAs($this->admin)
            ->post('/bank-transactions', [
                'bank_account_id' => $this->rekening->id,
                'category_id' => $induk->id,
                'transaction_type' => 'debit',
                'transaction_date' => now()->toDateString(),
                'amount' => 100_000,
                'description' => 'Pakai kategori induk',
            ])
            ->assertSessionHasErrors('category_id');

        $this->assertDatabaseCount('bank_transactions', 0);
    }

    /** Kategori datar tanpa anak tetap sah dipakai langsung — mis. kategori sistem Pinjaman. */
    public function test_kategori_datar_tanpa_anak_tetap_diterima(): void
    {
        $datar = TransactionCategory::create(['label' => 'Beban Bunga Pinjaman', 'type' => 'expense']);

        $this->actingAs($this->admin)
            ->post('/bank-transactions', [
                'bank_account_id' => $this->rekening->id,
                'category_id' => $datar->id,
                'transaction_type' => 'debit',
                'transaction_date' => now()->toDateString(),
                'amount' => 100_000,
                'description' => 'Kategori datar',
            ])
            ->assertSessionHasNoErrors();

        $this->assertDatabaseCount('bank_transactions', 1);
    }

    /** BUG-TC-04 — anak bertipe lain tidak boleh muncul di daftar pilihan. */
    public function test_select_options_menyaring_tipe_anak_bukan_hanya_induk(): void
    {
        $induk = $this->induk('expense');
        $this->anak($induk, 'expense', 'Anak Pengeluaran');
        $this->anak($induk, 'income', 'Anak Pemasukan');

        $label = collect(TransactionCategory::selectOptions('expense'))->pluck('label');

        $this->assertContains('↳ Anak Pengeluaran', $label);
        $this->assertNotContains('↳ Anak Pemasukan', $label,
            'Anak bertipe income tidak boleh muncul pada daftar pengeluaran hanya karena induknya expense.');
    }

    /** Induk tanpa anak yang cocok tidak perlu ditampilkan sebagai judul kosong. */
    public function test_induk_tanpa_anak_cocok_tidak_ditampilkan(): void
    {
        $induk = $this->induk('expense');
        $this->anak($induk, 'income', 'Hanya Pemasukan');

        $this->assertSame([], TransactionCategory::selectOptions('expense'));
    }

    /** BUG-TC-03 — pengganti pada dialog hapus tidak boleh kategori berbanak. */
    public function test_reassign_menolak_kategori_induk_sebagai_pengganti(): void
    {
        $induk = $this->induk();
        $anak = $this->anak($induk);

        BankTransaction::create([
            'bank_account_id' => $this->rekening->id,
            'category_id' => $anak->id,
            'transaction_type' => 'debit',
            'transaction_date' => now(),
            'amount' => 50_000,
            'description' => 'Pemakai kategori',
        ]);

        $this->actingAs($this->admin)
            ->delete("/transaction-categories/{$anak->id}", ['reassign_to_id' => $induk->id])
            ->assertSessionHasErrors('reassign_to_id');

        $this->assertDatabaseHas('transaction_categories', ['id' => $anak->id]);
    }

    /** BUG-TC-05 — grup L/R hanya untuk kategori pemasukan/pengeluaran. */
    public function test_pl_group_ditolak_untuk_kategori_transfer(): void
    {
        $kategori = TransactionCategory::create(['label' => 'Transfer Internal', 'type' => 'transfer']);

        $this->actingAs($this->admin)
            ->patch("/transaction-categories/{$kategori->id}/pl-group", ['pl_group' => 'revenue'])
            ->assertSessionHasErrors('pl_group');

        $this->assertNull($kategori->fresh()->pl_group);
    }

    /** Kategori pengeluaran tetap bisa diklasifikasi. */
    public function test_pl_group_diterima_untuk_kategori_pengeluaran(): void
    {
        $kategori = $this->induk('expense');

        $this->actingAs($this->admin)
            ->patch("/transaction-categories/{$kategori->id}/pl-group", ['pl_group' => 'opex'])
            ->assertSessionHasNoErrors();

        $this->assertSame('opex', $kategori->fresh()->pl_group);
    }
}
