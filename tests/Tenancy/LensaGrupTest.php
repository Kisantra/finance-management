<?php

namespace Tests\Tenancy;

use App\Models\Client;
use Illuminate\Database\QueryException;
use RuntimeException;
use Tests\TenancyTestCase;

/**
 * Lensa grup = satu layar yang membaca beberapa perusahaan sekaligus, yaitu
 * perulangan `tenancy()->runForMultiple()`.
 *
 * Vendor stancl/tenancy memulihkan konteks SETELAH foreach, TANPA try/finally
 * (vendor/stancl/tenancy/src/Tenancy.php, runForMultiple()). Jadi exception apa
 * pun di tengah perulangan - satu query gagal, satu perusahaan belum
 * ter-migrasi - meninggalkan proses dalam konteks tenant TERAKHIR: koneksi
 * default masih menunjuk database perusahaan itu, dan setiap query berikutnya
 * di request yang sama (termasuk query "central") mengenai database yang salah.
 *
 * Kelas ini mengunci dua hal: perilaku bocornya memang nyata (bukan dugaan),
 * dan pola try/finally memang menutupnya. Pola itulah yang WAJIB dipakai saat
 * lensa grup benar-benar dibangun.
 */
class LensaGrupTest extends TenancyTestCase
{
    /**
     * Penjaga regresi ATAS VENDOR. Bila test ini mulai gagal, artinya vendor
     * sudah memperbaiki runForMultiple() - hapus pembungkus try/finally di
     * kode aplikasi dan hapus test ini.
     */
    public function test_runfor_multiple_mentah_meninggalkan_konteks_tenant_setelah_exception(): void
    {
        $central = config('tenancy.database.central_connection');

        try {
            tenancy()->runForMultiple([$this->slug(0), $this->slug(1)], function ($company): void {
                if ($company->getTenantKey() === $this->slug(1)) {
                    throw new RuntimeException('gagal di tengah perulangan');
                }
            });
            $this->fail('Exception di dalam perulangan tidak diteruskan ke pemanggil.');
        } catch (RuntimeException) {
            // Inilah bugnya: pemulihan konteks ditulis setelah foreach, jadi tidak pernah tercapai.
        }

        $this->assertTrue(
            tenancy()->initialized,
            'runForMultiple() sudah memulihkan konteks sendiri - vendor tampaknya sudah diperbaiki, '
            .'lihat docblock test ini.'
        );
        $this->assertSame($this->slug(1), tenant()->getTenantKey());
        $this->assertSame(
            'tenant',
            config('database.default'),
            'Koneksi default seharusnya masih tertinggal di tenant - vendor tampaknya sudah diperbaiki.'
        );
        $this->assertNotSame($central, config('database.default'));
    }

    /**
     * Pola yang WAJIB dipakai lensa grup: setelah exception di tengah
     * perulangan, tenant() kembali null DAN koneksi default kembali central.
     */
    public function test_pembungkus_try_finally_memulihkan_konteks_central(): void
    {
        $central = config('tenancy.database.central_connection');
        $dikunjungi = [];

        try {
            $this->lintasPerusahaanAman([$this->slug(0), $this->slug(1), $this->slug(2)], function ($company) use (&$dikunjungi): void {
                $dikunjungi[] = $company->getTenantKey();

                if ($company->getTenantKey() === $this->slug(1)) {
                    throw new RuntimeException('gagal di tengah perulangan');
                }
            });
            $this->fail('Exception di dalam perulangan tidak diteruskan ke pemanggil.');
        } catch (RuntimeException) {
        }

        $this->assertSame([$this->slug(0), $this->slug(1)], $dikunjungi, 'Perulangan tidak berhenti di perusahaan yang gagal.');
        $this->assertNull(tenant(), 'tenant() tidak null setelah lensa grup gagal - konteks perusahaan bocor keluar.');
        $this->assertFalse(tenancy()->initialized);
        $this->assertSame($central, config('database.default'), 'Koneksi default tidak kembali ke central.');
    }

    /**
     * Tulisan di dalam perulangan mendarat di database masing-masing perusahaan,
     * dan tulisan yang melanggar skema MELEMPAR (tidak diam-diam tertelan),
     * sebab itulah pemicu kebocoran konteks di test pertama.
     */
    public function test_tulisan_di_dalam_perulangan_terpisah_per_perusahaan(): void
    {
        $this->lintasPerusahaanAman([$this->slug(0), $this->slug(1)], function ($company): void {
            Client::factory()->create(['name' => 'Klien '.$company->getTenantKey()]);
        });

        $this->assertSame(
            1,
            $this->tenantConnection(0)->table('clients')->where('name', 'Klien '.$this->slug(0))->count()
        );
        $this->assertSame(
            0,
            $this->tenantConnection(0)->table('clients')->where('name', 'Klien '.$this->slug(1))->count(),
            'Klien perusahaan B mendarat di database perusahaan A - perulangan tidak menukar koneksi.'
        );
        $this->assertSame(
            1,
            $this->tenantConnection(1)->table('clients')->where('name', 'Klien '.$this->slug(1))->count()
        );

        $this->expectException(QueryException::class);

        $this->lintasPerusahaanAman([$this->slug(0)], function (): void {
            Client::query()->getConnection()->table('tabel_yang_tidak_ada')->insert(['x' => 1]);
        });
    }

    /**
     * Pembungkus aman untuk runForMultiple(): sama persis, kecuali pemulihan
     * konteks ada di `finally`.
     *
     * @param  list<string>  $slugs
     */
    private function lintasPerusahaanAman(array $slugs, callable $callback): void
    {
        $sebelumnya = tenant();

        try {
            foreach ($slugs as $slug) {
                tenancy()->initialize(tenancy()->find($slug));
                $callback(tenant());
            }
        } finally {
            if ($sebelumnya) {
                tenancy()->initialize($sebelumnya);
            } else {
                tenancy()->end();
            }
        }
    }
}
