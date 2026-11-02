<?php

namespace Tests\Tenancy;

use App\Models\Company;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Console\Output\BufferedOutput;
use Tests\TenancyTestCase;

/**
 * `central:deploy-migrate` adalah satu-satunya jalan migrasi masuk produksi
 * multi-tenant. Bila canary gagal tetapi perintahnya tetap berjalan, produksi
 * berakhir SETENGAH TERMIGRASI: sebagian perusahaan memakai skema baru,
 * sebagian skema lama, dengan kode aplikasi yang sama untuk keduanya.
 *
 * Berbeda dari tests/Feature/CentralDeployMigrateCommandTest.php (yang
 * meng-assert database tenant TIDAK ada), di sini ada tiga tenant NYATA yang
 * benar-benar bisa dimigrasi.
 */
class DeployMigrateCanaryTest extends TenancyTestCase
{
    /**
     * Perintah ini memproses SEMUA company di tabel central. Perusahaan di luar
     * pool (mis. 'test-company' bikinan Tests\TestCase, yang tidak punya
     * database) dinonaktifkan dulu supaya yang diuji adalah perilaku canary,
     * bukan sisa fixture. Perubahan ini ikut di-rollback transaksi central.
     */
    protected function setUp(): void
    {
        parent::setUp();

        $pool = [$this->slug(0), $this->slug(1), $this->slug(2)];

        Company::withoutEvents(fn () => Company::query()
            ->whereNotIn('id', $pool)
            ->update(['status' => 'inactive']));
    }

    public function test_ketiga_tenant_aktif_termigrasi_dan_perintah_sukses(): void
    {
        [$kode, $keluaran] = $this->jalankanDeploy($this->slug(0));

        $this->assertSame(0, $kode, "central:deploy-migrate gagal padahal ketiga tenant sehat:\n".$keluaran);
        $this->assertStringContainsString('3 OK', $keluaran, "Laporan tidak menyebut 3 perusahaan OK:\n".$keluaran);
        $this->assertStringContainsString('0 FAILED', $keluaran, "Laporan menyebut ada kegagalan:\n".$keluaran);
    }

    /**
     * Canary gagal (databasenya tidak ada) harus MENGHENTIKAN seluruh deploy
     * sebelum satu pun tenant lain disentuh.
     */
    public function test_canary_gagal_menghentikan_deploy_sebelum_tenant_lain_disentuh(): void
    {
        $canary = $this->canaryTanpaDatabase();

        [$kode, $keluaran] = $this->jalankanDeploy($canary);

        $this->assertSame(1, $kode, "Canary gagal tetapi perintah melaporkan sukses:\n".$keluaran);
        $this->assertStringContainsString('berhenti total', $keluaran, "Perintah tidak berhenti total setelah canary gagal:\n".$keluaran);
        $this->assertStringContainsString('canary gagal', $keluaran, "Tenant lain tidak ditandai SKIPPED dengan alasan canary gagal:\n".$keluaran);
        $this->assertStringContainsString('0 OK', $keluaran, "Ada tenant yang tetap dimigrasi setelah canary gagal:\n".$keluaran);
        $this->assertStringContainsString('1 FAILED', $keluaran, "Canary tidak tercatat FAILED:\n".$keluaran);

        foreach ([$this->slug(0), $this->slug(1), $this->slug(2)] as $slug) {
            $this->assertMatchesRegularExpression(
                '/'.preg_quote($slug, '/').'\s*\|\s*SKIPPED/',
                $keluaran,
                "Tenant {$slug} tidak tercatat SKIPPED - deploy berpotensi menyentuhnya meski canary gagal."
            );
        }

        $this->assertStringNotContainsString(
            'tenants:migrate --tenants='.$this->slug(1),
            $keluaran,
            'Perintah sempat menjalankan tenants:migrate pada tenant lain setelah canary gagal.'
        );
    }

    /**
     * Canary yang statusnya bukan `active` ditolak SEBELUM migrasi apa pun -
     * tanpa penjagaan ini operator bisa menunjuk perusahaan setengah jadi
     * sebagai canary dan menganggap deploy aman karena "canary sukses".
     */
    public function test_canary_yang_tidak_aktif_ditolak_sebelum_migrasi_dimulai(): void
    {
        $canary = $this->canaryTanpaDatabase();
        Company::withoutEvents(fn () => Company::where('id', $canary)->update(['status' => 'failed']));

        [$kode, $keluaran] = $this->jalankanDeploy($canary);

        $this->assertSame(1, $kode, "Canary berstatus failed diterima sebagai canary:\n".$keluaran);
        $this->assertStringContainsString('canary harus company aktif', $keluaran);
        $this->assertStringNotContainsString('tenants:migrate', $keluaran, 'Perintah sudah mulai memigrasi padahal canary ditolak.');

        [$kodeSlugTidakAda, $keluaranSlugTidakAda] = $this->jalankanDeploy('perusahaan-tidak-terdaftar');

        $this->assertSame(1, $kodeSlugTidakAda, 'Slug canary yang tidak terdaftar tidak ditolak.');
        $this->assertStringContainsString('tidak terdaftar sebagai company', $keluaranSlugTidakAda);
    }

    /**
     * Artisan::output() tidak dapat dipakai di sini: perintahnya memanggil
     * Artisan::call('tenants:migrate', ...) di dalam dirinya, dan panggilan
     * bersarang itu menimpa buffer output terakhir milik kernel.
     *
     * @return array{0: int, 1: string}
     */
    private function jalankanDeploy(string $canary): array
    {
        $buffer = new BufferedOutput;

        $kode = Artisan::call('central:deploy-migrate', [
            '--skip-central' => true,
            '--canary' => $canary,
            '--force' => true,
        ], $buffer);

        return [$kode, $buffer->fetch()];
    }

    /** Company aktif tanpa database - memaksa migrateTenant() gagal tanpa merusak pool. */
    private function canaryTanpaDatabase(): string
    {
        $slug = 'canary-'.bin2hex(random_bytes(2));

        DB::connection('mysql')->table('companies')->insert([
            'id' => $slug,
            'organization_id' => DB::connection('mysql')->table('organizations')->value('id'),
            'name' => 'Canary Tanpa DB',
            'abbreviation' => 'CNR',
            'status' => 'active',
            'data' => '{}',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $slug;
    }
}
