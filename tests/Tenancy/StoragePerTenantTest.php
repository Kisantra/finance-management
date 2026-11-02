<?php

namespace Tests\Tenancy;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Tests\TenancyTestCase;

/**
 * Bukti reimbursement adalah lampiran yang dipakai menyetujui pengeluaran uang.
 * Kalau lampiran satu perusahaan dapat diambil dari konteks perusahaan lain,
 * bukti keuangan bocor - dan tidak ada satu pun test di suite Unit/Feature yang
 * bisa menangkapnya karena di sana FilesystemTenancyBootstrapper tidak berjalan.
 *
 * Catatan: Storage::fake() TIDAK dipakai di sini - ia justru mengganti disk yang
 * sedang diuji. Berkas yang terbentuk dibersihkan di tearDown().
 */
class StoragePerTenantTest extends TenancyTestCase
{
    private const SANDI = 'rahasia-lampiran';

    protected function tearDown(): void
    {
        foreach ([0, 1] as $i) {
            // storage_path() bisa sedang ter-suffix oleh tenancy; pakai base_path.
            $folder = base_path('storage/tenant'.$this->slug($i));

            if (File::isDirectory($folder)) {
                File::deleteDirectory($folder);
            }
        }

        parent::tearDown();
    }

    public function test_lampiran_mendarat_di_folder_storage_perusahaan_itu(): void
    {
        $path = $this->unggahLampiranKe(0);

        $this->assertFileExists(
            base_path('storage/tenant'.$this->slug(0).'/app/public/'.$path),
            'Lampiran tidak berada di storage/tenant'.$this->slug(0).'/app/public - '
            .'FilesystemTenancyBootstrapper tidak memindahkan root disk public.'
        );

        $this->assertFileDoesNotExist(
            base_path('storage/app/public/'.$path),
            'Lampiran justru tertulis ke storage global (storage/app/public) - semua perusahaan berbagi satu folder.'
        );
    }

    public function test_storage_path_ikut_ber_suffix_saat_tenancy_aktif(): void
    {
        $sebelum = storage_path('app/public');

        $this->useTenant(0);
        $saatAktif = storage_path('app/public');

        $this->endTenancy();
        $setelah = storage_path('app/public');

        $this->assertStringContainsString('tenant'.$this->slug(0), $saatAktif, 'storage_path() tidak ber-suffix tenant.');
        $this->assertSame($sebelum, $setelah, 'storage_path() tidak kembali ke nilai central setelah tenancy berakhir.');
    }

    public function test_disk_public_tidak_melihat_lampiran_perusahaan_lain(): void
    {
        $path = $this->unggahLampiranKe(0);

        $this->useTenant(0);
        $this->assertTrue(
            Storage::disk('public')->exists($path),
            'Disk public tidak menemukan lampirannya sendiri di konteks pemiliknya.'
        );

        $this->useTenant(1);
        $this->assertFalse(
            Storage::disk('public')->exists($path),
            'Disk public di konteks perusahaan B menemukan lampiran milik perusahaan A.'
        );
    }

    public function test_url_storage_perusahaan_lain_mengembalikan_404(): void
    {
        $path = $this->unggahLampiranKe(0);

        $pengguna = $this->member($this->slug(0), $this->slug(1));
        $this->berikanIzinReimbursement($pengguna);

        $this->actingAs($pengguna)
            ->get('/c/'.$this->slug(0).'/storage/'.$path)
            ->assertOk();

        $this->actingAs($pengguna)
            ->get('/c/'.$this->slug(1).'/storage/'.$path)
            ->assertNotFound();
    }

    /** Unggah lampiran lewat jalur HTTP sungguhan; mengembalikan attachment_path-nya. */
    private function unggahLampiranKe(int $i): string
    {
        $slug = $this->slug($i);
        $pengguna = $this->member($slug);
        $this->berikanIzinReimbursement($pengguna);

        $this->actingAs($pengguna)
            ->post('/c/'.$slug.'/reimbursements', [
                'title' => 'Bukti '.self::SANDI,
                'amount' => 150000,
                'expense_date' => '2026-01-15',
                'category' => 'transport',
                'action' => 'draft',
                'attachment' => UploadedFile::fake()->image('bukti.jpg'),
            ])
            ->assertRedirect();

        $path = $this->tenantConnection($i)->table('reimbursements')->value('attachment_path');

        $this->assertNotNull($path, 'Reimbursement tersimpan tanpa attachment_path - unggahan tidak terjadi.');

        return (string) $path;
    }

    private function berikanIzinReimbursement(User $pengguna): void
    {
        $sebelumnya = getPermissionsTeamId();
        setPermissionsTeamId(null);

        $role = Role::firstOrCreate(['name' => 'staff']);
        foreach (['view reimbursements', 'create reimbursements'] as $izin) {
            $role->givePermissionTo(Permission::firstOrCreate(['name' => $izin]));
        }

        setPermissionsTeamId($sebelumnya);

        foreach ($pengguna->companies()->pluck('companies.id') as $slug) {
            $this->giveRole($pengguna, (string) $slug, 'staff');
        }
    }
}
