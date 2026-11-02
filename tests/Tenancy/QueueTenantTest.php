<?php

namespace Tests\Tenancy;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\Tenancy\Fixtures\CatatKonteksTenantJob;
use Tests\TenancyTestCase;

/**
 * QueueTenancyBootstrapper menyelipkan `tenant_id` ke payload job saat job
 * di-dispatch dari konteks tenant, lalu meng-inisialisasi tenancy kembali di
 * sisi worker. Tanpa itu, job yang berjalan beberapa detik kemudian menulis ke
 * database CENTRAL - di suite Unit/Feature kesalahan itu tidak terlihat karena
 * di sana central dan tenant memang satu database.
 *
 * Job diproses lewat koneksi queue `database` + `queue:work --once`, bukan
 * driver `sync`: pada `sync` tenancy memang belum pernah berpindah, jadi
 * test-nya hijau tanpa membuktikan apa pun.
 */
class QueueTenantTest extends TenancyTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        CatatKonteksTenantJob::lupakan();
        DB::connection('mysql')->table('jobs')->delete();
    }

    public function test_job_dari_konteks_tenant_berjalan_terhadap_database_tenant_itu(): void
    {
        $this->useTenant(0);

        CatatKonteksTenantJob::dispatch('Klien Dari Queue')->onConnection('database');

        $payload = json_decode((string) DB::connection('mysql')->table('jobs')->value('payload'), true);

        $this->assertSame(
            $this->slug(0),
            $payload['tenant_id'] ?? null,
            'Payload job tidak membawa tenant_id - QueueTenancyBootstrapper tidak memasang payload generator.'
        );

        // Worker tidak mewarisi konteks web: akhiri tenancy dulu, seperti di produksi.
        $this->endTenancy();

        Artisan::call('queue:work', ['connection' => 'database', '--once' => true]);

        $this->assertTrue(CatatKonteksTenantJob::$pernahJalan, 'Job tidak pernah diproses worker.');
        $this->assertSame(
            $this->slug(0),
            CatatKonteksTenantJob::$tenantSaatJalan,
            'Job berjalan tanpa konteks tenant asalnya - tulisannya akan mendarat di database central.'
        );

        $this->assertSame(
            1,
            $this->tenantConnection(0)->table('clients')->where('name', 'Klien Dari Queue')->count(),
            'Klien hasil job tidak ada di database tenant asal job.'
        );
        $this->assertSame(
            0,
            $this->tenantConnection(1)->table('clients')->where('name', 'Klien Dari Queue')->count(),
            'Klien hasil job bocor ke database tenant lain.'
        );
    }

    public function test_job_dari_konteks_central_tetap_central_dan_tenancy_dipulihkan(): void
    {
        $this->endTenancy();

        CatatKonteksTenantJob::dispatch('Klien Central')->onConnection('database');

        $payload = json_decode((string) DB::connection('mysql')->table('jobs')->value('payload'), true);

        $this->assertArrayNotHasKey(
            'tenant_id',
            $payload,
            'Job yang di-dispatch dari konteks central ikut membawa tenant_id.'
        );

        Artisan::call('queue:work', ['connection' => 'database', '--once' => true]);

        $this->assertTrue(CatatKonteksTenantJob::$pernahJalan, 'Job tidak pernah diproses worker.');
        $this->assertNull(
            CatatKonteksTenantJob::$tenantSaatJalan,
            'Job central berjalan dengan tenancy aktif - konteks tenant bocor ke job yang bukan milik tenant.'
        );
        $this->assertFalse(tenancy()->initialized, 'Worker meninggalkan tenancy terinisialisasi setelah job selesai.');
    }
}
