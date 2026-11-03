<?php

namespace Tests\Feature;

use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\TransactionCategory;
use App\Models\User;
use App\Services\CashFlowExportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

/**
 * Regresi BUG-CF-02, BUG-CF-04, BUG-CF-05.
 */
class CashFlowIntegrityTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private BankAccount $rekening;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'view expense', 'view income', 'create income', 'create expense',
            'edit income', 'edit expense', 'delete income', 'delete expense',
            'view bank-accounts',
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
            'initial_balance' => 10_000_000,
        ]);
    }

    private function kategori(string $type): TransactionCategory
    {
        return TransactionCategory::create([
            'label' => 'Kategori '.$type,
            'type' => $type,
        ]);
    }

    /** BUG-CF-04 — kategori pengeluaran tidak boleh dipakai transaksi masuk. */
    public function test_kategori_expense_ditolak_untuk_transaksi_masuk(): void
    {
        $kategori = $this->kategori('expense');

        $this->actingAs($this->admin)
            ->post('/bank-transactions', [
                'bank_account_id' => $this->rekening->id,
                'category_id' => $kategori->id,
                'transaction_type' => 'credit',
                'transaction_date' => now()->toDateString(),
                'amount' => 444_000,
                'description' => 'Kredit berkategori pengeluaran',
            ])
            ->assertSessionHasErrors('category_id');

        $this->assertDatabaseCount('bank_transactions', 0);
    }

    /** Kombinasi yang benar tetap diterima. */
    public function test_kategori_income_diterima_untuk_transaksi_masuk(): void
    {
        $kategori = $this->kategori('income');

        $this->actingAs($this->admin)
            ->post('/bank-transactions', [
                'bank_account_id' => $this->rekening->id,
                'category_id' => $kategori->id,
                'transaction_type' => 'credit',
                'transaction_date' => now()->toDateString(),
                'amount' => 444_000,
                'description' => 'Kredit berkategori pemasukan',
            ])
            ->assertSessionHasNoErrors();

        $this->assertDatabaseCount('bank_transactions', 1);
    }

    /** BUG-CF-02 — berkas lampiran harus ikut terhapus, termasuk lewat jalur bulk. */
    public function test_lampiran_terhapus_dari_disk_saat_transaksi_dihapus(): void
    {
        Storage::fake('public');

        $kategori = $this->kategori('expense');

        $this->actingAs($this->admin)->post('/bank-transactions', [
            'bank_account_id' => $this->rekening->id,
            'category_id' => $kategori->id,
            'transaction_type' => 'debit',
            'transaction_date' => now()->toDateString(),
            'amount' => 100_000,
            'description' => 'Dengan lampiran',
            'attachment' => UploadedFile::fake()->image('bukti.png'),
        ])->assertSessionHasNoErrors();

        $trx = BankTransaction::firstOrFail();
        $this->assertNotNull($trx->attachment_path);
        Storage::disk('public')->assertExists($trx->attachment_path);

        $path = $trx->attachment_path;

        $this->actingAs($this->admin)
            ->post('/cash-flow/bulk-delete', ['uids' => ['transaction-'.$trx->id]]);

        $this->assertDatabaseCount('bank_transactions', 0);
        Storage::disk('public')->assertMissing($path);
    }

    /** BUG-CF-05 — laporan SEMUA WAKTU harus mencakup transaksi bertanggal ke depan. */
    public function test_periode_semua_waktu_mencakup_transaksi_masa_depan(): void
    {
        $kategori = $this->kategori('expense');

        BankTransaction::create([
            'bank_account_id' => $this->rekening->id,
            'category_id' => $kategori->id,
            'transaction_type' => 'debit',
            'transaction_date' => now()->addDays(5),
            'amount' => 250_000,
            'description' => 'Bertanggal ke depan',
        ]);

        $data = (new CashFlowExportService)->buildReportData(null, null, null, null, null);

        $deskripsi = collect($data['transactions'])->pluck('description');

        $this->assertContains('Bertanggal ke depan', $deskripsi,
            'Laporan berlabel SEMUA WAKTU harus benar-benar mencakup seluruh data.');
    }
}
