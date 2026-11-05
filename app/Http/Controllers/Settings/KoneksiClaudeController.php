<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Mcp\AksesClaude;
use App\Models\Company;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Passport\Client;
use Laravel\Passport\RefreshToken;
use Laravel\Passport\Token;

/**
 * Pengaturan › Koneksi Claude: alamat konektor MCP, perusahaan yang bisa dibaca Claude, dan
 * sambungan OAuth milik user yang login beserta tombol Cabut.
 *
 * Sengaja tanpa gate izin: halaman ini hanya menyentuh token milik user sendiri, sehingga
 * sambungan tetap bisa dicabut walau izin `use claude` sudah dilepas dari perannya. Tabel
 * oauth_* hidup di database pusat (`passport.connection`), jadi aman dibaca dari /c/{company}.
 */
class KoneksiClaudeController extends Controller
{
    public function index(Request $request, AksesClaude $akses): Response
    {
        /** @var User $user */
        $user = $request->user();
        $perusahaan = $akses->perusahaan($user);

        return Inertia::render('settings/claude', [
            'connectorUrl' => url('/mcp/keuangan'),
            'companies' => $perusahaan->map(fn (Company $company) => ['kode' => $company->getKey(), 'nama' => $company->name])->values(),
            'connections' => $this->sambunganAktif($user),
            'canUse' => $perusahaan->contains(fn (Company $company) => $company->getKey() === tenant()?->getTenantKey()),
        ]);
    }

    /**
     * Cabut SEMUA token akses user ini untuk klien itu beserta refresh token-nya. Guard
     * Passport memeriksa status cabut di setiap permintaan, jadi Claude langsung tertolak.
     */
    public function destroy(Request $request, string $client): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();
        $tokenUser = fn () => $user->tokens()->where('client_id', $client);

        abort_unless($tokenUser()->exists(), 404);

        RefreshToken::query()
            ->whereIn('access_token_id', $tokenUser()->select('id'))
            ->where('revoked', false)
            ->update(['revoked' => true]);

        $tokenUser()->where('revoked', false)->update(['revoked' => true]);

        return redirect()->route('settings.claude')
            ->with('success', 'Sambungan Claude dicabut. Claude harus login dan meminta izin lagi.');
    }

    /**
     * Sambungan aktif per klien OAuth. Token akses aktif = belum dicabut DAN (belum kedaluwarsa
     * ATAU refresh token-nya masih berlaku): token akses berumur 1 jam, refresh token 30 hari.
     *
     * Setiap refresh mencabut token akses lama, jadi token aktif selalu yang terbaru. Karena itu
     * "pertama tersambung" dihitung dari SEMUA token user untuk klien itu, bukan yang aktif saja.
     * Batas login ulang = refresh token berlaku yang paling akhir; tanpa refresh token yang
     * berlaku, login ulang dibutuhkan begitu token aksesnya habis.
     *
     * @return list<array{id: string, name: string, connectedAt: string, lastActiveAt: string, expiresAt: string|null}>
     */
    private function sambunganAktif(User $user): array
    {
        $sekarang = now();
        $refreshBerlaku = fn (Builder|Relation $query) => $query->where('revoked', false)->where('expires_at', '>', $sekarang);

        $tokenAktif = $user->tokens()
            ->where('revoked', false)
            ->where(fn (Builder $query) => $query->where('expires_at', '>', $sekarang)->orWhereHas('refreshToken', $refreshBerlaku))
            ->with(['refreshToken' => $refreshBerlaku])
            ->get()
            ->groupBy('client_id');

        if ($tokenAktif->isEmpty()) {
            return [];
        }

        return Client::query()
            ->whereKey($tokenAktif->keys()->all())
            ->where('revoked', false)
            ->withMin(['tokens as pertama_tersambung' => fn (Builder $query) => $query->where('user_id', $user->getKey())], 'created_at')
            ->withCasts(['pertama_tersambung' => 'datetime'])
            ->get()
            ->sortByDesc(fn (Client $client) => $tokenAktif[$client->getKey()]->max('created_at')->getTimestamp())
            ->map(function (Client $client) use ($tokenAktif): array {
                $token = $tokenAktif[$client->getKey()];

                return [
                    'id' => (string) $client->getKey(),
                    'name' => $client->name,
                    'connectedAt' => ($client->pertama_tersambung ?? $token->min('created_at'))->toIso8601String(),
                    'lastActiveAt' => $token->max('created_at')->toIso8601String(),
                    'expiresAt' => $token->map(fn (Token $item) => $item->refreshToken?->expires_at ?? $item->expires_at)->max()?->toIso8601String(),
                ];
            })
            ->values()
            ->all();
    }
}
