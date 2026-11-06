<?php

namespace Tests\Feature;

use App\Http\Middleware\EnsureUserBelongsToCompany;
use App\Http\Middleware\SetCompanyUrlDefaults;
use App\Http\Middleware\SetPermissionsTeam;
use App\Jobs\KirimLaporanBugKeWatchpost;
use App\Models\Feedback;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use RuntimeException;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Stancl\Tenancy\Middleware\InitializeTenancyByPath;
use Tests\TestCase;

/**
 * Laporan bug pengguna diteruskan ke Watchpost (tiket tim IT) lewat antrean,
 * membawa konteks yang dicatat saat dikirim: halaman lengkap, jejak langkah,
 * browser, serta trace & kode ERR dari halaman error.
 */
class FeedbackWatchpostTest extends TestCase
{
    use RefreshDatabase;

    private const TRACE = '0b6f7e2a-6c1d-4f3e-9a51-3d2b8c7e1f40';

    private const RECEIPT = ['ticket' => 12, 'number' => '#12', 'url' => 'https://watchpost.test/tickets/12', 'linked_to_error' => true];

    private User $staff;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        foreach (['view feedbacks', 'create feedbacks', 'manage feedbacks'] as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
        }

        Role::firstOrCreate(['name' => 'admin'])->syncPermissions(['view feedbacks', 'create feedbacks', 'manage feedbacks']);
        Role::firstOrCreate(['name' => 'finance manager']);
        Role::firstOrCreate(['name' => 'staff'])->syncPermissions(['view feedbacks', 'create feedbacks']);

        $this->staff = User::factory()->create(['name' => 'Budi Santoso', 'email' => 'budi@contoh.test']);
        $this->staff->assignRole('staff');
    }

    private function aktifkanWatchpost(): void
    {
        config([
            'watchpost.url' => 'https://watchpost.test',
            'watchpost.token' => 'wp_uji',
            'watchpost.environments' => ['testing'],
        ]);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function laporanBug(array $attributes = []): Feedback
    {
        return Feedback::create([
            'user_id' => $this->staff->id,
            'company_id' => 'test-company',
            'title' => 'Tombol simpan invoice tidak merespons',
            'description' => 'Klik Simpan & terbitkan, tidak terjadi apa-apa.',
            'type' => 'bug',
            'priority' => 'medium',
            'status' => 'open',
            'page_url' => '/c/test-company/invoices?month=2026-11#invoice/12',
            ...$attributes,
        ]);
    }

    private function terkirim(): ?Request
    {
        return collect(Http::recorded())->map(fn ($pair) => $pair[0])
            ->first(fn (Request $request) => str_ends_with($request->url(), '/api/ingest/tickets'));
    }

    public function test_laporan_bug_menyimpan_konteksnya_lalu_diantrekan_ke_watchpost(): void
    {
        Queue::fake();

        $this->actingAs($this->staff)
            ->withHeader('User-Agent', 'Mozilla/5.0 Chrome/141.0')
            ->post('/feedbacks', [
                'title' => 'Tombol simpan invoice tidak merespons',
                'description' => 'Klik Simpan, tidak terjadi apa-apa.',
                'type' => 'bug',
                'priority' => 'high',
                'page_url' => '/c/test-company/invoices?month=2026-11#invoice/12',
                'breadcrumbs' => [
                    ['type' => 'page', 'label' => '/c/test-company/invoices', 'at' => '2026-11-06T09:00:00+08:00'],
                    ['type' => 'click', 'label' => 'Simpan & terbitkan', 'at' => '2026-11-06T09:00:05+08:00'],
                ],
            ])
            ->assertRedirect();

        $feedback = Feedback::sole();

        $this->assertSame('/c/test-company/invoices?month=2026-11#invoice/12', $feedback->page_url);
        $this->assertCount(2, $feedback->breadcrumbs);
        $this->assertSame('Mozilla/5.0 Chrome/141.0', $feedback->user_agent);
        Queue::assertPushed(KirimLaporanBugKeWatchpost::class, fn (KirimLaporanBugKeWatchpost $job) => $job->feedbackId === $feedback->id);
    }

    public function test_fitur_dan_saran_tetap_di_aplikasi(): void
    {
        Queue::fake();

        foreach (['feature', 'feedback'] as $type) {
            $this->actingAs($this->staff)->post('/feedbacks', [
                'title' => 'Ekspor ke Excel',
                'description' => 'Tolong tambahkan ekspor.',
                'type' => $type,
                'priority' => 'low',
            ])->assertRedirect();
        }

        $this->assertSame(2, Feedback::count());
        Queue::assertNothingPushed();
    }

    public function test_konteks_yang_tidak_masuk_akal_ditolak(): void
    {
        $this->actingAs($this->staff)
            ->postJson('/feedbacks', [
                'title' => 'Error',
                'description' => 'Muncul error.',
                'type' => 'bug',
                'priority' => 'high',
                'trace_id' => 'bukan-uuid',
                'error_id' => 'ERR-kecil',
                'breadcrumbs' => [['type' => 'scroll', 'label' => 'x', 'at' => 'kemarin']],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['trace_id', 'error_id', 'breadcrumbs.0.type', 'breadcrumbs.0.at']);
    }

    public function test_job_mengirim_laporan_lengkap_dan_menyimpan_tiketnya(): void
    {
        $this->aktifkanWatchpost();
        Http::fake(['watchpost.test/*' => Http::response(self::RECEIPT, 201)]);

        $feedback = $this->laporanBug([
            'trace_id' => self::TRACE,
            'error_id' => 'ERR-AB12CD34EF',
            'breadcrumbs' => [['type' => 'page', 'label' => '/c/test-company/invoices', 'at' => '2026-11-06T09:00:00+08:00']],
            'user_agent' => 'Mozilla/5.0 Chrome/141.0',
        ]);

        KirimLaporanBugKeWatchpost::dispatchSync($feedback->id);

        $request = $this->terkirim();
        $this->assertNotNull($request, 'Laporan tidak terkirim ke Watchpost.');
        $this->assertTrue($request->hasHeader('Authorization', 'Bearer wp_uji'));
        $this->assertSame('feedback-'.$feedback->id, $request['reference']);
        $this->assertSame('normal', $request['priority'], 'Prioritas "Sedang" Finance = "normal" di Watchpost.');
        $this->assertSame(['name' => 'Budi Santoso', 'email' => 'budi@contoh.test'], $request['reporter']);
        $this->assertSame('Test Company (test-company)', $request['company']);
        $this->assertSame('/c/test-company/invoices?month=2026-11#invoice/12', $request['page_url']);
        $this->assertSame(self::TRACE, $request['trace_id']);
        $this->assertSame('ERR-AB12CD34EF', $request['error_id']);
        $this->assertSame(config('app.name'), $request['source']['app']);

        $feedback->refresh();
        $this->assertSame(12, $feedback->watchpost_ticket_id);
        $this->assertSame('#12', $feedback->watchpost_ticket_number);
        $this->assertSame('https://watchpost.test/tickets/12', $feedback->watchpost_ticket_url);
    }

    public function test_prioritas_kritis_menjadi_mendesak_di_watchpost(): void
    {
        $this->aktifkanWatchpost();
        Http::fake(['watchpost.test/*' => Http::response(self::RECEIPT, 201)]);

        KirimLaporanBugKeWatchpost::dispatchSync($this->laporanBug(['priority' => 'critical'])->id);

        $this->assertSame('urgent', $this->terkirim()['priority']);
    }

    public function test_lampiran_ikut_terunggah(): void
    {
        $this->aktifkanWatchpost();
        Http::fake(['watchpost.test/*' => Http::response(self::RECEIPT, 201)]);
        Storage::fake('public');
        Storage::disk('public')->put('feedbacks/layar.png', 'isi-gambar');

        KirimLaporanBugKeWatchpost::dispatchSync($this->laporanBug([
            'attachment_path' => 'feedbacks/layar.png',
            'attachment_name' => 'tangkapan-layar.png',
        ])->id);

        $request = $this->terkirim();
        $this->assertTrue($request->isMultipart());
        $this->assertTrue($request->hasFile('attachment', 'isi-gambar', 'tangkapan-layar.png'));
    }

    public function test_watchpost_yang_gagal_dicoba_lagi_nanti_tanpa_menyentuh_feedback(): void
    {
        $this->aktifkanWatchpost();
        Http::fake(['watchpost.test/*' => Http::response(['message' => 'Server error'], 500)]);
        $feedback = $this->laporanBug();

        $job = (new KirimLaporanBugKeWatchpost($feedback->id))->withFakeQueueInteractions();
        $job->handle();

        $job->assertReleased(60);
        $this->assertNull($feedback->fresh()->watchpost_ticket_id);
    }

    public function test_laporan_yang_sudah_punya_tiket_tidak_dikirim_lagi(): void
    {
        $this->aktifkanWatchpost();
        Http::fake();

        KirimLaporanBugKeWatchpost::dispatchSync($this->laporanBug(['watchpost_ticket_id' => 12, 'watchpost_ticket_number' => '#12'])->id);

        Http::assertNothingSent();
    }

    public function test_tanpa_watchpost_di_environment_ini_tidak_ada_yang_dikirim(): void
    {
        Http::fake();

        KirimLaporanBugKeWatchpost::dispatchSync($this->laporanBug()->id);

        Http::assertNothingSent();
    }

    public function test_pengelola_melihat_tautan_tiket_watchpost_staff_tidak(): void
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');
        $feedback = $this->laporanBug(['watchpost_ticket_id' => 12, 'watchpost_ticket_number' => '#12', 'watchpost_ticket_url' => 'https://watchpost.test/tickets/12']);

        $this->actingAs($admin)->get('/feedbacks?show='.$feedback->id)
            ->assertInertia(fn (Assert $page) => $page->where('showFeedback.watchpost', ['number' => '#12', 'url' => 'https://watchpost.test/tickets/12']));

        $this->actingAs($this->staff)->get('/feedbacks?show='.$feedback->id)
            ->assertInertia(fn (Assert $page) => $page->where('showFeedback.watchpost', null));
    }

    public function test_halaman_error_membawa_trace_dan_error_watchpost_membawa_kode_yang_sama(): void
    {
        config(['app.debug' => false]);
        $this->aktifkanWatchpost();
        // Skrip browser menulis ulang HTML (setContent), dan viewData() butuh view aslinya.
        // Trace tetap dipasang: middleware memasangnya sebelum memeriksa saklar ini.
        config(['watchpost.browser.enabled' => false]);
        Http::fake(['watchpost.test/*' => Http::response(['group' => 1, 'status' => 'open'], 202)]);

        Route::middleware([
            'web', 'auth', 'verified',
            InitializeTenancyByPath::class,
            EnsureUserBelongsToCompany::class,
            SetPermissionsTeam::class,
            SetCompanyUrlDefaults::class,
        ])->prefix('c/{company}')->get('/_uji/watchpost-meledak', fn () => throw new RuntimeException('Gagal menghitung saldo'));

        $response = $this->actingAs($this->staff)
            ->withHeader('X-Watchpost-Trace', self::TRACE)
            ->get('/_uji/watchpost-meledak')
            ->assertStatus(500);

        $report = $response->viewData('page')['props']['report'];
        $this->assertSame(self::TRACE, $report['trace_id'], 'Tombol "Laporkan ke Tim IT" perlu trace ini agar laporan menempel ke tiket error-nya.');

        $error = collect(Http::recorded())->map(fn ($pair) => $pair[0])
            ->first(fn (Request $request) => str_ends_with($request->url(), '/api/ingest/errors'));
        $this->assertNotNull($error, 'Error tidak terkirim ke Watchpost.');
        $this->assertSame(['error_id' => $report['id'], 'company' => 'test-company'], $error['context']);
    }
}
