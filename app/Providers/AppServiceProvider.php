<?php

namespace App\Providers;

use App\Mcp\PersetujuanClaude;
use Carbon\Carbon;
use Carbon\CarbonInterval;
use Illuminate\Auth\Middleware\RedirectIfAuthenticated;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Events\MigrationsStarted;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;
use Laravel\Passport\Passport;
use RuntimeException;

class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // Prevent lazy loading in non-production to catch N+1 queries
        Model::preventLazyLoading(! app()->isProduction());

        // User yang sudah login membuka route guest (mis. /login) diarahkan ke
        // pemilih perusahaan, BUKAN ke route('dashboard') bawaan Laravel —
        // dashboard kini ber-parameter {company} sehingga tanpa konteks tenant
        // pembuatan URL-nya melempar UrlGenerationException (HTTP 500).
        RedirectIfAuthenticated::redirectUsing(fn () => route('choose-company'));

        // Koneksi Claude (MCP, routes/ai.php) lewat OAuth Passport. Tabel oauth_* hidup di
        // database PUSAT: tanpa ini, kode yang menyentuh token di dalam /c/{company}
        // (tenancy aktif) mencarinya di database perusahaan. Token akses berumur pendek;
        // refresh token 30 hari (setelah itu Claude meminta login & persetujuan ulang).
        config(['passport.connection' => config('tenancy.database.central_connection')]);
        // Kunci OAuth dipatok ke storage PUSAT: di dalam /c/{company} tenancy mengalihkan
        // storage_path() ke storage/tenant{slug}, padahal /oauth & /mcp membacanya dari pusat.
        Passport::loadKeysFrom(storage_path());
        Passport::tokensExpireIn(CarbonInterval::hour());
        Passport::refreshTokensExpireIn(CarbonInterval::days(30));
        Passport::authorizationView(fn (array $parameters) => PersetujuanClaude::tampilkan($parameters));

        // Testing memakai SATU database: migration tenant ikut dimuat ke DB test
        // (produksi/dev menjalankannya via tenants:migrate ke DB per perusahaan)
        if ($this->app->environment('testing')) {
            $this->loadMigrationsFrom(database_path('migrations/tenant'));
        }

        // Pengaman cutover: kode multi-perusahaan tidak boleh menjalankan migration, maju
        // ATAU mundur, terhadap database deployment lama. Itu terjadi bila deploy.sh versi
        // lama menarik rilis ini lalu memanggil `migrate`, atau operator mengikuti saran
        // `migrate:rollback` yang dicetaknya. Lihat docs/guides/DEPLOY.md.
        Event::listen(MigrationsStarted::class, function (): void {
            if (tenancy()->initialized || ! $this->databaseSatuPerusahaan()) {
                return;
            }

            throw new RuntimeException(implode(PHP_EOL, [
                'Database ini masih database satu-perusahaan (deployment lama). Migration DIHENTIKAN sebelum menyentuh apa pun.',
                'Rollback juga ditolak: jangan ikuti saran migrate:rollback dari deploy.sh lama.',
                'Kembalikan kode: git reset --hard <commit sebelumnya>, composer install, npm ci, npm run build, php artisan optimize:clear, php artisan up.',
                'Lalu jalankan deploy.sh baru (mendeteksi server lama & mengonversinya otomatis): git fetch origin && bash <(git show origin/main:deploy.sh)',
                'Panduan: docs/guides/DEPLOY.md',
            ]));
        });

        // Set locale from session or user preference with fallback
        $availableLocales = config('app.available_locales', ['id', 'zh']);
        $locale = session('locale');

        // If locale is not available, fallback to 'id'
        if (! $locale || ! in_array($locale, $availableLocales)) {
            $locale = 'id';
        }

        // If user is authenticated, use their preference
        if (auth()->check() && auth()->user()->locale) {
            $userLocale = auth()->user()->locale;
            // Only use user locale if it's available
            if (in_array($userLocale, $availableLocales)) {
                $locale = $userLocale;
            } else {
                // Update user's locale to fallback
                auth()->user()->update(['locale' => 'id']);
            }
        }

        App::setLocale($locale);

        // Set Carbon locale for date translations
        // Map locale to Carbon locale codes
        $carbonLocale = match ($locale) {
            'zh' => 'zh_CN', // Chinese Simplified
            'id' => 'id',    // Indonesian
            default => 'id',
        };
        Carbon::setLocale($carbonLocale);
    }

    /**
     * Database deployment lama: ada tabel bisnis + user, tetapi belum ada `companies`.
     * Database pusat tidak pernah punya `invoices`; di test migration tenant ikut dimuat,
     * tetapi `migrate:fresh` memicu event ini saat database masih kosong.
     */
    private function databaseSatuPerusahaan(): bool
    {
        return Schema::hasTable('invoices') && ! Schema::hasTable('companies')
            && Schema::hasTable('users') && DB::table('users')->exists();
    }
}
