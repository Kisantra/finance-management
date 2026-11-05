<?php

namespace App\Mcp;

use App\Models\Company;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Passport\Client;

/**
 * Halaman persetujuan OAuth (GET /oauth/authorize milik Passport) saat Claude meminta
 * akses. Formulir Izinkan/Tolak dikirim sebagai form HTML biasa, bukan Inertia: jawaban
 * Passport adalah redirect ke domain klien (claude.ai), yang tidak bisa diikuti XHR.
 */
class PersetujuanClaude
{
    /**
     * @param  array{client: Client, scopes: array<int, mixed>, request: Request, authToken: string}  $parameters
     */
    public static function tampilkan(array $parameters): Response
    {
        $request = $parameters['request'];
        $client = $parameters['client'];
        $user = $request->user();
        $perusahaan = $user instanceof User ? app(AksesClaude::class)->perusahaan($user) : collect();

        return Inertia::render('oauth/authorize', [
            'clientName' => $client->name,
            'redirectHost' => parse_url((string) $request->query('redirect_uri', ''), PHP_URL_HOST) ?: null,
            'userName' => $user?->name,
            'companies' => $perusahaan->map(fn (Company $company) => ['kode' => $company->getKey(), 'nama' => $company->name])->values(),
            'form' => [
                'state' => (string) $request->query('state', ''),
                'client_id' => (string) $client->getKey(),
                'auth_token' => $parameters['authToken'],
            ],
            'approveUrl' => route('passport.authorizations.approve'),
            'denyUrl' => route('passport.authorizations.deny'),
        ]);
    }
}
