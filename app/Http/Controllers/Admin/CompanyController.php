<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreCompanyRequest;
use App\Models\Company;
use App\Models\Role;
use App\Models\User;
use App\Services\InvoiceNumberService;
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

        abort_if($organization === null, 403, __('Akun Anda tidak terikat ke organization mana pun.'));

        $daftar = Company::query()
            ->where('organization_id', $organization->id)
            ->with(['members' => fn ($query) => $query->select('users.id', 'users.name')->orderBy('users.name')])
            ->orderBy('created_at')
            ->get();

        $peran = $this->peranAnggota($daftar->map(fn (Company $company) => (string) $company->getTenantKey())->all());
        $saya = $request->user()->id;

        $companies = $daftar->map(fn (Company $company) => [
            'slug' => $company->getTenantKey(),
            'name' => $company->name,
            'abbreviation' => $company->abbreviation,
            'status' => $company->status,
            'members_count' => $company->members->count(),
            'members' => $company->members->map(fn (User $member) => [
                'id' => $member->id,
                'name' => $member->name,
                'role' => $peran[(string) $company->getTenantKey()][$member->id] ?? null,
            ])->values(),
            'created_at' => $company->created_at?->format('Y-m-d'),
            'is_current' => tenant()?->getTenantKey() === $company->getTenantKey(),
            'is_member' => $company->members->contains('id', $saya),
        ]);

        return Inertia::render('admin/companies/index', [
            // BUKAN 'companies': nama itu dipakai prop bersama yang berisi
            // perusahaan tempat pengguna menjadi ANGGOTA. Daftar di sini lain —
            // seluruh perusahaan organisasi, termasuk yang bukan anggotanya —
            // sehingga menimpanya membuat pengalih perusahaan di header menawarkan
            // PT yang akan menjawab 403 saat diklik.
            'organizationCompanies' => $companies,
            'quota' => [
                'used' => $companies->count(),
                'total' => $organization->company_quota,
            ],
            'organizationName' => $organization->name,
            // Bahan pratinjau formulir "Perusahaan baru": nama database dan nomor
            // invoice pertama dirakit di browser selagi admin mengetik.
            'preview' => [
                'databasePrefix' => (string) config('tenancy.database.prefix'),
                'databaseSuffix' => (string) config('tenancy.database.suffix'),
                'invoiceFormat' => InvoiceNumberService::DEFAULT_FORMAT,
                'invoicePadding' => InvoiceNumberService::DEFAULT_PADDING,
            ],
        ]);
    }

    /**
     * Peran tiap anggota di tiap perusahaan, dalam satu query. Relasi `roles` Spatie
     * terikat team yang AKTIF, jadi tidak bisa membaca peran di perusahaan lain.
     *
     * @param  list<string>  $slugs
     * @return array<string, array<int, string>> slug => [user_id => nama peran]
     */
    private function peranAnggota(array $slugs): array
    {
        $pivot = (string) config('permission.table_names.model_has_roles');
        $tim = (string) config('permission.column_names.team_foreign_key');
        $roles = (new Role)->getTable();

        return Role::query()
            ->join($pivot, "{$pivot}.role_id", '=', "{$roles}.id")
            ->where("{$pivot}.model_type", (new User)->getMorphClass())
            ->whereIn("{$pivot}.{$tim}", $slugs)
            ->orderBy("{$roles}.id")
            ->get(["{$roles}.name", "{$pivot}.{$tim} as perusahaan", "{$pivot}.model_id as pengguna"])
            ->groupBy('perusahaan')
            ->map(fn ($baris) => $baris->unique('pengguna')->pluck('name', 'pengguna')->all())
            ->all();
    }

    /**
     * Provisioning berjalan SINKRON (buat DB → migrate → seed → active) dan bisa
     * memakan beberapa detik. Gagal di tengah → status `failed` + tombol coba ulang
     * (keputusan final slide 12).
     */
    public function store(StoreCompanyRequest $request): RedirectResponse
    {
        $organization = $request->user()->organization;

        abort_if($organization === null, 403, __('Akun Anda tidak terikat ke organization mana pun.'));

        if ($organization->hasReachedCompanyQuota()) {
            return back()->withErrors(['slug' => __('Kuota perusahaan organization ini (:kuota) sudah penuh.', ['kuota' => $organization->company_quota])]);
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

            return back()->withErrors(['slug' => __('Provisioning gagal di tengah jalan — perusahaan berstatus "failed", gunakan tombol Coba Ulang. Detail ada di log.')]);
        }

        $this->grantCreatorAccess($request, $company);

        return back()->with('success', __('Perusahaan :nama siap dipakai di /c/:kode.', ['nama' => $company->name, 'kode' => $company->getTenantKey()]));
    }

    public function retry(Request $request, Company $targetCompany): RedirectResponse
    {
        abort_unless($targetCompany->status === 'failed', 403, __('Hanya perusahaan berstatus "failed" yang bisa dicoba ulang.'));
        abort_unless($targetCompany->organization_id === $request->user()->organization_id, 403);

        $attributes = [
            'id' => $targetCompany->getTenantKey(),
            'organization_id' => $targetCompany->organization_id,
            'name' => $targetCompany->name,
            'abbreviation' => $targetCompany->abbreviation,
        ];

        // Bersihkan sisa provisioning gagal: database setengah jadi + baris company.
        // Nama dari perusahaannya sendiri (awalan instalasi + slug), divalidasi sebelum
        // diinterpolasi sebagai identifier.
        $database = (string) $targetCompany->database()->getName();
        abort_unless(preg_match('/^[A-Za-z0-9_-]+$/', $database) === 1, 500);
        DB::statement("DROP DATABASE IF EXISTS `{$database}`");
        Company::withoutEvents(fn () => $targetCompany->delete());

        try {
            $company = Company::create($attributes);
        } catch (Throwable $e) {
            Log::error('Retry provisioning gagal', ['slug' => $attributes['id'], 'error' => $e->getMessage()]);
            Company::where('id', $attributes['id'])->update(['status' => 'failed']);

            return back()->withErrors(['slug' => __('Coba ulang masih gagal — periksa log server.')]);
        }

        $this->grantCreatorAccess($request, $company);

        return back()->with('success', __('Perusahaan :nama berhasil di-provision ulang.', ['nama' => $company->name]));
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
