<?php

namespace Tests\Tenancy;

use App\Models\Client;
use App\Models\Invoice;
use PHPUnit\Framework\AssertionFailedError;
use RuntimeException;
use Stancl\Tenancy\Bootstrappers\DatabaseTenancyBootstrapper;
use Stancl\Tenancy\Bootstrappers\FilesystemTenancyBootstrapper;
use Stancl\Tenancy\Bootstrappers\QueueTenancyBootstrapper;
use Tests\TenancyTestCase;

/**
 * ==========================================================================
 * KONTROL POSITIF - test terpenting di seluruh suite ini.
 * ==========================================================================
 *
 * Suite besar yang hijau tidak membuktikan apa pun kalau penegakannya bisa
 * dimatikan satu baris tanpa satu test pun berubah warna. Itu BUKAN hipotesis:
 * `config(['tenancy.bootstrappers' => []])` di tests/TestCase.php sudah
 * melumpuhkan tenancy untuk ~560 test, dan semuanya tetap hijau.
 *
 * Berkas ini SENGAJA mematikan penegakan, lalu meng-assert bahwa klaim isolasi
 * benar-benar RUNTUH. Kalau test di sini mulai hijau "dengan cara yang salah" -
 * yaitu isolasi tetap terbukti padahal bootstrapper dikosongkan - maka 29 test
 * tenancy lainnya tidak lagi mengukur apa pun, dan itu harus terlihat di sini
 * lebih dulu.
 */
class KontrolPositifHarnessTest extends TenancyTestCase
{
    /**
     * Dengan bootstrapper dikosongkan, tenant() tetap tersetel tetapi koneksi
     * TIDAK berpindah - jadi invoice "tenant" mendarat di database central.
     * Assertion isolasi yang dipakai IsolasiAntarPerusahaanTest harus GAGAL
     * dalam kondisi ini.
     */
    public function test_klaim_isolasi_runtuh_ketika_bootstrapper_dikosongkan(): void
    {
        $this->endTenancy();

        // ---- penegakan DIMATIKAN, persis seperti di tests/TestCase.php ----
        config(['tenancy.bootstrappers' => []]);
        tenancy()->initialize($this->company(0));

        $this->assertNotNull(tenant(), 'tenancy()->initialize() tidak menyetel tenant() - skenario kontrol tidak terbentuk.');
        $this->assertSame(
            config('tenancy.database.central_connection'),
            config('database.default'),
            'Koneksi default berpindah padahal bootstrapper dikosongkan - kontrol positif tidak berlaku.'
        );

        $client = Client::factory()->create();
        Invoice::factory()->create([
            'invoice_number' => 'KONTROL/POSITIF/001',
            'billed_to_id' => $client->id,
        ]);

        $assertionGagal = false;

        try {
            // Assertion yang SAMA dengan IsolasiAntarPerusahaanTest.
            $this->assertSame(
                0,
                $this->centralConnection()->table('invoices')->where('invoice_number', 'KONTROL/POSITIF/001')->count(),
                'invoice tenant tertulis ke database central'
            );
        } catch (AssertionFailedError) {
            $assertionGagal = true;
        }

        $this->assertTrue(
            $assertionGagal,
            'KONTROL POSITIF RUSAK: dengan tenancy.bootstrappers dikosongkan, assertion isolasi TETAP lolos. '
            .'Artinya test-test isolasi di suite ini hijau tanpa benar-benar mengukur isolasi - '
            .'periksa apakah database tenant dan central sudah menyatu lagi.'
        );

        $this->assertSame(
            0,
            $this->tenantConnection(0)->table('invoices')->where('invoice_number', 'KONTROL/POSITIF/001')->count(),
            'Invoice justru masuk ke database tenant padahal bootstrapper dikosongkan.'
        );
    }

    /**
     * Gerbang harness: kelas di suite ini tidak boleh bisa berjalan dengan
     * tenancy dilumpuhkan - baik lewat config maupun lewat $realTenancy.
     */
    public function test_gerbang_harness_menolak_tenancy_yang_dilumpuhkan(): void
    {
        config(['tenancy.bootstrappers' => []]);

        try {
            $this->assertTenancyEnforced();
            $this->fail('Gerbang harness menerima config tanpa bootstrapper tenancy.');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('Bootstrapper tenancy hilang', $e->getMessage());
        }

        // Kembalikan config, lalu lumpuhkan lewat jalur yang kedua.
        config(['tenancy.bootstrappers' => [
            DatabaseTenancyBootstrapper::class,
            FilesystemTenancyBootstrapper::class,
            QueueTenancyBootstrapper::class,
        ]]);

        (function (): void {
            $this->realTenancy = false;
        })->call($this);

        try {
            $this->assertTenancyEnforced();
            $this->fail('Gerbang harness menerima kelas dengan $realTenancy = false.');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('realTenancy = false', $e->getMessage());
        } finally {
            (function (): void {
                $this->realTenancy = true;
            })->call($this);
        }
    }
}
