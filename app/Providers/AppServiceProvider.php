<?php

namespace App\Providers;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\App;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // Prevent lazy loading in non-production to catch N+1 queries
        Model::preventLazyLoading(! app()->isProduction());

        // Testing memakai SATU database: migration tenant ikut dimuat ke DB test
        // (produksi/dev menjalankannya via tenants:migrate ke DB per perusahaan)
        if ($this->app->environment('testing')) {
            $this->loadMigrationsFrom(database_path('migrations/tenant'));
        }

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
}
