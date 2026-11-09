<?php

namespace Tests\Feature;

use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\TransactionCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Endpoint "Pakai Template" di halaman Kategori Transaksi: pratinjau sebagai prop
 * Inertia opsional (dimuat saat dialog dibuka) dan POST /transaction-categories/template.
 * Keduanya hanya untuk pemegang izin `manage categories`.
 */
class TransactionCategoryTemplateTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $viewer;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        foreach (['view categories', 'manage categories'] as $izin) {
            Permission::firstOrCreate(['name' => $izin]);
        }

        Role::firstOrCreate(['name' => 'admin'])->syncPermissions(['view categories', 'manage categories']);
        Role::firstOrCreate(['name' => 'viewer'])->syncPermissions(['view categories']);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');

        $this->viewer = User::factory()->create();
        $this->viewer->assignRole('viewer');
    }

    public function test_menerapkan_template_membuat_kategori_dan_melaporkan_jumlahnya(): void
    {
        $this->actingAs($this->admin)
            ->from('/transaction-categories')
            ->post('/transaction-categories/template')
            ->assertRedirect()
            ->assertSessionHas('success', '67 kategori dibuat, 0 dilewati karena sudah ada.');

        $this->assertSame(67, TransactionCategory::count());
        $this->assertSame('opex', TransactionCategory::where('label', 'Gaji Karyawan')->sole()->pl_group);
    }

    public function test_klik_ulang_tidak_membuat_kategori_baru(): void
    {
        $this->actingAs($this->admin)->post('/transaction-categories/template');

        $this->actingAs($this->admin)
            ->post('/transaction-categories/template')
            ->assertSessionHas('success', '0 kategori dibuat, 67 dilewati karena sudah ada.');

        $this->assertSame(67, TransactionCategory::count());
    }

    public function test_pesan_menyebut_kategori_yang_dilewati_penjaga(): void
    {
        $induk = TransactionCategory::create(['type' => 'expense', 'label' => 'Beban Kantor']);
        BankTransaction::create([
            'bank_account_id' => BankAccount::factory()->create()->id,
            'category_id' => $induk->id,
            'amount' => 100_000,
            'transaction_date' => '2026-10-01',
            'transaction_type' => 'debit',
            'description' => 'Listrik kantor',
        ]);

        $this->actingAs($this->admin)
            ->post('/transaction-categories/template')
            ->assertSessionHas('success', '60 kategori dibuat, 0 dilewati karena sudah ada. 7 lainnya dilewati, alasannya tercantum di pratinjau Pakai Template.');

        $this->assertSame(0, $induk->children()->count());
    }

    public function test_daftar_dari_klien_diabaikan(): void
    {
        $this->actingAs($this->admin)->post('/transaction-categories/template', [
            'groups' => [['type' => 'expense', 'label' => 'Kategori Titipan Klien', 'children' => ['Sisipan']]],
        ]);

        $this->assertSame(0, TransactionCategory::whereIn('label', ['Kategori Titipan Klien', 'Sisipan'])->count());
        $this->assertSame(67, TransactionCategory::count());
    }

    public function test_pengguna_hanya_lihat_ditolak(): void
    {
        $this->actingAs($this->viewer)
            ->post('/transaction-categories/template')
            ->assertForbidden();

        $this->assertSame(0, TransactionCategory::count());
    }

    public function test_pratinjau_tidak_ikut_kunjungan_biasa_dan_dimuat_lewat_partial_reload(): void
    {
        TransactionCategory::create(['type' => 'expense', 'label' => 'beban karyawan']);

        $this->actingAs($this->admin)
            ->get('/transaction-categories')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('transaction-categories/index')
                ->missing('templatePreview')
                ->reloadOnly('templatePreview', fn (Assert $reload) => $reload
                    ->has('templatePreview.groups', 12)
                    ->where('templatePreview.summary', ['new' => 66, 'existing' => 1, 'skipped' => 0])
                    ->where('templatePreview.groups.3.label', 'Beban Karyawan')
                    ->where('templatePreview.groups.3.status', 'existing')
                    ->where('templatePreview.groups.3.existing_label', 'beban karyawan')
                    ->where('templatePreview.groups.3.children.0.label', 'Gaji Karyawan')
                    ->where('templatePreview.groups.3.children.0.status', 'new')
                    ->missing('categories')
                )
            );

        $this->assertSame(1, TransactionCategory::count(), 'Pratinjau tidak boleh membuat kategori.');
    }

    public function test_pratinjau_tidak_tersedia_untuk_pengguna_hanya_lihat(): void
    {
        $this->actingAs($this->viewer)
            ->get('/transaction-categories')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->missing('templatePreview')
                ->reloadOnly('templatePreview', fn (Assert $reload) => $reload->where('templatePreview', null))
            );
    }
}
