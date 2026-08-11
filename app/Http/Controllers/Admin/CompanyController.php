<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreCompanyRequest;
use App\Models\Company;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class CompanyController extends Controller
{
    public function index(Request $request): Response
    {
        $organization = $request->user()->organization;

        abort_if($organization === null, 403, 'Akun Anda tidak terikat ke organization mana pun.');

        $companies = Company::withCount('members')
            ->where('organization_id', $organization->id)
            ->orderBy('created_at')
            ->get()
            ->map(fn (Company $company) => [
                'slug' => $company->getTenantKey(),
                'name' => $company->name,
                'abbreviation' => $company->abbreviation,
                'status' => $company->status,
                'members_count' => $company->members_count,
                'created_at' => $company->created_at?->format('Y-m-d'),
                'is_current' => tenant()?->getTenantKey() === $company->getTenantKey(),
            ]);

        return Inertia::render('admin/companies/index', [
            'companies' => $companies,
            'quota' => [
                'used' => $companies->count(),
                'total' => $organization->company_quota,
            ],
            'organizationName' => $organization->name,
        ]);
    }

    /**
     * Provisioning berjalan SINKRON (buat DB → migrate → seed → active) dan bisa
     * memakan beberapa detik. Gagal di tengah → status `failed` + tombol coba ulang
     * (keputusan final slide 12).
     */
    public function store(StoreCompanyRequest $request): RedirectResponse
    {
        $organization = $request->user()->organization;

        abort_if($organization === null, 403, 'Akun Anda tidak terikat ke organization mana pun.');

        if ($organization->hasReachedCompanyQuota()) {
            return back()->withErrors(['slug' => "Kuota perusahaan organization ini ({$organization->company_quota}) sudah penuh."]);
        }

        $validated = $request->validated();

        try {
            $company = Company::create([
                'id' => $validated['slug'],
                'organization_id' => $organization->id,
                'name' => $validated['name'],
                'abbreviation' => $validated['abbreviation'],
            ]);
        } catch (Throwable $e) {
            Log::error('Provisioning perusahaan gagal', ['slug' => $validated['slug'], 'error' => $e->getMessage()]);
            Company::where('id', $validated['slug'])->update(['status' => 'failed']);

            return back()->withErrors(['slug' => 'Provisioning gagal di tengah jalan — perusahaan berstatus "failed", gunakan tombol Coba Ulang. Detail ada di log.']);
        }

        $this->grantCreatorAccess($request, $company);

        return back()->with('success', "Perusahaan {$company->name} siap dipakai di /c/{$company->getTenantKey()}.");
    }

    public function retry(Request $request, Company $targetCompany): RedirectResponse
    {
        abort_unless($targetCompany->status === 'failed', 403, 'Hanya perusahaan berstatus "failed" yang bisa dicoba ulang.');
        abort_unless($targetCompany->organization_id === $request->user()->organization_id, 403);

        $attributes = [
            'id' => $targetCompany->getTenantKey(),
            'organization_id' => $targetCompany->organization_id,
            'name' => $targetCompany->name,
            'abbreviation' => $targetCompany->abbreviation,
        ];

        // Bersihkan sisa provisioning gagal: database setengah jadi + baris company.
        // Slug tervalidasi regex saat pembuatan — aman untuk identifier.
        $database = 'tenant_'.$targetCompany->getTenantKey();
        abort_unless(preg_match('/^[a-z0-9_-]+$/', $database) === 1, 500);
        DB::statement("DROP DATABASE IF EXISTS `{$database}`");
        Company::withoutEvents(fn () => $targetCompany->delete());

        try {
            $company = Company::create($attributes);
        } catch (Throwable $e) {
            Log::error('Retry provisioning gagal', ['slug' => $attributes['id'], 'error' => $e->getMessage()]);
            Company::where('id', $attributes['id'])->update(['status' => 'failed']);

            return back()->withErrors(['slug' => 'Coba ulang masih gagal — periksa log server.']);
        }

        $this->grantCreatorAccess($request, $company);

        return back()->with('success', "Perusahaan {$company->name} berhasil di-provision ulang.");
    }

    /** Pembuat otomatis menjadi anggota + admin perusahaan baru (tanpa ini tidak ada yang bisa masuk). */
    private function grantCreatorAccess(Request $request, Company $company): void
    {
        $user = $request->user();
        $user->companies()->syncWithoutDetaching([$company->getTenantKey()]);

        $previousTeamId = getPermissionsTeamId();
        setPermissionsTeamId($company->getTenantKey());
        $user->unsetRelation('roles');
        $user->assignRole('admin');
        setPermissionsTeamId($previousTeamId);
        $user->unsetRelation('roles')->unsetRelation('permissions');
    }
}
