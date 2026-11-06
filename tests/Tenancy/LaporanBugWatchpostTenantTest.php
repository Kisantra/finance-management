<?php

namespace Tests\Tenancy;

use App\Jobs\KirimLaporanBugKeWatchpost;
use App\Models\Feedback;
use App\Models\User;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TenancyTestCase;

/**
 * Laporan bug diteruskan ke Watchpost oleh worker antrean, yang tidak mewarisi
 * konteks web. Lampirannya ada di storage perusahaan pelapor; kalau tenancy
 * tidak dipulihkan di worker, job membaca storage pusat (berkas tidak ada) atau,
 * lebih buruk, berkas perusahaan lain dengan path yang sama. Di suite
 * Unit/Feature tenancy dimatikan, jadi hanya di sini hal itu terbukti.
 */
class LaporanBugWatchpostTenantTest extends TenancyTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        DB::connection('mysql')->table('jobs')->delete();
    }

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

    public function test_worker_mengunggah_lampiran_dari_storage_perusahaan_pelapor(): void
    {
        config([
            'watchpost.url' => 'https://watchpost.test',
            'watchpost.token' => 'wp_uji',
            'watchpost.environments' => ['testing'],
        ]);
        Http::fake(['watchpost.test/*' => Http::response(['ticket' => 12, 'number' => '#12', 'url' => 'https://watchpost.test/tickets/12'], 201)]);

        $pelapor = User::factory()->create();

        // Path sama di dua perusahaan, isi berbeda: hanya milik pelapor yang boleh terkirim.
        $this->useTenant(1);
        Storage::disk('public')->put('feedbacks/layar.png', 'bukti-perusahaan-lain');
        $this->useTenant(0);
        Storage::disk('public')->put('feedbacks/layar.png', 'bukti-perusahaan-pelapor');

        $feedback = Feedback::create([
            'user_id' => $pelapor->id,
            'company_id' => $this->slug(0),
            'title' => 'Saldo tidak sama dengan mutasi',
            'description' => 'Selisih Rp 250.000.',
            'type' => 'bug',
            'priority' => 'high',
            'status' => 'open',
            'attachment_path' => 'feedbacks/layar.png',
            'attachment_name' => 'layar.png',
        ]);

        KirimLaporanBugKeWatchpost::dispatch($feedback->id)->onConnection('database');

        // Worker tidak mewarisi konteks web: akhiri tenancy dulu, seperti di produksi.
        $this->endTenancy();
        Artisan::call('queue:work', ['connection' => 'database', '--once' => true]);

        $request = collect(Http::recorded())->map(fn ($pair) => $pair[0])
            ->first(fn (Request $request) => str_ends_with($request->url(), '/api/ingest/tickets'));

        $this->assertNotNull($request, 'Worker tidak mengirim laporan ke Watchpost.');
        $this->assertTrue(
            $request->hasFile('attachment', 'bukti-perusahaan-pelapor', 'layar.png'),
            'Lampiran yang terunggah bukan milik perusahaan pelapor - tenancy tidak dipulihkan di worker.'
        );
        $this->assertSame(
            '#12',
            $feedback->fresh()->watchpost_ticket_number,
            'Nomor tiket tidak tercatat di feedback (database pusat).'
        );
    }
}
