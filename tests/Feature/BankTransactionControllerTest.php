<?php

namespace Tests\Feature;

use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\TransactionCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class BankTransactionControllerTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected BankAccount $account;

    protected TransactionCategory $category;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $permissions = [
            'view bank-accounts',
            'view income', 'create income', 'edit income', 'delete income',
            'view expense', 'create expense', 'edit expense', 'delete expense',
            'view transfer', 'create transfer', 'edit transfer', 'delete transfer',
        ];
        foreach ($permissions as $perm) {
            Permission::firstOrCreate(['name' => $perm]);
        }

        $adminRole = Role::firstOrCreate(['name' => 'admin']);
        $adminRole->syncPermissions($permissions);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');

        $this->account = BankAccount::factory()->create(['initial_balance' => 0]);
        $this->category = TransactionCategory::create(['type' => 'income', 'label' => 'Pendapatan']);
    }

    public function test_store_credit_transaction_increases_balance(): void
    {
        $initial = $this->account->balance;

        $this->actingAs($this->admin)->post('/bank-transactions', [
            'bank_account_id' => $this->account->id,
            'category_id' => $this->category->id,
            'amount' => 1000000,
            'transaction_date' => '2026-03-10',
            'transaction_type' => 'credit',
            'description' => 'Penerimaan pembayaran klien',
        ]);

        $this->assertDatabaseHas('bank_transactions', [
            'bank_account_id' => $this->account->id,
            'amount' => 1000000,
            'transaction_type' => 'credit',
        ]);

        $this->assertSame($initial + 1000000, $this->account->fresh()->balance);
    }

    public function test_store_debit_transaction_decreases_balance(): void
    {
        $creditCat = TransactionCategory::create(['type' => 'expense', 'label' => 'Pengeluaran']);
        $this->account->transactions()->create([
            'category_id' => $creditCat->id,
            'amount' => 2000000,
            'transaction_date' => '2026-03-01',
            'transaction_type' => 'credit',
            'description' => 'Saldo awal',
        ]);

        $balanceBefore = $this->account->fresh()->balance;

        $this->actingAs($this->admin)->post('/bank-transactions', [
            'bank_account_id' => $this->account->id,
            'category_id' => $creditCat->id,
            'amount' => 500000,
            'transaction_date' => '2026-03-10',
            'transaction_type' => 'debit',
            'description' => 'Biaya operasional',
        ]);

        $this->assertSame($balanceBefore - 500000, $this->account->fresh()->balance);
    }

    public function test_store_is_forbidden_without_feature_permission(): void
    {
        $noPermUser = User::factory()->create();

        $this->actingAs($noPermUser)->post('/bank-transactions', [
            'bank_account_id' => $this->account->id,
            'category_id' => $this->category->id,
            'amount' => 100000,
            'transaction_date' => '2026-03-10',
            'transaction_type' => 'credit',
            'description' => 'Unauthorized',
        ])->assertForbidden();

        $this->assertDatabaseMissing('bank_transactions', ['description' => 'Unauthorized']);
    }

    public function test_store_validates_required_fields(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/bank-transactions', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['bank_account_id', 'category_id', 'amount', 'transaction_date', 'transaction_type', 'description']);
    }

    public function test_destroy_deletes_transaction(): void
    {
        $tx = BankTransaction::factory()->create([
            'bank_account_id' => $this->account->id,
            'transaction_type' => 'credit',
        ]);

        $this->actingAs($this->admin)->delete("/bank-transactions/{$tx->id}");

        $this->assertDatabaseMissing('bank_transactions', ['id' => $tx->id]);
    }

    public function test_transfer_creates_debit_and_credit_pair(): void
    {
        $fromAccount = BankAccount::factory()->create(['initial_balance' => 0]);
        $toAccount = BankAccount::factory()->create(['initial_balance' => 0]);
        $transferCat = TransactionCategory::create(['type' => 'transfer', 'label' => 'Transfer Internal']);

        $fromAccount->transactions()->create([
            'category_id' => $transferCat->id,
            'amount' => 5000000,
            'transaction_date' => '2026-03-01',
            'transaction_type' => 'credit',
            'description' => 'Saldo awal from',
        ]);

        $fromBefore = $fromAccount->fresh()->balance;
        $toBefore = $toAccount->fresh()->balance;

        $this->actingAs($this->admin)->post('/bank-transactions/transfer', [
            'from_account_id' => $fromAccount->id,
            'to_account_id' => $toAccount->id,
            'category_id' => $transferCat->id,
            'amount' => 1000000,
            'admin_fee' => 10000,
            'description' => 'Transfer ke kas',
            'transfer_date' => '2026-03-10',
        ]);

        $this->assertSame($fromBefore - 1010000, $fromAccount->fresh()->balance);
        $this->assertSame($toBefore + 1000000, $toAccount->fresh()->balance);

        $this->assertDatabaseHas('bank_transactions', [
            'bank_account_id' => $fromAccount->id,
            'amount' => 1010000,
            'transaction_type' => 'debit',
        ]);

        $this->assertDatabaseHas('bank_transactions', [
            'bank_account_id' => $toAccount->id,
            'amount' => 1000000,
            'transaction_type' => 'credit',
        ]);
    }

    public function test_transfer_requires_different_accounts(): void
    {
        $cat = TransactionCategory::create(['type' => 'transfer', 'label' => 'TRF']);

        $this->actingAs($this->admin)
            ->postJson('/bank-transactions/transfer', [
                'from_account_id' => $this->account->id,
                'to_account_id' => $this->account->id,
                'category_id' => $cat->id,
                'amount' => 100000,
                'admin_fee' => 0,
                'description' => 'Same account transfer',
                'transfer_date' => '2026-03-10',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('from_account_id');
    }

    /**
     * Dua transfer yang dibuat dalam detik yang sama dulu berbagi `reference_number`
     * ('TRF'.time() beresolusi detik), sehingga menghapus salah satunya ikut menghapus
     * kedua kaki transfer yang lain dan menggeser saldo tanpa jejak.
     */
    public function test_menghapus_transfer_tidak_menyentuh_transfer_lain_di_detik_yang_sama(): void
    {
        [$a, $b, $c, $d] = BankAccount::factory()->count(4)->create(['initial_balance' => 10000000]);
        $cat = TransactionCategory::create(['type' => 'transfer', 'label' => 'Transfer Internal']);

        $kirim = fn (BankAccount $dari, BankAccount $ke, int $nominal) => $this->actingAs($this->admin)
            ->post('/bank-transactions/transfer', [
                'from_account_id' => $dari->id,
                'to_account_id' => $ke->id,
                'category_id' => $cat->id,
                'amount' => $nominal,
                'admin_fee' => 0,
                'description' => 'Transfer '.$nominal,
                'transfer_date' => '2026-03-10',
            ]);

        $kirim($a, $b, 1000000);
        $kirim($c, $d, 7000000);

        $pertama = BankTransaction::where('bank_account_id', $a->id)->sole();
        $kedua = BankTransaction::where('bank_account_id', $c->id)->sole();

        // Paksa tabrakan nomor referensi, persis seperti yang dihasilkan 'TRF'.time()
        // ketika dua transfer dibuat dalam detik yang sama.
        BankTransaction::query()->update(['reference_number' => 'TRF1772000000']);

        $this->assertNotSame($pertama->transfer_group_id, $kedua->transfer_group_id);

        $saldoC = $c->fresh()->balance;
        $saldoD = $d->fresh()->balance;

        $this->actingAs($this->admin)->delete('/bank-transactions/'.$pertama->id);

        $this->assertDatabaseMissing('bank_transactions', ['transfer_group_id' => $pertama->transfer_group_id]);
        $this->assertSame(2, BankTransaction::where('transfer_group_id', $kedua->transfer_group_id)->count());
        $this->assertSame($saldoC, $c->fresh()->balance);
        $this->assertSame($saldoD, $d->fresh()->balance);
    }

    public function test_transfer_memberi_transfer_group_id_unik_pada_kedua_kaki(): void
    {
        [$dari, $ke] = BankAccount::factory()->count(2)->create(['initial_balance' => 5000000]);
        $cat = TransactionCategory::create(['type' => 'transfer', 'label' => 'Transfer Internal']);

        $this->actingAs($this->admin)->post('/bank-transactions/transfer', [
            'from_account_id' => $dari->id,
            'to_account_id' => $ke->id,
            'category_id' => $cat->id,
            'amount' => 1000000,
            'admin_fee' => 10000,
            'description' => 'Transfer ke kas',
            'transfer_date' => '2026-03-10',
        ]);

        $kaki = BankTransaction::all();

        $this->assertCount(2, $kaki);
        $this->assertNotNull($kaki[0]->transfer_group_id);
        $this->assertSame($kaki[0]->transfer_group_id, $kaki[1]->transfer_group_id);
        $this->assertSame(26, strlen($kaki[0]->transfer_group_id));
    }

    public function test_update_via_method_spoofing_saves_category_and_attachment(): void
    {
        Storage::fake('public');

        $tx = BankTransaction::factory()->create([
            'bank_account_id' => $this->account->id,
            'category_id' => $this->category->id,
            'transaction_type' => 'debit',
            'transaction_date' => '2026-07-01',
            'description' => 'Sebelum diubah',
            'amount' => 100000,
        ]);

        $newCategory = TransactionCategory::create(['type' => 'expense', 'label' => 'Beban Maintenance']);

        $this->actingAs($this->admin)->post("/bank-transactions/{$tx->id}", [
            '_method' => 'put',
            'amount' => 673000,
            'transaction_date' => '2026-07-08',
            'description' => 'Belanja bahan wastafel',
            'category_id' => $newCategory->id,
            'attachment' => UploadedFile::fake()->image('clipboard-1783657398686.jpeg'),
        ])->assertRedirect();

        $tx->refresh();

        $this->assertSame($newCategory->id, $tx->category_id);
        $this->assertSame(673000, $tx->amount);
        $this->assertSame('2026-07-08', $tx->transaction_date->toDateString());
        $this->assertSame('Belanja bahan wastafel', $tx->description);
        $this->assertSame('clipboard-1783657398686.jpeg', $tx->attachment_name);
        Storage::disk('public')->assertExists($tx->attachment_path);
    }

    public function test_update_requires_transaction_date_not_date(): void
    {
        $tx = BankTransaction::factory()->create([
            'bank_account_id' => $this->account->id,
            'transaction_type' => 'debit',
        ]);

        $this->actingAs($this->admin)
            ->putJson("/bank-transactions/{$tx->id}", [
                'date' => '2026-07-08',
                'description' => 'Pakai key date yang salah',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['transaction_date']);
    }

    public function test_bulk_destroy_deletes_multiple_transactions(): void
    {
        $tx1 = BankTransaction::factory()->create(['bank_account_id' => $this->account->id]);
        $tx2 = BankTransaction::factory()->create(['bank_account_id' => $this->account->id]);
        $tx3 = BankTransaction::factory()->create(['bank_account_id' => $this->account->id]);

        $this->actingAs($this->admin)->post('/bank-transactions/bulk-delete', [
            'ids' => [$tx1->id, $tx2->id],
        ]);

        $this->assertDatabaseMissing('bank_transactions', ['id' => $tx1->id]);
        $this->assertDatabaseMissing('bank_transactions', ['id' => $tx2->id]);
        $this->assertDatabaseHas('bank_transactions', ['id' => $tx3->id]);
    }
}
