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

    /**
     * GERBANG. Seluruh lampiran aplikasi ini lewat satu jalur yang sama:
     * Storage::disk('public')->url() - 19 titik di controller dan model, semuanya
     * membaca config filesystems.disks.public.url.
     *
     * Kalau URL yang dikirim ke frontend TIDAK ber-prefix /c/{slug}, browser
     * menembak /storage/... yang dilayani route `storage.local` BAWAAN Laravel 12:
     * disk `local`, root storage/app/private, visibility private, 'serve' => true.
     * Tanpa tanda tangan, ServeFile menjawab 403 (404 di produksi) - bukan 404
     * "berkas tidak ada", melainkan penolakan tanda tangan. Gejalanya menipu:
     * lampiran tetap tampil untuk perusahaan yang masih punya salinan lama di
     * storage central (dilayani symlink public/storage), dan hanya hilang untuk
     * perusahaan yang dibuat dari nol - yaitu perusahaan KEDUA dan seterusnya.
     *
     * Dua assertion, keduanya perlu: bentuk URL-nya benar, DAN URL itu benar-benar
     * bisa diambil. Bentuk yang benar saja tidak membuktikan berkasnya terjangkau.
     */
    public function test_url_lampiran_yang_dikirim_ke_frontend_ber_prefix_perusahaan(): void
    {
        $path = $this->unggahLampiranKe(0);
        $slug = $this->slug(0);

        // Harus PEMILIKNYA. data() sengaja menjawab 404 untuk reimbursement milik
        // orang lain (abort_unless user_id === auth id || canSeeAll) - memakai anggota
        // lain membuat test ini gagal karena otorisasi, bukan karena URL lampiran.
        $baris = $this->tenantConnection(0)->table('reimbursements')->first();
        $pengguna = User::findOrFail($baris->user_id);

        $url = $this->actingAs($pengguna)
            ->getJson("/c/{$slug}/reimbursements/{$baris->id}/data")
            ->assertOk()
            ->json('attachment_url');

        $this->assertNotNull($url, 'Endpoint tidak mengirim attachment_url sama sekali.');

        $this->assertStringContainsString(
            "/c/{$slug}/storage/",
            (string) $url,
            "attachment_url yang dikirim ke frontend adalah [{$url}] - tanpa prefix /c/{$slug}. "
            .'Browser akan menembak route storage.local (disk private, butuh tanda tangan) '
            .'dan menerima 403/404, bukan lampirannya. Yang menyetel URL ini adalah '
            .'SetCompanyUrlDefaults lewat config filesystems.disks.public.url.'
        );

        // Tutup lingkarannya: URL yang diberikan ke browser harus benar-benar bisa diambil.
        $this->actingAs($pengguna)
            ->get((string) parse_url((string) $url, PHP_URL_PATH))
            ->assertOk();

        $this->assertStringEndsWith($path, (string) $url, 'URL tidak menunjuk ke attachment_path yang tersimpan.');
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
