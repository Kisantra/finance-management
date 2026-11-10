<?php

namespace Tests\Feature;

use App\Http\Middleware\SetDocumentLocale;
use App\Http\Middleware\SetLocale;
use App\Models\User;
use Carbon\Carbon;
use Carbon\CarbonInterval;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Route;
use Inertia\Testing\AssertableInertia as Assert;
use RuntimeException;
use Tests\TestCase;

/**
 * Infrastruktur multi bahasa (id/en/zh): satu penentu bahasa (SetLocale), POST /language (muat ulang
 * penuh, tersimpan per pengguna, pilihan tamu dibawa saat masuk), Carbon ikut bahasa, dokumen selalu
 * Bahasa Indonesia (locale.dokumen + withDocumentLocale). Konvensi: CLAUDE.md › "Multi Bahasa".
 */
class MultiBahasaTest extends TestCase
{
    use RefreshDatabase;

    /** Rute dokumen (PDF/Excel/pratinjau PDF): WAJIB bermiddleware locale.dokumen. */
    private const RUTE_DOKUMEN = [
        'template-builder-test.pdf',
        'invoices.export.excel',
        'invoices.export.pdf',
        'invoices.preview',
        'invoice.download',
        'invoice.preview',
        'bank-account.export.pdf',
        'bank-account.export.pdf.preview',
        'cash-flow.all.export',
        'cash-flow.export.pdf',
        'cash-flow.export.pdf.preview',
        'fund-requests.export.pdf',
        'fund-requests.export.pdf.preview',
        'reports.profit-loss.pdf',
        'settings.pdf-templates.pdf',
        'settings.pdf-templates.pdf.invoice',
    ];

    protected function tearDown(): void
    {
        App::setLocale('id');

        parent::tearDown();
    }

    public function test_en_tersedia_sebagai_bahasa_pilihan(): void
    {
        $this->assertSame(['id', 'en', 'zh'], config('app.available_locales'));
    }

    public function test_preferensi_pengguna_menang_atas_sesi_basi(): void
    {
        $user = User::factory()->create(['locale' => 'en']);

        $this->actingAs($user)
            ->withSession([SetLocale::SESSION_KEY => 'zh'])
            ->get('/panduan')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('guide/index', false)->where('locale', 'en'))
            ->assertSessionHas(SetLocale::SESSION_KEY, 'en');

        $this->assertSame('en', App::getLocale());
    }

    public function test_preferensi_tersimpan_dipakai_di_sesi_baru(): void
    {
        $user = User::factory()->create(['locale' => 'zh']);

        $this->actingAs($user)
            ->get('/panduan')
            ->assertInertia(fn (Assert $page) => $page->where('locale', 'zh'));
    }

    public function test_tamu_memakai_bahasa_sesi(): void
    {
        $this->withSession([SetLocale::SESSION_KEY => 'zh'])
            ->get('/login')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('auth/login', false)->where('locale', 'zh'));
    }

    public function test_tamu_tanpa_pilihan_memakai_bahasa_indonesia(): void
    {
        $this->get('/login')->assertInertia(fn (Assert $page) => $page->where('locale', 'id'));
    }

    public function test_bahasa_tidak_dikenal_diabaikan(): void
    {
        $user = User::factory()->create(['locale' => 'fr']);

        $this->actingAs($user)
            ->withSession([SetLocale::SESSION_KEY => 'de'])
            ->get('/panduan')
            ->assertInertia(fn (Assert $page) => $page->where('locale', 'id'));
    }

    public function test_ganti_bahasa_menyimpan_preferensi_pengguna_dan_memuat_ulang_penuh(): void
    {
        $user = User::factory()->create(['locale' => 'id']);

        $this->actingAs($user)
            ->from('/panduan')
            ->post('/language', ['locale' => 'en'], ['X-Inertia' => 'true'])
            ->assertStatus(409)
            ->assertHeader('X-Inertia-Location', url('/panduan'))
            ->assertSessionHas(SetLocale::SESSION_KEY, 'en')
            ->assertSessionMissing(SetLocale::EXPLICIT_KEY);

        $this->assertSame('en', $user->fresh()->locale);
    }

    public function test_kunjungan_inertia_setelah_bahasa_berubah_dimuat_ulang_penuh(): void
    {
        $user = User::factory()->create(['locale' => 'zh']);
        $inertia = fn (string $versi): array => ['X-Inertia' => 'true', 'X-Inertia-Version' => $versi];

        // Versi halaman memuat bahasa: versi dari halaman berbahasa lain → 409 + muat ulang penuh (masuk/keluar,
        // atau bahasa diganti di tab lain), sehingga kamus bahasa baru dimuat sebelum render.
        $versiZh = $this->actingAs($user)->get('/panduan', $inertia('versi-lama'))
            ->assertStatus(409)
            ->assertHeader('X-Inertia-Location')
            ->headers->get('X-Inertia-Version');
        $this->assertStringEndsWith('|zh', $versiZh);

        $this->actingAs($user)->get('/panduan', $inertia($versiZh))->assertOk();

        $user->forceFill(['locale' => 'en'])->save();
        $this->actingAs($user->fresh())->get('/panduan', $inertia($versiZh))->assertStatus(409);
    }

    public function test_ganti_bahasa_tanpa_inertia_dialihkan_kembali(): void
    {
        $user = User::factory()->create(['locale' => 'id']);

        $this->actingAs($user)
            ->from('/panduan')
            ->post('/language', ['locale' => 'zh'])
            ->assertRedirect('/panduan');

        $this->assertSame('zh', $user->fresh()->locale);
    }

    public function test_ganti_bahasa_menolak_bahasa_tidak_dikenal(): void
    {
        $user = User::factory()->create(['locale' => 'id']);

        $this->actingAs($user)
            ->from('/panduan')
            ->post('/language', ['locale' => 'fr'])
            ->assertSessionHasErrors('locale');

        $this->assertSame('id', $user->fresh()->locale);
    }

    public function test_ganti_bahasa_tidak_mengikuti_referer_situs_lain(): void
    {
        $this->withHeader('referer', 'https://contoh-jahat.test/curi')
            ->post('/language', ['locale' => 'en'], ['X-Inertia' => 'true'])
            ->assertStatus(409)
            ->assertHeader('X-Inertia-Location', url('/'));
    }

    public function test_pilihan_bahasa_tamu_dibawa_ke_akun_saat_masuk(): void
    {
        $user = User::factory()->create(['locale' => 'id']);

        $this->from('/login')->post('/language', ['locale' => 'zh'])->assertRedirect('/login');
        $this->assertTrue(session(SetLocale::EXPLICIT_KEY));

        $this->post('/login', ['email' => $user->email, 'password' => 'password'])->assertRedirect();

        $this->assertAuthenticatedAs($user);
        $this->assertSame('zh', $user->fresh()->locale);
        $this->assertNull(session(SetLocale::EXPLICIT_KEY));
    }

    public function test_masuk_tanpa_memilih_bahasa_tidak_menimpa_preferensi(): void
    {
        $user = User::factory()->create(['locale' => 'en']);

        // Halaman masuk ditampilkan dalam bahasa bawaan (sesi berisi 'id'), tetapi itu bukan pilihan eksplisit.
        $this->get('/login')->assertInertia(fn (Assert $page) => $page->where('locale', 'id'));
        $this->post('/login', ['email' => $user->email, 'password' => 'password'])->assertRedirect();

        $this->assertSame('en', $user->fresh()->locale);
    }

    public function test_carbon_ikut_bahasa_tampilan(): void
    {
        $user = User::factory()->create(['locale' => 'zh']);

        $this->actingAs($user)->get('/panduan')->assertOk();

        $this->assertSame('zh', Carbon::getLocale());
        $this->assertSame('八月', Carbon::create(2026, 8, 1)->translatedFormat('F'));
        // Aksara sederhana (分钟), bukan tradisional (分鐘).
        $this->assertStringContainsString('分钟', CarbonInterval::minutes(5)->forHumans());

        $this->actingAs($user->fresh()->forceFill(['locale' => 'en']))->get('/panduan');
        $this->assertSame('August', Carbon::create(2026, 8, 1)->translatedFormat('F'));
    }

    public function test_rute_dokumen_selalu_bahasa_indonesia(): void
    {
        // Rute uji di bawah /c/{company} karena TestCase memberi prefix perusahaan pada URI non-central.
        Route::middleware(['web', 'locale.dokumen'])->get(
            '/c/{company}/_uji/dokumen',
            fn () => App::getLocale().'|'.Carbon::getLocale().'|'.Carbon::create(2026, 8, 1)->translatedFormat('F')
                .'|'.request()->attributes->get(SetDocumentLocale::DISPLAY_LOCALE_ATTRIBUTE),
        );
        $user = User::factory()->create(['locale' => 'zh']);

        $this->actingAs($user)
            ->get('/_uji/dokumen')
            ->assertOk()
            ->assertSeeText('id|id|Agustus|zh');

        // Sesudah request dokumen, bahasa tampilan dipulihkan.
        $this->assertSame('zh', App::getLocale());
    }

    public function test_semua_rute_dokumen_memakai_locale_dokumen(): void
    {
        $tanpa = [];
        foreach (self::RUTE_DOKUMEN as $nama) {
            $rute = Route::getRoutes()->getByName($nama);
            $this->assertNotNull($rute, "Rute dokumen {$nama} tidak ditemukan");
            if (! in_array('locale.dokumen', $rute->gatherMiddleware(), true)) {
                $tanpa[] = $nama;
            }
        }

        $this->assertSame([], $tanpa, 'Rute dokumen tanpa middleware locale.dokumen (PDF/Excel akan ikut bahasa pengguna).');
    }

    /** Jawaban alat MCP untuk Claude adalah teks ke sistem lain (D12): selalu Bahasa Indonesia, apa pun bahasa pengguna. */
    public function test_rute_mcp_selalu_bahasa_indonesia(): void
    {
        // Mcp::web mendaftarkan GET/DELETE/POST; panggilan alat (JSON-RPC) lewat POST, dan di situlah middleware tambahan menempel.
        $rute = collect(Route::getRoutes()->getRoutes())
            ->first(fn ($r): bool => $r->uri() === 'mcp/keuangan' && in_array('POST', $r->methods(), true));

        $this->assertNotNull($rute, 'Rute POST mcp/keuangan tidak ditemukan');
        $this->assertContains('locale.dokumen', $rute->gatherMiddleware(), 'Rute MCP tanpa locale.dokumen: label alat akan ikut bahasa pengguna.');
    }

    public function test_with_document_locale_memakai_id_lalu_memulihkan_bahasa_walau_gagal(): void
    {
        App::setLocale('zh');

        $this->assertSame('id|Agustus', withDocumentLocale(fn (): string => App::getLocale().'|'.Carbon::create(2026, 8, 1)->translatedFormat('F')));
        $this->assertSame('zh', App::getLocale());

        try {
            withDocumentLocale(function (): never {
                throw new RuntimeException('gagal di tengah dokumen');
            });
        } catch (RuntimeException) {
            // diharapkan
        }

        $this->assertSame('zh', App::getLocale());
        $this->assertSame('zh', Carbon::getLocale());
    }
}
