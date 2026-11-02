<?php

namespace Tests\Feature;

use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Reimbursement;
use App\Models\TransactionCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class ReimbursementControllerTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected User $staff;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $permissions = [
            'view reimbursements', 'create reimbursements', 'edit reimbursements',
            'delete reimbursements', 'approve reimbursements', 'pay reimbursements',
        ];
        foreach ($permissions as $perm) {
            Permission::firstOrCreate(['name' => $perm]);
        }

        $adminRole = Role::firstOrCreate(['name' => 'admin']);
        $adminRole->syncPermissions($permissions);

        $staffRole = Role::firstOrCreate(['name' => 'staff']);
        $staffRole->syncPermissions(['view reimbursements', 'create reimbursements']);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');

        $this->staff = User::factory()->create();
        $this->staff->assignRole('staff');
    }

    private function makeReimbursement(User $user, array $attributes = []): Reimbursement
    {
        return Reimbursement::create(array_merge([
            'user_id' => $user->id,
            'title' => 'Transport ke Klien',
            'description' => 'Perjalanan dinas',
            'amount' => 250000,
            'expense_date' => '2026-03-10',
            'category_input' => 'transport',
            'status' => 'draft',
            'payment_status' => 'unpaid',
        ], $attributes));
    }

    public function test_index_requires_authentication(): void
    {
        $this->get('/reimbursements')->assertRedirect('/login');
    }

    public function test_index_renders_for_authorized_user(): void
    {
        $this->actingAs($this->admin)->get('/reimbursements')->assertOk();
    }

    /** Redesign 8 Okt 2026: form buat ada di sheet halaman daftar; route lama mengarah ke sana. */
    public function test_create_route_opens_the_form_on_the_list(): void
    {
        $this->actingAs($this->staff)->get('/reimbursements/create')->assertRedirect('/reimbursements?create=1');
    }

    public function test_edit_route_opens_the_detail_drawer(): void
    {
        $this->staff->givePermissionTo('edit reimbursements');
        $reimbursement = $this->makeReimbursement($this->staff);

        $this->actingAs($this->staff)
            ->get("/reimbursements/{$reimbursement->id}/edit")
            ->assertRedirect('/reimbursements#reimbursement/'.$reimbursement->id);
    }

    public function test_detail_data_is_available_to_owner_and_reviewers_only(): void
    {
        $reimbursement = $this->makeReimbursement($this->staff, ['status' => 'pending']);
        $stranger = User::factory()->create();
        $stranger->givePermissionTo('view reimbursements');

        $this->actingAs($this->staff)->getJson("/reimbursements/{$reimbursement->id}/data")
            ->assertOk()
            ->assertJsonPath('title', 'Transport ke Klien')
            ->assertJsonPath('category_label', 'Transportasi')
            ->assertJsonPath('can_review', false)
            ->assertJsonPath('review_category_options', []);

        $this->actingAs($this->admin)->getJson("/reimbursements/{$reimbursement->id}/data")
            ->assertOk()
            ->assertJsonPath('can_review', true);

        $this->actingAs($stranger)->getJson("/reimbursements/{$reimbursement->id}/data")->assertNotFound();
    }

    public function test_detail_data_lists_payments_with_bank_and_payer(): void
    {
        $category = TransactionCategory::create(['type' => 'expense', 'label' => 'Operasional']);
        $bank = BankAccount::factory()->create(['account_name' => 'BCA Operasional']);
        $reimbursement = $this->makeReimbursement($this->staff, ['status' => 'approved', 'amount' => 185000, 'category_id' => $category->id]);

        $this->actingAs($this->admin)->postJson("/reimbursements/{$reimbursement->id}/pay", [
            'bank_account_id' => $bank->id,
            'payment_date' => now()->toDateString(),
            'payment_amount' => 100000,
            'reference_notes' => 'TRF-001',
        ])->assertOk()->assertJsonPath('message', 'Pembayaran berhasil diproses');

        $this->actingAs($this->admin)->getJson("/reimbursements/{$reimbursement->id}/data")
            ->assertJsonPath('amount_remaining', 85000)
            ->assertJsonPath('transaction_category', 'Operasional')
            ->assertJsonPath('payments.0.amount', 100000)
            ->assertJsonPath('payments.0.bank_account_name', 'BCA Operasional')
            ->assertJsonPath('payments.0.payer_name', $this->admin->name)
            ->assertJsonPath('can_pay', true);
    }

    /** Aksi dari drawer memakai fetch JSON agar halaman di belakang modal tidak berganti. */
    public function test_drawer_actions_answer_json(): void
    {
        $reimbursement = $this->makeReimbursement($this->staff);

        $this->actingAs($this->staff)->postJson("/reimbursements/{$reimbursement->id}/submit")
            ->assertOk()
            ->assertJsonPath('message', 'Reimbursement berhasil diajukan untuk persetujuan');

        $this->actingAs($this->admin)->postJson("/reimbursements/{$reimbursement->id}/review", ['action' => 'reject', 'review_notes' => 'Kurang struk'])
            ->assertOk();

        $this->actingAs($this->admin)->postJson("/reimbursements/{$reimbursement->id}/review", ['action' => 'reject'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Reimbursement tidak dapat ditinjau');
    }

    public function test_store_json_returns_new_id(): void
    {
        $this->actingAs($this->staff)->postJson('/reimbursements', [
            'title' => 'Parkir',
            'amount' => 25000,
            'expense_date' => '2026-10-08',
            'category' => 'transport',
            'action' => 'submit',
        ])->assertOk()->assertJsonStructure(['message', 'id']);
    }

    public function test_index_sends_status_counts_for_the_current_scope(): void
    {
        $this->makeReimbursement($this->staff, ['status' => 'pending', 'amount' => 100000]);
        $this->makeReimbursement($this->staff, ['status' => 'pending', 'amount' => 50000]);
        $this->makeReimbursement($this->staff, ['status' => 'approved', 'amount' => 300000, 'amount_paid' => 100000, 'payment_status' => 'partial']);

        $this->actingAs($this->admin)->get('/reimbursements?status=pending')
            ->assertInertia(fn (Assert $page) => $page
                ->has('rows', 2)
                ->where('statusCounts.pending', 2)
                ->where('statusCounts.approved', 1)
                ->where('stats.pending_amount', 150000)
                ->where('stats.approved_remaining', 200000));
    }

    public function test_store_creates_draft_reimbursement(): void
    {
        $this->actingAs($this->staff)->post('/reimbursements', [
            'title' => 'Beli Alat Tulis',
            'description' => 'Keperluan kantor',
            'amount' => 150000,
            'expense_date' => '2026-03-12',
            'category' => 'office_supplies',
            'action' => 'draft',
        ]);

        $this->assertDatabaseHas('reimbursements', [
            'user_id' => $this->staff->id,
            'title' => 'Beli Alat Tulis',
            'status' => 'draft',
        ]);
    }

    public function test_store_with_submit_action_sets_pending_status(): void
    {
        $this->actingAs($this->staff)->post('/reimbursements', [
            'title' => 'Biaya Internet',
            'description' => 'Internet bulanan',
            'amount' => 300000,
            'expense_date' => '2026-03-01',
            'category' => 'communication',
            'action' => 'submit',
        ]);

        $this->assertDatabaseHas('reimbursements', [
            'user_id' => $this->staff->id,
            'title' => 'Biaya Internet',
            'status' => 'pending',
        ]);
    }

    public function test_submit_changes_status_to_pending(): void
    {
        $reimbursement = $this->makeReimbursement($this->staff);

        $this->actingAs($this->staff)->post("/reimbursements/{$reimbursement->id}/submit");

        $this->assertDatabaseHas('reimbursements', [
            'id' => $reimbursement->id,
            'status' => 'pending',
        ]);
    }

    public function test_destroy_deletes_draft_reimbursement(): void
    {
        $reimbursement = $this->makeReimbursement($this->admin);

        $this->actingAs($this->admin)->delete("/reimbursements/{$reimbursement->id}");

        $this->assertDatabaseMissing('reimbursements', ['id' => $reimbursement->id]);
    }

    public function test_staff_cannot_delete_without_permission(): void
    {
        $reimbursement = $this->makeReimbursement($this->staff);

        $this->actingAs($this->staff)->delete("/reimbursements/{$reimbursement->id}")->assertForbidden();
        $this->assertDatabaseHas('reimbursements', ['id' => $reimbursement->id]);
    }

    public function test_review_approve_changes_status(): void
    {
        $category = TransactionCategory::create([
            'type' => 'expense',
            'label' => 'Transport',
        ]);

        $reimbursement = $this->makeReimbursement($this->staff, ['status' => 'pending']);

        $this->actingAs($this->admin)->post("/reimbursements/{$reimbursement->id}/review", [
            'action' => 'approve',
            'review_notes' => 'Disetujui',
            'category_id' => $category->id,
        ]);

        $this->assertDatabaseHas('reimbursements', [
            'id' => $reimbursement->id,
            'status' => 'approved',
        ]);
    }

    /** QA 8 Okt 2026 BUG-01: lampiran ada di disk "public", hook deleting memakai disk default. */
    public function test_deleting_removes_attachment_from_public_disk(): void
    {
        Storage::fake('public');
        $path = UploadedFile::fake()->image('struk.jpg')->store('reimbursements', 'public');
        $reimbursement = $this->makeReimbursement($this->admin, ['attachment_path' => $path, 'attachment_name' => 'struk.jpg']);

        $this->actingAs($this->admin)->delete("/reimbursements/{$reimbursement->id}");

        $this->assertDatabaseMissing('reimbursements', ['id' => $reimbursement->id]);
        Storage::disk('public')->assertMissing($path);
    }

    /** BUG-03: pesan validasi bawaan kini berbahasa Indonesia. */
    public function test_validation_messages_are_in_indonesian(): void
    {
        $this->actingAs($this->staff)
            ->post('/reimbursements', ['action' => 'submit'])
            ->assertSessionHasErrors([
                'title' => 'Judul wajib diisi.',
                'category' => 'Kategori wajib diisi.',
            ]);
    }

    /** BUG-04: pembayaran melebihi sisa ditolak dan tidak membuat transaksi bank. */
    public function test_payment_cannot_exceed_remaining_amount(): void
    {
        $category = TransactionCategory::create(['type' => 'expense', 'label' => 'Operasional']);
        $bank = BankAccount::factory()->create();
        $reimbursement = $this->makeReimbursement($this->staff, ['status' => 'approved', 'amount' => 420000, 'category_id' => $category->id]);

        $this->actingAs($this->admin)
            ->post("/reimbursements/{$reimbursement->id}/pay", [
                'bank_account_id' => $bank->id,
                'payment_date' => now()->toDateString(),
                'payment_amount' => 500000,
            ])
            ->assertSessionHasErrors(['payment_amount' => 'Jumlah pembayaran melebihi sisa reimbursement (Rp 420.000).']);

        $this->assertSame(0, $reimbursement->fresh()->amount_paid);
        $this->assertSame(0, BankTransaction::count());
    }

    /** BUG-05: deskripsi opsional — request tanpa kolom deskripsi tidak boleh error 500. */
    public function test_store_without_description_field_succeeds(): void
    {
        $this->actingAs($this->staff)->post('/reimbursements', [
            'title' => 'Kurir dokumen',
            'amount' => 65000,
            'expense_date' => '2026-10-08',
            'category' => 'other',
            'action' => 'draft',
        ])->assertRedirect('/reimbursements');

        $this->assertDatabaseHas('reimbursements', ['title' => 'Kurir dokumen', 'description' => null]);
    }

    /** BUG-06: ?tab=all tidak membuka pengajuan pengguna lain bagi yang bukan reviewer/pembayar. */
    public function test_staff_only_sees_own_reimbursements_even_with_tab_all(): void
    {
        $this->makeReimbursement($this->admin, ['title' => 'Milik admin']);
        $this->makeReimbursement($this->staff, ['title' => 'Milik staff']);

        $this->actingAs($this->staff)
            ->get('/reimbursements?tab=all')
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.tab', 'my')
                ->where('canSeeAll', false)
                ->has('rows', 1)
                ->where('rows.0.title', 'Milik staff')
                ->where('stats.total', 1));
    }

    /** BUG-07: izin hapus tidak berarti boleh menghapus milik orang lain. */
    public function test_user_cannot_delete_another_users_draft(): void
    {
        $deleter = User::factory()->create();
        $deleter->givePermissionTo(['view reimbursements', 'delete reimbursements']);
        $reimbursement = $this->makeReimbursement($this->admin);

        $this->actingAs($deleter)
            ->delete("/reimbursements/{$reimbursement->id}")
            ->assertSessionHas('error', 'Reimbursement tidak dapat dihapus');

        $this->assertDatabaseHas('reimbursements', ['id' => $reimbursement->id]);
    }

    /** BUG-08: pengajuan yang ditolak bisa diperbaiki lalu diajukan ulang. */
    public function test_rejected_reimbursement_can_be_edited_and_resubmitted(): void
    {
        $this->staff->givePermissionTo('edit reimbursements');
        $reimbursement = $this->makeReimbursement($this->staff, [
            'status' => 'rejected',
            'reviewed_by' => $this->admin->id,
            'reviewed_at' => now(),
            'review_notes' => 'Lampirkan struk',
        ]);

        $this->actingAs($this->staff)->put("/reimbursements/{$reimbursement->id}", [
            'title' => 'Transport ke Klien',
            'description' => 'Sudah dilampirkan',
            'amount' => 250000,
            'expense_date' => '2026-03-10',
            'category' => 'transport',
            'action' => 'submit',
        ])->assertSessionHas('success', 'Reimbursement berhasil diajukan untuk persetujuan');

        $fresh = $reimbursement->fresh();
        $this->assertSame('pending', $fresh->status);
        $this->assertNull($fresh->reviewed_by);
        $this->assertNull($fresh->review_notes);
    }

    /** BUG-09: pengajuan yang sudah dibayar tidak bisa dihapus, termasuk oleh admin. */
    public function test_reimbursement_with_payment_cannot_be_deleted_even_by_admin(): void
    {
        $reimbursement = $this->makeReimbursement($this->staff, ['status' => 'paid', 'payment_status' => 'paid', 'amount_paid' => 250000]);

        $this->actingAs($this->admin)
            ->delete("/reimbursements/{$reimbursement->id}")
            ->assertSessionHas('error', 'Reimbursement yang sudah memiliki pembayaran tidak dapat dihapus.');

        $this->assertDatabaseHas('reimbursements', ['id' => $reimbursement->id]);
    }

    public function test_review_requires_approve_permission(): void
    {
        $reimbursement = $this->makeReimbursement($this->staff, ['status' => 'pending']);

        $this->actingAs($this->staff)->post("/reimbursements/{$reimbursement->id}/review", [
            'action' => 'approve',
            'review_notes' => '',
        ])->assertForbidden();
    }
}
