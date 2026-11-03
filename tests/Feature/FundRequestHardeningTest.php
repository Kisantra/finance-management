<?php

namespace Tests\Feature;

use App\Models\FundRequest;
use App\Models\FundRequestItem;
use App\Models\TransactionCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Regresi BUG-FR-01..BUG-FR-07.
 */
class FundRequestHardeningTest extends TestCase
{
    use RefreshDatabase;

    private User $pemohon;

    private User $lain;

    private TransactionCategory $kategoriExpense;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'view fund requests', 'create fund requests', 'edit fund requests',
            'delete fund requests', 'approve fund requests', 'disburse fund requests',
        ] as $name) {
            Permission::findOrCreate($name, 'web');
        }
        Role::findOrCreate('admin', 'web');

        setPermissionsTeamId(self::TEST_COMPANY);

        $this->pemohon = User::factory()->create();
        $this->pemohon->companies()->syncWithoutDetaching([self::TEST_COMPANY]);
        $this->pemohon->givePermissionTo(Permission::all());

        $this->lain = User::factory()->create();
        $this->lain->companies()->syncWithoutDetaching([self::TEST_COMPANY]);
        $this->lain->givePermissionTo(Permission::all());

        $this->kategoriExpense = TransactionCategory::create([
            'label' => 'Operasional', 'type' => 'expense',
        ]);
    }

    private function pengajuan(User $pemilik, string $status = 'draft'): FundRequest
    {
        $fr = FundRequest::create([
            'user_id' => $pemilik->id,
            'title' => 'Pengajuan Uji',
            'purpose' => 'Untuk pengujian',
            'priority' => 'medium',
            'needed_by_date' => now()->addDays(7),
            'status' => $status,
            'total_amount' => 100_000,
        ]);

        FundRequestItem::create([
            'fund_request_id' => $fr->id,
            'description' => 'Item',
            'category_id' => $this->kategoriExpense->id,
            'quantity' => 1,
            'unit_price' => 100_000,
            'amount' => 100_000,
        ]);

        return $fr;
    }

    /** BUG-FR-02 — hanya pemilik (atau admin) yang boleh menghapus. */
    public function test_pengguna_lain_tidak_dapat_menghapus_pengajuan_orang(): void
    {
        $fr = $this->pengajuan($this->pemohon);

        // Penolakannya berupa redirect + pesan galat (kontrak yang sudah
        // ditegakkan FundRequestControllerTest), bukan 403 — yang penting
        // barisnya tidak terhapus.
        $this->actingAs($this->lain)
            ->delete("/fund-requests/{$fr->id}")
            ->assertRedirect();

        $this->assertDatabaseHas('fund_requests', ['id' => $fr->id]);
    }

    /** BUG-FR-03 — pengajuan yang sudah dicairkan tidak boleh dihapus. */
    public function test_pengajuan_dicairkan_tidak_dapat_dihapus(): void
    {
        $fr = $this->pengajuan($this->pemohon, 'disbursed');

        $this->actingAs($this->pemohon)
            ->delete("/fund-requests/{$fr->id}")
            ->assertSessionHasErrors('delete');

        $this->assertDatabaseHas('fund_requests', ['id' => $fr->id]);
    }

    /** BUG-FR-04 — nomor diturunkan dari urutan terbesar, bukan COUNT. */
    public function test_nomor_tidak_bentrok_setelah_penghapusan(): void
    {
        $a = $this->pengajuan($this->pemohon);
        $b = $this->pengajuan($this->pemohon);

        $nomorB = $b->request_number;

        // Hapus yang pertama: COUNT turun, tetapi nomor terbesar tetap milik B.
        $a->items()->delete();
        $a->delete();

        $berikutnya = FundRequest::generateRequestNumber();

        $this->assertNotSame($nomorB, $berikutnya,
            'Nomor berikutnya tidak boleh bentrok dengan nomor yang masih ada.');
        $this->assertFalse(FundRequest::where('request_number', $berikutnya)->exists());
    }

    /** BUG-FR-05 — kategori item wajib bertipe expense. */
    public function test_kategori_item_non_expense_ditolak(): void
    {
        $income = TransactionCategory::create(['label' => 'Pemasukan', 'type' => 'income']);

        $this->actingAs($this->pemohon)
            ->post('/fund-requests', [
                'title' => 'Salah kategori',
                'purpose' => 'Uji',
                'priority' => 'medium',
                'needed_by_date' => now()->addDays(3)->toDateString(),
                'action' => 'draft',
                'items' => [[
                    'description' => 'Item',
                    'category_id' => $income->id,
                    'quantity' => 1,
                    'unit_price' => 50_000,
                ]],
            ])
            ->assertSessionHasErrors('items.0.category_id');
    }

    /** BUG-FR-01 — pengajuan ulang setelah ditolak harus benar-benar terkirim. */
    public function test_pengajuan_ulang_setelah_ditolak_benar_benar_terkirim(): void
    {
        $fr = $this->pengajuan($this->pemohon, 'rejected');

        $this->actingAs($this->pemohon)
            ->put("/fund-requests/{$fr->id}", [
                'title' => 'Pengajuan Uji (revisi)',
                'purpose' => 'Sudah diperbaiki',
                'priority' => 'medium',
                'needed_by_date' => now()->addDays(7)->toDateString(),
                'action' => 'submit',
                'items' => [[
                    'description' => 'Item',
                    'category_id' => $this->kategoriExpense->id,
                    'quantity' => 1,
                    'unit_price' => 100_000,
                ]],
            ]);

        $this->assertSame('pending', $fr->fresh()->status,
            'Status harus berpindah ke pending, bukan diam di rejected sementara pengguna melihat flash sukses.');
    }

    /** BUG-FR-07 — daftar pemohon tidak boleh memuat pengguna perusahaan lain. */
    public function test_daftar_pemohon_hanya_anggota_perusahaan_aktif(): void
    {
        $luar = User::factory()->create(['name' => 'Orang Perusahaan Lain']);

        $response = $this->actingAs($this->pemohon)->get('/fund-requests');
        $response->assertOk();

        $nama = collect($response->viewData('page')['props']['userOptions'] ?? [])
            ->pluck('label');

        $this->assertNotContains($luar->name, $nama);
    }
}
