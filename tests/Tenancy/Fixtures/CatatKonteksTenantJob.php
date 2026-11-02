<?php

namespace Tests\Tenancy\Fixtures;

use App\Models\Client;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Job uji untuk QueueTenancyBootstrapper.
 *
 * Aplikasi belum punya job ShouldQueue sendiri (App\Jobs\MarkCompanyActive
 * dijalankan sinkron di dalam JobPipeline dengan shouldBeQueued(false)), jadi
 * konteks tenant di dalam queued job tidak bisa diuji tanpa job seperti ini.
 */
class CatatKonteksTenantJob implements ShouldQueue
{
    use Queueable;

    /**
     * Slug tenant yang aktif saat handle() berjalan - statis supaya terbaca
     * dari test walau job di-unserialize ulang oleh queue worker.
     */
    public static ?string $tenantSaatJalan = null;

    public static bool $pernahJalan = false;

    public function __construct(public string $namaKlien) {}

    public function handle(): void
    {
        self::$pernahJalan = true;
        self::$tenantSaatJalan = tenant()?->getTenantKey();

        if (tenant()) {
            Client::factory()->create(['name' => $this->namaKlien]);
        }
    }

    public static function lupakan(): void
    {
        self::$pernahJalan = false;
        self::$tenantSaatJalan = null;
    }
}
