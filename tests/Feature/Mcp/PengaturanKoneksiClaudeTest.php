<?php

namespace Tests\Feature\Mcp;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Passport\Client;
use Laravel\Passport\RefreshToken;
use Laravel\Passport\Token;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Pengaturan › Koneksi Claude: alamat konektor, perusahaan yang terbaca, sambungan OAuth aktif,
 * dan pencabutan yang hanya menyentuh token milik user yang login.
 */
class PengaturanKoneksiClaudeTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected User $staf;

    protected function setUp(): void
    {
        parent::setUp();

        $this->travelTo(Carbon::parse('2026-11-05 10:00:00'));

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
        setPermissionsTeamId(null);
        Permission::firstOrCreate(['name' => 'use claude']);
        Role::firstOrCreate(['name' => 'admin'])->givePermissionTo('use claude');
        Role::firstOrCreate(['name' => 'staff']);
        setPermissionsTeamId(self::TEST_COMPANY);

        $this->admin = User::factory()->create(['name' => 'Admin Uji']);
        $this->admin->companies()->syncWithoutDetaching([self::TEST_COMPANY]);
        $this->admin->assignRole('admin');

        $this->staf = User::factory()->create(['name' => 'Staf Uji']);
        $this->staf->companies()->syncWithoutDetaching([self::TEST_COMPANY]);
        $this->staf->assignRole('staff');
    }

    public function test_halaman_memuat_alamat_konektor_perusahaan_dan_hanya_sambungan_aktif(): void
    {
        // Refresh mencabut token lama: "pertama tersambung" tetap dihitung dari token lama itu.
        $claude = $this->klien('Claude');
        $lama = $this->token($this->admin, $claude, ['created_at' => now()->subDays(5), 'expires_at' => now()->subDays(5)->addHour(), 'revoked' => true], ['revoked' => true]);
        $terbaru = $this->token($this->admin, $claude, ['created_at' => now()->subHours(2), 'expires_at' => now()->subHour()], ['expires_at' => now()->addDays(29)]);

        // Token akses masih berlaku tanpa refresh token: login ulang begitu token akses habis.
        $desktop = $this->klien('Claude Desktop');
        $this->token($this->admin, $desktop, ['created_at' => now()->subMinutes(10), 'expires_at' => now()->addMinutes(50)], null);

        $this->token($this->admin, $this->klien('Klien Dicabut'), ['revoked' => true, 'expires_at' => now()->subDay()], ['revoked' => true]);
        $this->token($this->admin, $this->klien('Klien Kedaluwarsa'), ['expires_at' => now()->subDays(31)], ['expires_at' => now()->subDay()]);
        $this->token($this->admin, $this->klien('Klien Nonaktif', dicabut: true));
        $this->token($this->staf, $this->klien('Milik Staf'));

        $this->actingAs($this->admin)
            ->get('/settings/claude')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('settings/claude')
                ->where('connectorUrl', url('/mcp/keuangan'))
                ->where('canUse', true)
                ->has('readableCompanies', 1)
                ->where('readableCompanies.0.kode', self::TEST_COMPANY)
                ->where('readableCompanies.0.nama', 'Test Company')
                ->has('connections', 2)
                ->where('connections.0.id', $desktop->getKey())
                ->where('connections.0.name', 'Claude Desktop')
                ->where('connections.0.expiresAt', now()->addMinutes(50)->toIso8601String())
                ->where('connections.1.id', $claude->getKey())
                ->where('connections.1.name', 'Claude')
                ->where('connections.1.connectedAt', $lama->created_at->toIso8601String())
                ->where('connections.1.lastActiveAt', $terbaru->created_at->toIso8601String())
                ->where('connections.1.expiresAt', now()->addDays(29)->toIso8601String())
            );
    }

    public function test_cabut_mencabut_token_akses_dan_refresh_milik_user_sendiri_saja(): void
    {
        $claude = $this->klien('Claude');
        $aktif = $this->token($this->admin, $claude);
        $kedaluwarsa = $this->token($this->admin, $claude, ['created_at' => now()->subDays(3), 'expires_at' => now()->subDays(3)->addHour()]);
        $milikStaf = $this->token($this->staf, $claude);
        $klienLain = $this->token($this->admin, $this->klien('Klien Lain'));

        $this->actingAs($this->admin)
            ->delete('/settings/claude/'.$claude->getKey())
            ->assertRedirect('/c/'.self::TEST_COMPANY.'/settings/claude')
            ->assertSessionHas('success', 'Sambungan Claude dicabut. Claude harus login dan meminta izin lagi.');

        foreach ([$aktif, $kedaluwarsa] as $token) {
            $this->assertTrue($token->fresh()->revoked);
            $this->assertTrue($this->refreshDicabut($token));
        }

        $this->assertFalse($milikStaf->fresh()->revoked, 'Token user lain untuk klien yang sama tidak boleh ikut dicabut.');
        $this->assertFalse($this->refreshDicabut($milikStaf));
        $this->assertFalse($klienLain->fresh()->revoked);

        $this->actingAs($this->admin)
            ->get('/settings/claude')
            ->assertInertia(fn (Assert $page) => $page
                ->has('connections', 1)
                ->where('connections.0.name', 'Klien Lain')
            );
    }

    public function test_cabut_klien_tanpa_token_milik_user_menghasilkan_404(): void
    {
        $claude = $this->klien('Claude');
        $milikStaf = $this->token($this->staf, $claude);

        $this->actingAs($this->admin)->delete('/settings/claude/'.$claude->getKey())->assertNotFound();
        $this->actingAs($this->admin)->delete('/settings/claude/'.Str::uuid())->assertNotFound();

        $this->assertFalse($milikStaf->fresh()->revoked);
        $this->assertFalse($this->refreshDicabut($milikStaf));
    }

    public function test_tanpa_izin_use_claude_halaman_tetap_terbuka_dan_sambungan_bisa_dicabut(): void
    {
        $claude = $this->klien('Claude');
        $token = $this->token($this->staf, $claude);

        $this->actingAs($this->staf)
            ->get('/settings/claude')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('canUse', false)
                ->has('readableCompanies', 0)
                ->has('connections', 1)
                ->where('connections.0.id', $claude->getKey())
            );

        $this->actingAs($this->staf)
            ->delete('/settings/claude/'.$claude->getKey())
            ->assertRedirect('/c/'.self::TEST_COMPANY.'/settings/claude');

        $this->assertTrue($token->fresh()->revoked);
        $this->assertTrue($this->refreshDicabut($token));
    }

    private function klien(string $nama, bool $dicabut = false): Client
    {
        return Client::query()->forceCreate([
            'name' => $nama,
            'secret' => null,
            'provider' => null,
            'redirect_uris' => ['https://claude.ai/api/mcp/auth_callback'],
            'grant_types' => ['authorization_code', 'refresh_token'],
            'revoked' => $dicabut,
        ]);
    }

    /**
     * Token akses (bawaan: aktif, habis 1 jam lagi) + refresh token (bawaan: berlaku 30 hari;
     * null = tanpa refresh token).
     *
     * @param  array<string, mixed>  $akses
     * @param  array<string, mixed>|null  $refresh
     */
    private function token(User $user, Client $client, array $akses = [], ?array $refresh = []): Token
    {
        $token = Token::query()->forceCreate([
            'id' => bin2hex(random_bytes(40)),
            'user_id' => $user->getKey(),
            'client_id' => $client->getKey(),
            'scopes' => ['mcp:use'],
            'revoked' => false,
            'expires_at' => now()->addHour(),
            ...$akses,
        ]);

        if ($refresh !== null) {
            RefreshToken::query()->forceCreate([
                'id' => bin2hex(random_bytes(40)),
                'access_token_id' => $token->getKey(),
                'revoked' => false,
                'expires_at' => now()->addDays(30),
                ...$refresh,
            ]);
        }

        return $token;
    }

    private function refreshDicabut(Token $token): bool
    {
        return RefreshToken::query()->where('access_token_id', $token->getKey())->firstOrFail()->revoked;
    }
}
