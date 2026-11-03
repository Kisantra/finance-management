<?php

namespace Tests\Tenancy;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;
use Tests\TenancyTestCase;

/**
 * Role Spatie memakai fitur teams dengan `company_id` sebagai team key, dan
 * tabel-tabelnya tinggal di database CENTRAL sementara koneksi default sudah
 * berpindah ke database tenant. Dua hal bisa salah di produksi tanpa terdeteksi
 * suite Unit/Feature:
 *
 * 1. konteks team tidak ikut berpindah saat tenancy berganti, sehingga satu
 *    orang membawa izin perusahaan lain;
 * 2. cache permission Spatie (per-proses) menahan hasil perusahaan sebelumnya.
 */
class KonteksTeamPermissionTest extends TenancyTestCase
{
    public function test_izin_berbalik_saat_tenant_berganti(): void
    {
        $pengguna = $this->penggunaDuaPeran();

        $this->useTenant(0);
        $pengguna->unsetRelation('roles')->unsetRelation('permissions');
        $this->assertTrue(
            $pengguna->can('approve reimbursements'),
            'Finance manager di perusahaan A tidak boleh menyetujui reimbursement di perusahaan A.'
        );

        $this->useTenant(1);
        $pengguna->unsetRelation('roles')->unsetRelation('permissions');
        $this->assertFalse(
            $pengguna->can('approve reimbursements'),
            'Staff di perusahaan B tetap dapat menyetujui reimbursement - izin perusahaan A ikut terbawa.'
        );
    }

    /**
     * Tanpa pembersihan cache, jawaban perusahaan A tetap terpakai di B.
     * Yang diuji di sini: urutan switch nyata (A -> B -> A) menghasilkan
     * jawaban yang benar setiap kali, bukan jawaban pertama yang diulang.
     */
    public function test_cache_permission_tidak_bocor_antar_perusahaan(): void
    {
        $pengguna = $this->penggunaDuaPeran();

        $jawaban = [];

        foreach ([0, 1, 0, 1] as $i) {
            $this->useTenant($i);
            $pengguna->unsetRelation('roles')->unsetRelation('permissions');
            $jawaban[] = $pengguna->can('approve reimbursements');
        }

        $this->assertSame(
            [true, false, true, false],
            $jawaban,
            'Hasil can() tidak mengikuti perusahaan aktif - cache permission Spatie bocor antar tenant.'
        );
    }

    /**
     * Pemberian role dicatat di database CENTRAL dengan company_id sebagai team,
     * bukan di database tenant yang sedang aktif.
     */
    public function test_pemberian_role_tersimpan_di_central_dengan_company_id(): void
    {
        $pengguna = $this->penggunaDuaPeran();

        $this->useTenant(0);

        $baris = DB::connection(config('tenancy.database.central_connection'))
            ->table('model_has_roles')
            ->where('model_id', $pengguna->id)
            ->pluck('company_id')
            ->sort()
            ->values()
            ->all();

        $this->assertSame(
            collect([$this->slug(0), $this->slug(1)])->sort()->values()->all(),
            $baris,
            'Baris model_has_roles tidak membawa company_id kedua perusahaan - konteks team tidak tercatat.'
        );

        $this->assertSame(
            'tenant',
            config('database.default'),
            'Tenancy tidak aktif saat pembacaan central - test ini tidak membuktikan pemisahan koneksi.'
        );
    }

    /** User yang menjadi finance manager di perusahaan A dan staff di perusahaan B. */
    private function penggunaDuaPeran(): User
    {
        $sebelumnya = getPermissionsTeamId();
        setPermissionsTeamId(null);

        $approve = Permission::firstOrCreate(['name' => 'approve reimbursements']);
        $view = Permission::firstOrCreate(['name' => 'view reimbursements']);

        Role::firstOrCreate(['name' => 'finance manager'])->syncPermissions([$approve, $view]);
        Role::firstOrCreate(['name' => 'staff'])->syncPermissions([$view]);

        setPermissionsTeamId($sebelumnya);
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $pengguna = $this->member($this->slug(0), $this->slug(1));

        $this->giveRole($pengguna, $this->slug(0), 'finance manager');
        $this->giveRole($pengguna, $this->slug(1), 'staff');

        return $pengguna;
    }
}
