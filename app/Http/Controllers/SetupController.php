<?php

namespace App\Http\Controllers;

use App\Http\Middleware\RedirectToFirstRunSetup;
use App\Http\Requests\SetupRequest;
use App\Models\Company;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

/**
 * Walkthrough instalasi baru (pengganti `central:bootstrap` di terminal): akun admin pertama
 * + grup + perusahaan pertama, lalu admin diarahkan ke Profil Perusahaan yang wajib
 * dilengkapi (EnsureCompanyProfileComplete). Aktif hanya selama berkas token dari
 * deploy.sh (mode instalasi) ada, dan hanya untuk pembuka tautan sekali pakai itu.
 */
class SetupController extends Controller
{
    public function show(Request $request): Response|RedirectResponse
    {
        if (! is_file(RedirectToFirstRunSetup::tokenPath())) {
            return redirect('/login');
        }

        return Inertia::render('setup/index', [
            'unlocked' => (bool) $request->session()->get('setup_unlocked'),
            'appUrl' => rtrim((string) config('app.url'), '/'),
        ]);
    }

    public function unlock(Request $request, string $token): RedirectResponse
    {
        $path = RedirectToFirstRunSetup::tokenPath();

        if (is_file($path) && hash_equals(trim((string) file_get_contents($path)), $token)) {
            $request->session()->put('setup_unlocked', true);
        }

        return redirect('/setup');
    }

    public function store(SetupRequest $request): RedirectResponse
    {
        $tokenPath = RedirectToFirstRunSetup::tokenPath();
        abort_unless(is_file($tokenPath), 404);
        $data = $request->validated();

        $organization = Organization::firstOrCreate(
            ['slug' => Str::slug($data['company_name'])],
            ['name' => $data['company_name'], 'company_quota' => 10],
        );

        $admin = new User;
        $admin->fill([
            'name' => $data['admin_name'],
            'email' => $data['admin_email'],
            'password' => Hash::make($data['admin_password']),
        ]);
        // organization_id sengaja tidak fillable (lihat CentralBootstrap).
        $admin->organization_id = $organization->id;
        $admin->email_verified_at = now();
        $admin->save();

        try {
            $company = Company::create([
                'id' => $data['slug'],
                'organization_id' => $organization->id,
                'name' => $data['company_name'],
                'abbreviation' => $data['abbreviation'],
            ]);
        } catch (Throwable $e) {
            report($e);
            // Ulang dari awal tanpa sisa. Database tujuan dipastikan belum ada saat validasi
            // (SetupRequest), jadi yang kini ada adalah buatan percobaan ini: dibuang, supaya
            // kode URL yang sama bisa langsung dicoba lagi.
            $sisa = new Company(['id' => $data['slug']]);
            if ($sisa->database()->manager()->databaseExists($sisa->database()->getName())) {
                $sisa->database()->manager()->deleteDatabase($sisa);
            }
            Company::withoutEvents(fn () => Company::query()->whereKey($data['slug'])->delete());
            $admin->delete();
            if ($organization->wasRecentlyCreated) {
                $organization->delete();
            }

            return back()
                ->withInput($request->except('admin_password', 'admin_password_confirmation'))
                ->with('error', 'Database perusahaan gagal dibuat: '.Str::limit($e->getMessage(), 160)
                    .' Pastikan user MySQL di .env boleh membuat database, lalu coba lagi.');
        }

        $admin->companies()->syncWithoutDetaching([$company->getTenantKey()]);
        $timSebelumnya = getPermissionsTeamId();
        setPermissionsTeamId($company->getTenantKey());
        $admin->unsetRelation('roles');
        $admin->assignRole('admin');
        setPermissionsTeamId($timSebelumnya);

        File::delete($tokenPath);
        $request->session()->forget('setup_unlocked');
        Auth::login($admin);
        $request->session()->regenerate();

        return redirect("/c/{$company->getTenantKey()}/settings/company")
            ->with('success', 'Akun admin dan perusahaan pertama siap. Lengkapi profil perusahaan untuk mulai bekerja.');
    }
}
