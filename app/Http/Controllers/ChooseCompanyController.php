<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ChooseCompanyController extends Controller
{
    /**
     * Halaman pemilih perusahaan (central, pasca-login).
     * 0 perusahaan → 403; 1 perusahaan → langsung ke dashboard-nya;
     * >1 → tampilkan pemilih.
     */
    public function __invoke(Request $request): RedirectResponse|Response
    {
        $companies = $request->user()
            ->companies()
            ->where('status', 'active')
            ->get(['companies.id', 'name', 'abbreviation']);

        abort_if($companies->isEmpty(), 403, 'Akun Anda belum terdaftar di perusahaan mana pun. Hubungi administrator.');

        if ($companies->count() === 1) {
            return redirect()->route('dashboard', ['company' => $companies->first()->getTenantKey()]);
        }

        return Inertia::render('choose-company', [
            'companies' => $companies->map(fn ($company) => [
                'slug' => $company->getTenantKey(),
                'name' => $company->name,
                'abbreviation' => $company->abbreviation,
            ])->values(),
        ]);
    }
}
