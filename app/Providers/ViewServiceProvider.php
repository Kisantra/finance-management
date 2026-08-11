<?php

namespace App\Providers;

use App\Models\CompanyProfile;
use Illuminate\Support\Facades\View;
use Illuminate\Support\ServiceProvider;

class ViewServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        View::composer('*', function ($view) {
            // company_profiles adalah tabel TENANT — hanya query saat konteks
            // perusahaan aktif; view central (login, pemilih perusahaan) dapat null.
            $companyProfile = once(fn () => tenant() ? CompanyProfile::first() : null);
            $view->with('companyProfile', $companyProfile);
        });
    }
}
