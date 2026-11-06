<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Tests\TestCase;

/**
 * Integrasi package kisantra/watchpost-laravel dengan aplikasi ini: pelaporan error
 * lewat exception handler (bootstrap/app.php), rute central /watchpost/* yang tidak
 * boleh tertelan Route::fallback, dan skrip browser di halaman.
 */
class WatchpostTest extends TestCase
{
    use RefreshDatabase;

    private function aktifkanWatchpost(): void
    {
        config([
            'watchpost.url' => 'https://watchpost.test',
            'watchpost.token' => 'wp_uji',
            'watchpost.environments' => ['testing'],
        ]);
    }

    public function test_tanpa_url_dan_token_tidak_ada_yang_dikirim_maupun_disisipkan(): void
    {
        Http::fake();
        $this->withoutVite();

        report(new RuntimeException('Tidak boleh terkirim'));

        Http::assertNothingSent();
        $this->get('/login')
            ->assertOk()
            ->assertDontSee('/watchpost/browser.js', false);
    }

    public function test_error_yang_dilaporkan_aplikasi_dikirim_ke_watchpost(): void
    {
        $this->aktifkanWatchpost();
        Http::fake(['watchpost.test/*' => Http::response(null, 202)]);

        report(new RuntimeException('Saldo rekening gagal dihitung'));

        Http::assertSent(fn (Request $request) => $request->url() === 'https://watchpost.test/api/ingest/errors'
            && $request->hasHeader('Authorization', 'Bearer wp_uji')
            && $request['exception'] === RuntimeException::class
            && $request['message'] === 'Saldo rekening gagal dihitung');
    }

    public function test_skrip_browser_disisipkan_ke_halaman_saat_aktif(): void
    {
        $this->aktifkanWatchpost();
        $this->withoutVite();

        $this->get('/login')
            ->assertOk()
            ->assertSee('<script defer src="/watchpost/browser.js?v=', false)
            ->assertSee('data-endpoint="/watchpost/client"', false);
    }

    public function test_skrip_browser_dilayani_di_luar_konteks_perusahaan(): void
    {
        $this->get('/watchpost/browser.js')
            ->assertOk()
            ->assertHeader('Content-Type', 'application/javascript; charset=UTF-8');
    }
}
