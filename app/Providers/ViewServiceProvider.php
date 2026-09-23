<?php

namespace App\Providers;

use App\Models\CompanyProfile;
use Illuminate\Support\Facades\View;
use Illuminate\Support\ServiceProvider;
use Throwable;

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
            // Halaman error cadangan (resources/views/errors/*) harus bebas database:
            // ia justru tampil saat database bermasalah.
            if (str_starts_with($view->name(), 'errors.')) {
                $view->with('companyProfile', null);

                return;
            }

            // Composer ini jalan di SETIAP view, termasuk halaman error. Bila database
            // bermasalah, query di sini menjatuhkan halaman error itu sendiri — error
            // saat menampilkan error — dan Laravel terpaksa jatuh ke halaman Symfony
            // polos. Karena itu kegagalannya ditelan: halaman tetap tampil tanpa profil.
            $companyProfile = once(function () {
                try {
                    return CompanyProfile::first();
                } catch (Throwable) {
                    return null;
                }
            });

            $view->with('companyProfile', $companyProfile);
        });
    }
}
