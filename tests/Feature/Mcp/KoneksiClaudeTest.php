<?php

namespace Tests\Feature\Mcp;

use App\Mcp\Servers\KeuanganServer;
use App\Mcp\Tools\DaftarPerusahaan;
use App\Mcp\Tools\RekeningBank;
use App\Models\BankAccount;
use App\Models\User;
use Carbon\CarbonInterval;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Laravel\Passport\Client;
use Laravel\Passport\Passport;
use League\OAuth2\Server\AuthorizationServer;
use League\OAuth2\Server\Exception\OAuthServerException;
use League\OAuth2\Server\ResourceServer;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class KoneksiClaudeTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected User $staf;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
        setPermissionsTeamId(null);
        foreach (['use claude', 'view bank-accounts'] as $izin) {
            Permission::firstOrCreate(['name' => $izin]);
        }
        Role::firstOrCreate(['name' => 'admin'])->givePermissionTo(['use claude', 'view bank-accounts']);
        Role::firstOrCreate(['name' => 'staff'])->givePermissionTo('view bank-accounts');
        setPermissionsTeamId(self::TEST_COMPANY);

        $this->admin = User::factory()->create(['name' => 'Admin Uji']);
        $this->admin->companies()->syncWithoutDetaching([self::TEST_COMPANY]);
        $this->admin->assignRole('admin');

        $this->staf = User::factory()->create(['name' => 'Staf Uji']);
        $this->staf->companies()->syncWithoutDetaching([self::TEST_COMPANY]);
        $this->staf->assignRole('staff');
    }

    public function test_tanpa_token_server_mcp_menolak_dan_menunjuk_ke_login_oauth(): void
    {
        $this->postJson('/mcp/keuangan', ['jsonrpc' => '2.0', 'id' => 1, 'method' => 'initialize', 'params' => []])
            ->assertUnauthorized()
            ->assertHeader('WWW-Authenticate');

        $this->getJson('/.well-known/oauth-authorization-server')
            ->assertOk()
            ->assertJsonPath('authorization_endpoint', url('/oauth/authorize'));
    }

    public function test_daftar_perusahaan_hanya_memuat_yang_berizin_use_claude(): void
    {
        KeuanganServer::actingAs($this->admin)->tool(DaftarPerusahaan::class)
            ->assertOk()
            ->assertSee(self::TEST_COMPANY);

        KeuanganServer::actingAs($this->staf)->tool(DaftarPerusahaan::class)
            ->assertOk()
            ->assertSee('Belum ada perusahaan yang boleh dibaca');
    }

    public function test_alat_menolak_tanpa_izin_use_claude_dan_perusahaan_yang_tidak_ada(): void
    {
        KeuanganServer::actingAs($this->staf)->tool(RekeningBank::class, ['perusahaan' => self::TEST_COMPANY])
            ->assertHasErrors();

        KeuanganServer::actingAs($this->admin)->tool(RekeningBank::class, ['perusahaan' => 'perusahaan-lain'])
            ->assertHasErrors();
    }

    public function test_rekening_bank_membaca_saldo_lalu_mengembalikan_koneksi_ke_pusat(): void
    {
        BankAccount::factory()->create(['account_name' => 'Rekening Operasional Uji', 'initial_balance' => 2500000]);

        KeuanganServer::actingAs($this->admin)->tool(RekeningBank::class, ['perusahaan' => self::TEST_COMPANY])
            ->assertOk()
            ->assertSee('Rekening Operasional Uji')
            ->assertSee('2500000');

        $this->assertFalse(tenancy()->initialized, 'Koneksi harus kembali ke database pusat setelah alat selesai.');
        $this->assertSame(self::TEST_COMPANY, getPermissionsTeamId(), 'Team izin harus dipulihkan.');
    }

    /**
     * Jalur sungguhan: HTTP + token Passport (guard `api`). Middleware auth:api menjadikan
     * `api` guard bawaan, dan Spatie mencari izin di guard itu, padahal semua izin aplikasi
     * ber-guard `web`, sehingga setiap cek bernilai false. Pemanggilan alat langsung
     * (KeuanganServer::actingAs) memakai guard `web` dan tidak menangkap ini.
     */
    public function test_lewat_http_dengan_token_passport_izin_tetap_terbaca(): void
    {
        Passport::actingAs($this->admin, ['mcp:use']);
        $header = ['Accept' => 'application/json, text/event-stream'];

        $init = $this->postJson('/mcp/keuangan', [
            'jsonrpc' => '2.0', 'id' => 1, 'method' => 'initialize',
            'params' => ['protocolVersion' => '2025-06-18', 'capabilities' => (object) [], 'clientInfo' => ['name' => 'uji', 'version' => '1']],
        ], $header)->assertOk();

        $sesi = $init->headers->get('MCP-Session-Id');

        $this->postJson('/mcp/keuangan', [
            'jsonrpc' => '2.0', 'id' => 2, 'method' => 'tools/call',
            'params' => ['name' => 'daftar-perusahaan', 'arguments' => (object) []],
        ], array_filter([...$header, 'MCP-Session-Id' => $sesi]))
            ->assertOk()
            ->assertSee(self::TEST_COMPANY);
    }

    public function test_setiap_alat_data_mengumumkan_diri_hanya_membaca(): void
    {
        $this->assertTrue((new RekeningBank)->annotations()['readOnlyHint'] ?? false);
        $this->assertTrue((new DaftarPerusahaan)->annotations()['readOnlyHint'] ?? false);
    }

    public function test_halaman_persetujuan_menampilkan_perusahaan_yang_akan_terbaca(): void
    {
        $client = Client::query()->forceCreate([
            'name' => 'Claude',
            'secret' => null,
            'provider' => null,
            'redirect_uris' => ['https://claude.ai/api/mcp/auth_callback'],
            'grant_types' => ['authorization_code', 'refresh_token'],
            'revoked' => false,
        ]);

        $verifier = Str::random(64);
        $challenge = rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');

        $this->actingAs($this->admin)
            ->get('/oauth/authorize?'.http_build_query([
                'client_id' => $client->getKey(),
                'redirect_uri' => 'https://claude.ai/api/mcp/auth_callback',
                'response_type' => 'code',
                'scope' => 'mcp:use',
                'state' => 'abc123',
                'code_challenge' => $challenge,
                'code_challenge_method' => 'S256',
            ]))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('oauth/authorize')
                ->where('clientName', 'Claude')
                ->where('redirectHost', 'claude.ai')
                ->where('form.state', 'abc123')
                ->where('readableCompanies.0.kode', self::TEST_COMPANY)
            );
    }

    /**
     * Watchpost #20: token akses berumur 1 jam. Claude yang kembali setelah itu masih mengirim
     * token lama, ditolak 401 + WWW-Authenticate, lalu memakai refresh token. Itu alur normal,
     * bukan error, tetapi Passport memanggil report() untuk penolakannya.
     */
    public function test_token_kedaluwarsa_ditolak_tanpa_dilaporkan_lalu_refresh_token_menyambung_lagi(): void
    {
        Exceptions::fake();

        // JWT diperiksa dengan jam sistem, bukan Carbon, sehingga travel() tidak berlaku:
        // terbitkan token yang sudah habis masa berlakunya sejak awal. AuthorizationServer
        // menyimpan umur token saat dibuat (dan controller /oauth/token menyimpan server itu),
        // jadi keduanya dibuat ulang agar refresh menerbitkan token 1 jam seperti di produksi.
        Passport::tokensExpireIn(CarbonInterval::minutes(-1));
        $token = $this->sambungkanClaude();
        Passport::tokensExpireIn(CarbonInterval::hour());
        app()->forgetInstance(AuthorizationServer::class);
        Route::getRoutes()->getByName('passport.token')->flushController();

        $this->initializeMcp($token['access_token'])
            ->assertUnauthorized()
            ->assertHeader('WWW-Authenticate');

        Exceptions::assertNotReported(OAuthServerException::class);

        $baru = $this->post('/oauth/token', [
            'grant_type' => 'refresh_token',
            'refresh_token' => $token['refresh_token'],
            'client_id' => $token['client_id'],
            'scope' => 'mcp:use',
        ])->assertOk()->json();

        $this->initializeMcp($baru['access_token'])->assertOk();
    }

    public function test_token_yang_dicabut_dari_pengaturan_ditolak_tanpa_dilaporkan(): void
    {
        Exceptions::fake();
        $token = $this->sambungkanClaude();

        $this->actingAs($this->admin)
            ->delete('/settings/claude/'.$token['client_id'])
            ->assertRedirect();

        $this->initializeMcp($token['access_token'])
            ->assertUnauthorized()
            ->assertHeader('WWW-Authenticate');

        Exceptions::assertNotReported(OAuthServerException::class);
    }

    /**
     * Tanda tangan yang tidak cocok tidak pernah terjadi dalam operasi normal: kunci OAuth
     * server berubah atau token berasal dari server lain. Itu tetap harus sampai ke Watchpost.
     */
    public function test_token_dengan_tanda_tangan_tidak_cocok_tetap_dilaporkan(): void
    {
        Exceptions::fake();
        $token = $this->sambungkanClaude();

        $kunciLain = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        config(['passport.public_key' => openssl_pkey_get_details($kunciLain)['key']]);
        app()->forgetInstance(ResourceServer::class);
        Auth::forgetGuards();

        $this->initializeMcp($token['access_token'])->assertUnauthorized();

        Exceptions::assertReported(fn (OAuthServerException $e) => $e->getHint() === 'Access token could not be verified');
    }

    /**
     * Alur OAuth yang dijalani Claude: persetujuan admin → kode otorisasi (PKCE) → token.
     *
     * @return array{access_token: string, refresh_token: string, client_id: string}
     */
    private function sambungkanClaude(): array
    {
        $redirect = 'https://claude.ai/api/mcp/auth_callback';
        $client = Client::query()->forceCreate([
            'name' => 'Claude',
            'secret' => null,
            'provider' => null,
            'redirect_uris' => [$redirect],
            'grant_types' => ['authorization_code', 'refresh_token'],
            'revoked' => false,
        ]);

        $verifier = Str::random(64);
        $challenge = rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');

        $form = $this->actingAs($this->admin)
            ->get('/oauth/authorize?'.http_build_query([
                'client_id' => $client->getKey(),
                'redirect_uri' => $redirect,
                'response_type' => 'code',
                'scope' => 'mcp:use',
                'state' => 'abc123',
                'code_challenge' => $challenge,
                'code_challenge_method' => 'S256',
            ]))
            ->assertOk()
            ->inertiaProps('form');

        $kembali = $this->actingAs($this->admin)->post('/oauth/authorize', $form)->assertRedirect();
        parse_str((string) parse_url((string) $kembali->headers->get('Location'), PHP_URL_QUERY), $query);

        $token = $this->post('/oauth/token', [
            'grant_type' => 'authorization_code',
            'client_id' => $client->getKey(),
            'redirect_uri' => $redirect,
            'code_verifier' => $verifier,
            'code' => $query['code'],
        ])->assertOk()->json();

        // Permintaan berikutnya hanya membawa token Bearer, seperti dari server Claude.
        Auth::forgetGuards();

        return [...$token, 'client_id' => (string) $client->getKey()];
    }

    private function initializeMcp(string $accessToken): TestResponse
    {
        return $this->postJson('/mcp/keuangan', [
            'jsonrpc' => '2.0', 'id' => 1, 'method' => 'initialize',
            'params' => ['protocolVersion' => '2025-06-18', 'capabilities' => (object) [], 'clientInfo' => ['name' => 'uji', 'version' => '1']],
        ], ['Accept' => 'application/json, text/event-stream', 'Authorization' => 'Bearer '.$accessToken]);
    }
}
