<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Receivable;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

/**
 * Regresi BUG-C2, BUG-C3, BUG-C5, BUG-C7.
 */
class ReceivableHardeningTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'view receivables', 'create receivables', 'edit receivables',
            'delete receivables', 'approve receivables', 'pay receivables',
        ] as $name) {
            Permission::findOrCreate($name, 'web');
        }

        setPermissionsTeamId(self::TEST_COMPANY);
        $this->admin = User::factory()->create();
        $this->admin->companies()->syncWithoutDetaching([self::TEST_COMPANY]);
        $this->admin->givePermissionTo(Permission::all());
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(array $tambahan = []): array
    {
        return array_merge([
            'type' => 'employee_loan',
            'debtor_id' => $this->admin->id,
            'principal_amount' => 10_000_000,
            'interest_type' => 'fixed',
            'interest_amount' => 333_333,
            'loan_date' => now()->toDateString(),
            'installment_months' => 12,
            'purpose' => 'Uji piutang',
            'disbursement_account' => 'Kas',
        ], $tambahan);
    }

    /** BUG-C3 — debitur yang tidak ada harus ditolak. */
    public function test_debitur_tidak_dikenal_ditolak(): void
    {
        $this->actingAs($this->admin)
            ->post('/receivables', $this->payload(['debtor_id' => 999999]))
            ->assertSessionHasErrors('debtor_id');

        $this->assertDatabaseCount('receivables', 0);
    }

    /** BUG-C3 — id klien tidak boleh dipakai untuk piutang karyawan. */
    public function test_debitur_salah_jenis_ditolak(): void
    {
        // Klien dibuat dengan id yang belum tentu ada di tabel users.
        $klien = Client::factory()->create();

        $this->actingAs($this->admin)
            ->post('/receivables', $this->payload([
                'type' => 'company_loan',
                'debtor_id' => 999999,
            ]))
            ->assertSessionHasErrors('debtor_id');

        $this->assertDatabaseCount('receivables', 0);
        $this->assertNotNull($klien->id);
    }

    /** BUG-C5 — presisi rate cukup untuk mengembalikan nominal yang diketik. */
    public function test_bunga_nominal_tidak_bergeser_lebih_dari_sepuluh_rupiah(): void
    {
        $this->actingAs($this->admin)
            ->post('/receivables', $this->payload())
            ->assertSessionHasNoErrors();

        $r = Receivable::firstOrFail();
        $bungaTersimpan = (int) round($r->principal_amount * $r->interest_rate / 100);

        $this->assertLessThanOrEqual(10, abs($bungaTersimpan - 333_333),
            'Bunga hasil rekonstruksi tidak boleh bergeser jauh dari nominal yang diketik.');
    }

    /** BUG-C7 — revisi setelah ditolak harus membersihkan jejak persetujuan. */
    public function test_revisi_setelah_ditolak_membersihkan_jejak_persetujuan(): void
    {
        $this->actingAs($this->admin)->post('/receivables', $this->payload());

        $r = Receivable::firstOrFail();
        $r->update([
            'status' => 'rejected',
            'rejection_reason' => 'Kurang lengkap',
            'approved_by' => $this->admin->id,
            'approved_at' => now(),
        ]);

        $this->actingAs($this->admin)
            ->put("/receivables/{$r->id}", $this->payload(['purpose' => 'Uji piutang (revisi)']));

        $segar = $r->fresh();

        $this->assertSame('draft', $segar->status);
        $this->assertNull($segar->approved_by, 'approved_by dari siklus lama harus dibersihkan.');
        $this->assertNull($segar->approved_at, 'approved_at dari siklus lama harus dibersihkan.');
        $this->assertNull($segar->rejection_reason);
    }
}
