<?php

namespace Tests\Feature;

use App\Models\BankAccount;
use App\Models\Receivable;
use App\Models\TransactionCategory;
use App\Models\User;
use Database\Seeders\TransactionCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class ReceivableControllerTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected User $debtor;

    protected BankAccount $bankAccount;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(TransactionCategorySeeder::class);

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $permissions = [
            'view receivables', 'create receivables', 'edit receivables',
            'delete receivables', 'approve receivables', 'pay receivables',
        ];
        foreach ($permissions as $perm) {
            Permission::firstOrCreate(['name' => $perm]);
        }

        $adminRole = Role::firstOrCreate(['name' => 'admin']);
        $adminRole->syncPermissions($permissions);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');

        $this->debtor = User::factory()->create();
        $this->bankAccount = BankAccount::factory()->create(['initial_balance' => 50000000]);
    }

    private function makeReceivable(array $attributes = []): Receivable
    {
        return Receivable::create(array_merge([
            'receivable_number' => 'RCV-00001',
            'type' => 'employee_loan',
            'debtor_type' => User::class,
            'debtor_id' => $this->debtor->id,
            'principal_amount' => 2000000,
            'interest_rate' => 10,
            'loan_date' => '2026-01-01',
            'status' => 'pending_approval',
        ], $attributes));
    }

    public function test_index_requires_authentication(): void
    {
        $this->get('/receivables')->assertRedirect('/login');
    }

    public function test_index_renders_for_authorized_user(): void
    {
        $this->actingAs($this->admin)->get('/receivables')->assertOk();
    }

    public function test_approve_activates_receivable_and_creates_debit_with_system_category(): void
    {
        $this->withoutExceptionHandling();
        $receivable = $this->makeReceivable();
        $initialBalance = $this->bankAccount->balance;

        $this->actingAs($this->admin)->post("/receivables/{$receivable->id}/approve", [
            'action' => 'approve',
            'bank_account_id' => $this->bankAccount->id,
        ]);

        $this->assertDatabaseHas('receivables', [
            'id' => $receivable->id,
            'status' => 'active',
            'approved_by' => $this->admin->id,
        ]);

        $this->assertDatabaseHas('bank_transactions', [
            'bank_account_id' => $this->bankAccount->id,
            'amount' => 2000000,
            'transaction_type' => 'debit',
            'category_id' => TransactionCategory::findSystem('FIN-RCV-OUT')->id,
        ]);

        $this->assertSame($initialBalance - 2000000, $this->bankAccount->fresh()->balance);
    }

    public function test_reject_does_not_touch_bank_transactions(): void
    {
        $this->withoutExceptionHandling();
        $receivable = $this->makeReceivable();

        $this->actingAs($this->admin)->post("/receivables/{$receivable->id}/approve", [
            'action' => 'reject',
            'notes' => 'Tidak disetujui',
        ]);

        $this->assertDatabaseHas('receivables', [
            'id' => $receivable->id,
            'status' => 'rejected',
        ]);

        $this->assertDatabaseCount('bank_transactions', 0);
    }

    public function test_pay_via_bank_transfer_creates_credits_with_system_categories(): void
    {
        $this->withoutExceptionHandling();
        $receivable = $this->makeReceivable(['status' => 'active']);

        $this->actingAs($this->admin)->post("/receivables/{$receivable->id}/pay", [
            'bank_account_id' => $this->bankAccount->id,
            'payment_date' => '2026-02-01',
            'principal_paid' => 500000,
            'interest_paid' => 100000,
            'payment_method' => 'bank_transfer',
        ]);

        $this->assertDatabaseHas('receivable_payments', [
            'receivable_id' => $receivable->id,
            'principal_paid' => 500000,
            'interest_paid' => 100000,
        ]);

        $this->assertDatabaseHas('bank_transactions', [
            'bank_account_id' => $this->bankAccount->id,
            'transaction_type' => 'credit',
            'amount' => 500000,
            'category_id' => TransactionCategory::findSystem('FIN-RCV-IN')->id,
        ]);

        $this->assertDatabaseHas('bank_transactions', [
            'bank_account_id' => $this->bankAccount->id,
            'transaction_type' => 'credit',
            'amount' => 100000,
            'category_id' => TransactionCategory::findSystem('REV-INTEREST')->id,
        ]);
    }

    public function test_pay_cash_does_not_create_bank_transactions(): void
    {
        $this->withoutExceptionHandling();
        $receivable = $this->makeReceivable(['status' => 'active']);

        $this->actingAs($this->admin)->post("/receivables/{$receivable->id}/pay", [
            'payment_date' => '2026-02-01',
            'principal_paid' => 500000,
            'payment_method' => 'cash',
        ]);

        $this->assertDatabaseHas('receivable_payments', [
            'receivable_id' => $receivable->id,
            'principal_paid' => 500000,
        ]);

        $this->assertDatabaseCount('bank_transactions', 0);
    }

    public function test_full_principal_payment_marks_receivable_paid_off(): void
    {
        $this->withoutExceptionHandling();
        $receivable = $this->makeReceivable(['status' => 'active', 'principal_amount' => 500000]);

        $this->actingAs($this->admin)->post("/receivables/{$receivable->id}/pay", [
            'payment_date' => '2026-02-01',
            'principal_paid' => 500000,
            'payment_method' => 'cash',
        ]);

        $this->assertDatabaseHas('receivables', [
            'id' => $receivable->id,
            'status' => 'paid_off',
        ]);
    }

    public function test_approve_requires_permission(): void
    {
        $receivable = $this->makeReceivable();
        $noPermUser = User::factory()->create();

        $this->actingAs($noPermUser)->post("/receivables/{$receivable->id}/approve", [
            'action' => 'approve',
            'bank_account_id' => $this->bankAccount->id,
        ])->assertForbidden();
    }

    /**
     * Regresi BUG-C4 (QA 2026-08-19): form React mengirim multipart
     * (forceFormData) sehingga installment_months tiba sebagai STRING;
     * Carbon::addMonths() bertipe int|float melempar TypeError → HTTP 500,
     * membuat piutang mustahil dibuat/diedit dari UI. Rule `integer` hanya
     * memvalidasi, tidak meng-cast.
     */
    public function test_store_accepts_string_numerics_from_multipart_form(): void
    {
        $this->actingAs($this->admin)->post('/receivables', [
            'type' => 'employee_loan',
            'debtor_id' => (string) $this->debtor->id,
            'principal_amount' => '6000000',
            'interest_type' => 'percentage',
            'interest_rate' => '5',
            'installment_months' => '6',
            'loan_date' => '2026-08-01',
            'purpose' => 'Uji string numerik dari form',
            'disbursement_account' => 'BCA 123',
        ])->assertRedirect();

        $this->assertDatabaseHas('receivables', [
            'principal_amount' => 6000000,
            'installment_months' => 6,
            'due_date' => '2027-02-01',
            'status' => 'draft',
        ]);
    }

    public function test_update_accepts_string_numerics_from_multipart_form(): void
    {
        $receivable = $this->makeReceivable(['status' => 'draft']);

        $this->actingAs($this->admin)->put("/receivables/{$receivable->id}", [
            'type' => 'employee_loan',
            'debtor_id' => (string) $this->debtor->id,
            'principal_amount' => '9000000',
            'interest_type' => 'percentage',
            'interest_rate' => '10',
            'installment_months' => '3',
            'loan_date' => '2026-08-01',
            'purpose' => 'Uji ubah dengan string numerik',
            'disbursement_account' => 'BCA 123',
        ])->assertRedirect();

        $this->assertDatabaseHas('receivables', [
            'id' => $receivable->id,
            'principal_amount' => 9000000,
            'installment_months' => 3,
            'due_date' => '2026-11-01',
        ]);
    }

    /**
     * "Lewat tempo" adalah angka risiko utama halaman Piutang, dan ia dihitung lewat
     * subquery agregat pembayaran. Yang diuji di sini adalah tiga hal yang mudah
     * menyimpang diam-diam:
     *
     *   1. piutang lewat tempo yang pokoknya SUDAH tertutup tidak boleh ikut dihitung;
     *   2. yang belum berjalan (draft/menunggu) tidak boleh ikut, meski tanggalnya lewat;
     *   3. nominalnya adalah SISA, bukan pokok penuh.
     */
    public function test_lewat_tempo_hanya_menghitung_piutang_aktif_yang_pokoknya_belum_tertutup(): void
    {
        // Lewat tempo, baru sebagian kembali -> HARUS dihitung, sisanya 7.000.000.
        $menunggak = $this->makeReceivable([
            'receivable_number' => 'RCV-TUNGGAK',
            'principal_amount' => 10_000_000,
            'status' => 'active',
            'due_date' => now()->subMonths(2)->toDateString(),
        ]);
        $menunggak->payments()->create([
            'bank_account_id' => $this->bankAccount->id,
            'payment_date' => now()->subMonths(3)->toDateString(),
            'principal_paid' => 3_000_000,
            'interest_paid' => 0,
            'total_paid' => 3_000_000,
        ]);

        // Lewat tempo tapi pokoknya sudah tertutup penuh -> TIDAK boleh dihitung.
        $sudahKembali = $this->makeReceivable([
            'receivable_number' => 'RCV-KEMBALI',
            'principal_amount' => 5_000_000,
            'status' => 'active',
            'due_date' => now()->subMonths(1)->toDateString(),
        ]);
        $sudahKembali->payments()->create([
            'bank_account_id' => $this->bankAccount->id,
            'payment_date' => now()->subMonths(1)->toDateString(),
            'principal_paid' => 5_000_000,
            'interest_paid' => 0,
            'total_paid' => 5_000_000,
        ]);

        // Belum berjalan, tanggalnya lewat -> TIDAK boleh dihitung: belum ada uang keluar.
        $this->makeReceivable([
            'receivable_number' => 'RCV-DRAFT',
            'principal_amount' => 8_000_000,
            'status' => 'draft',
            'due_date' => now()->subMonths(4)->toDateString(),
        ]);

        // Aktif tapi belum jatuh tempo -> TIDAK boleh dihitung.
        $this->makeReceivable([
            'receivable_number' => 'RCV-BELUM-JT',
            'principal_amount' => 6_000_000,
            'status' => 'active',
            'due_date' => now()->addMonths(3)->toDateString(),
        ]);

        $this->actingAs($this->admin)->get('/receivables')->assertOk()->assertInertia(
            fn (Assert $page) => $page
                ->where('stats.overdue_count', 1)
                ->where('stats.overdue_amount', 7_000_000)
        );
    }

    /** Sisa piutang dicakup ke yang aktif; pembayaran piutang lunas tidak boleh menyusutkannya. */
    public function test_sisa_piutang_hanya_mencakup_yang_aktif(): void
    {
        $aktif = $this->makeReceivable([
            'receivable_number' => 'RCV-AKTIF',
            'principal_amount' => 10_000_000,
            'status' => 'active',
            'due_date' => now()->addMonth()->toDateString(),
        ]);
        $aktif->payments()->create([
            'bank_account_id' => $this->bankAccount->id,
            'payment_date' => now()->toDateString(),
            'principal_paid' => 2_000_000,
            'interest_paid' => 100_000,
            'total_paid' => 2_100_000,
        ]);

        // Lunas, pembayarannya SENGAJA tidak genap.
        $lunas = $this->makeReceivable([
            'receivable_number' => 'RCV-LUNAS',
            'principal_amount' => 4_000_000,
            'status' => 'paid_off',
            'due_date' => now()->subMonth()->toDateString(),
        ]);
        $lunas->payments()->create([
            'bank_account_id' => $this->bankAccount->id,
            'payment_date' => now()->subMonth()->toDateString(),
            'principal_paid' => 2_500_000,
            'interest_paid' => 300_000,
            'total_paid' => 2_800_000,
        ]);

        $this->actingAs($this->admin)->get('/receivables')->assertOk()->assertInertia(
            fn (Assert $page) => $page
                ->where('stats.total_principal_active', 10_000_000)
                ->where('stats.paid_principal', 2_000_000)
                ->where('stats.outstanding_principal', 8_000_000)
                ->where('stats.paid_interest', 100_000)
        );
    }

    /** Hitungan pil status memberi tahu berapa yang menunggu keputusan tanpa perlu menyaring dulu. */
    public function test_hitungan_status_dikirim_untuk_setiap_keadaan(): void
    {
        $this->makeReceivable(['receivable_number' => 'RCV-D', 'status' => 'draft']);
        $this->makeReceivable(['receivable_number' => 'RCV-P1', 'status' => 'pending_approval']);
        $this->makeReceivable(['receivable_number' => 'RCV-P2', 'status' => 'pending_approval']);
        $this->makeReceivable(['receivable_number' => 'RCV-A', 'status' => 'active']);
        $this->makeReceivable(['receivable_number' => 'RCV-T', 'status' => 'rejected']);

        $this->actingAs($this->admin)->get('/receivables')->assertOk()->assertInertia(
            fn (Assert $page) => $page
                ->where('statusCounts.draft', 1)
                ->where('statusCounts.pending_approval', 2)
                ->where('statusCounts.active', 1)
                ->where('statusCounts.paid_off', 0)
                ->where('statusCounts.rejected', 1)
        );
    }
}
