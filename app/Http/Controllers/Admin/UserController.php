<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\BulkDestroyUserRequest;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Http\Requests\Admin\UpdateUserRequest;
use App\Models\Company;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\PermissionRegistrar;

class UserController extends Controller
{
    /**
     * Kolom yang boleh dipakai mengurutkan.
     *
     * Nilai `sort` dari URL tidak boleh langsung masuk orderBy(): `?sort=ngawur`
     * menjatuhkan halaman dengan 500 — input pengguna yang menjadi SQL.
     * Ditemukan QC 2026-11-03 di /services, lalu ternyata berulang di sini.
     *
     * @var list<string>
     */
    private const KOLOM_URUT = ['name', 'email', 'phone_number', 'status', 'created_at'];

    public function index(Request $request): Response
    {
        $search = $request->input('search');
        $role = $request->input('role');
        $status = $request->input('status');
        $perPage = (int) $request->input('per_page', 10);
        $sort = in_array($request->input('sort'), self::KOLOM_URUT, true)
            ? $request->input('sort')
            : 'created_at';
        $direction = $request->input('direction', 'desc');

        $users = User::query()
            ->memberOfCurrentCompany()
            ->with(['roles', 'companies:companies.id,name,abbreviation'])
            ->when($search, fn (Builder $q) => $q->whereAny(
                ['name', 'email', 'phone_number'],
                'like',
                '%'.trim($search).'%'
            ))
            ->when($role, fn (Builder $q) => $q->whereHas('roles', fn ($qr) => $qr->where('name', $role)))
            ->when($status, fn (Builder $q) => $q->where('status', $status))
            ->orderBy($sort, $direction)
            ->paginate($perPage)
            ->withQueryString()
            ->through(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone_number' => $user->phone_number,
                'status' => $user->status,
                'role' => $user->roles->first()?->name,
                'role_icon' => $user->roles->first()?->icon,
                'initials' => $user->initials(),
                'created_at' => $user->created_at?->toIso8601String(),
                'is_current' => $user->id === auth()->id(),
                // Keanggotaan lintas perusahaan ditampilkan di daftar supaya admin grup
                // bisa melihat sekilas siapa yang bekerja di lebih dari satu PT.
                'companies' => $user->companies
                    ->map(fn (Company $c) => ['slug' => $c->getKey(), 'name' => $c->name])
                    ->values()
                    ->all(),
            ]);

        // Statistik WAJIB memakai cakupan yang sama dengan daftarnya. Kalau tidak,
        // daftar menampilkan 2 pengguna sementara kartu di atasnya menghitung 6 —
        // angka itu sendiri sudah membocorkan jumlah pengguna perusahaan lain.
        $total = User::query()->memberOfCurrentCompany()->count();
        $active = User::query()->memberOfCurrentCompany()->where('status', 'active')->count();

        $stats = [
            'total' => $total,
            'active' => $active,
            'inactive' => $total - $active,
            'admins' => User::role('admin')->memberOfCurrentCompany()->count(),
            'finance_managers' => User::role('finance manager')->memberOfCurrentCompany()->count(),
        ];

        $roleOptions = Role::orderBy('name')->get()->map(fn ($r) => [
            'label' => ucfirst($r->name),
            'value' => $r->name,
        ])->toArray();

        return Inertia::render('users/index', [
            'users' => $users,
            'stats' => $stats,
            'roleOptions' => $roleOptions,
            'companyOptions' => $this->perusahaanSeorganisasi()
                ->map(fn (Company $c) => ['value' => $c->getKey(), 'label' => $c->name])
                ->values()
                ->all(),
            'filters' => [
                'search' => $search,
                'role' => $role,
                'status' => $status,
                'per_page' => $perPage,
                'sort' => $sort,
                'direction' => $direction,
            ],
        ]);
    }

    public function store(StoreUserRequest $request): RedirectResponse
    {
        $this->authorize('manage users');

        $validated = $request->validated();

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone_number' => $validated['phone_number'] ?? null,
            'status' => $validated['status'],
            'password' => Hash::make($validated['password']),
            'email_verified_at' => now(),
        ]);

        $user->organization()->associate(auth()->user()->organization_id)->save();

        $this->terapkanKeanggotaan($user, $validated['companies'] ?? null, $validated['role']);

        return redirect()->back()->with('success', __('Pengguna berhasil ditambahkan.'));
    }

    /**
     * Setel keanggotaan perusahaan sekaligus perannya di tiap perusahaan.
     *
     * Peran di aplikasi ini per-perusahaan (Spatie teams, team key = slug), jadi
     * menambahkan seseorang ke perusahaan TANPA memberi peran di sana menghasilkan
     * akun yang bisa masuk tetapi tidak boleh melakukan apa pun — kebingungan yang
     * terlihat seperti bug. Karena itu peran yang dipilih diterapkan ke SETIAP
     * perusahaan yang dicentang.
     *
     * Batas v1 yang disengaja: satu peran untuk semua perusahaan yang dipilih,
     * mengikuti bentuk formulir yang sudah ada. Peran berbeda per perusahaan masih
     * mungkin lewat `central:import-users` atau dengan menyunting dua kali.
     *
     * @param  list<string>|null  $slugDipilih  null = pertahankan yang sekarang
     *                                          (atau perusahaan aktif untuk user baru)
     */
    private function terapkanKeanggotaan(User $user, ?array $slugDipilih, string $peran): void
    {
        $diizinkan = $this->perusahaanSeorganisasi()->map(fn (Company $c) => (string) $c->getKey())->all();
        $aktif = (string) (tenant()?->getTenantKey() ?? '');

        $target = $slugDipilih === null
            ? ($user->exists && $user->companies()->exists()
                ? $user->companies()->pluck('companies.id')->map(fn ($s) => (string) $s)->all()
                : array_filter([$aktif]))
            : array_values(array_intersect(array_map('strval', $slugDipilih), $diizinkan));

        // LAPIS KEDUA. Daftar yang dikirim tetapi habis setelah disaring BUKAN
        // perintah "keluarkan dari semua perusahaan" — itu permintaan yang
        // seluruh isinya tidak sah. Membiarkannya lolos ke sync() di bawah akan
        // MENGHAPUS seluruh keanggotaan pengguna. Validasi di StoreUserRequest
        // sudah menolaknya lebih dulu; ini jaring kalau ada pemanggil lain.
        if ($slugDipilih !== null && $target === []) {
            abort(422, __('Tidak ada perusahaan sah yang dipilih. Keanggotaan tidak diubah.'));
        }

        // Jangan pernah mengeluarkan diri sendiri dari perusahaan yang sedang dibuka:
        // request berikutnya akan ditolak EnsureUserBelongsToCompany dan admin terkunci
        // di luar pintu yang baru saja ia tutup sendiri.
        if ($user->id === auth()->id() && $aktif !== '' && ! in_array($aktif, $target, true)) {
            $target[] = $aktif;
        }

        // sync(), bukan syncWithoutDetaching(): mencabut keanggotaan harus bisa juga.
        // Perusahaan di LUAR organisasi ini tidak pernah ada di $diizinkan, jadi tidak
        // ikut terhapus oleh sync — keanggotaan lintas organisasi (kalau ada) aman.
        $diluar = $user->companies()->pluck('companies.id')
            ->map(fn ($s) => (string) $s)
            ->reject(fn (string $s) => in_array($s, $diizinkan, true))
            ->all();

        $user->companies()->sync(array_values(array_unique([...$target, ...$diluar])));

        $sebelumnya = getPermissionsTeamId();

        // Peran WAJIB ikut dicabut dari perusahaan yang keanggotaannya dilepas.
        // Peran per-perusahaan hidup di tabel pivot Spatie, terpisah dari
        // company_user — melepas keanggotaan saja meninggalkan baris peran yang
        // yatim, dan peran itu hidup kembali begitu orangnya ditugaskan ulang ke
        // perusahaan tersebut. Ditemukan QC 2026-11-03.
        foreach (array_diff($diizinkan, $target) as $slug) {
            setPermissionsTeamId($slug);
            $user->unsetRelation('roles')->unsetRelation('permissions');
            $user->syncRoles([]);
        }

        foreach ($target as $slug) {
            setPermissionsTeamId($slug);
            $user->unsetRelation('roles')->unsetRelation('permissions');
            $user->syncRoles([$peran]);
        }

        setPermissionsTeamId($sebelumnya);
        $user->unsetRelation('roles')->unsetRelation('permissions');

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    /**
     * Perusahaan yang berada di organisasi yang sama dengan perusahaan aktif.
     *
     * Ini BATAS WEWENANG penugasan: admin hanya boleh memindah-mindahkan orang di
     * dalam grupnya sendiri. Tanpa batas ini, siapa pun yang punya `manage users`
     * di satu perusahaan bisa menitipkan dirinya ke perusahaan milik organisasi
     * lain hanya dengan mengirim slug-nya — dan `users` hidup di database pusat,
     * jadi slug perusahaan lain memang terjangkau dari sini.
     *
     * @return Collection<int, Company>
     */
    private function perusahaanSeorganisasi(): Collection
    {
        $aktif = tenant();

        if (! $aktif) {
            return new Collection;
        }

        return Company::query()
            ->where('organization_id', $aktif->organization_id)
            ->orderBy('name')
            ->get();
    }

    /**
     * Pengguna perusahaan lain tidak boleh disentuh.
     *
     * `authorize('manage users')` memeriksa IZIN, bukan KEANGGOTAAN — dan
     * route-model binding memuat baris `users` apa pun berdasarkan id, karena
     * tabel itu hidup di database CENTRAL. Tanpa penjaga ini, admin PT A dapat
     * mengubah data, mengganti sandi, mengganti role, dan MENGHAPUS pengguna
     * PT B. Terbukti di QA dua perusahaan: PUT ke id pengguna perusahaan lain
     * menjawab 422 (validasi sudah berjalan), bukan 404 — artinya barisnya
     * benar-benar ditemukan dan hampir diproses.
     *
     * Khusus `syncRoles`: di bawah Spatie teams ia menulis role pada team yang
     * AKTIF, jadi mengedit pengguna perusahaan lain tidak hanya mengubah
     * datanya, tetapi juga menanamkan role perusahaan ini padanya.
     *
     * 404, bukan 403: keberadaan pengguna perusahaan lain bukan informasi yang
     * perlu dibocorkan.
     */
    private function pastikanAnggotaPerusahaanAktif(User $user): void
    {
        abort_unless(
            User::query()->memberOfCurrentCompany()->whereKey($user->getKey())->exists(),
            404
        );
    }

    public function update(UpdateUserRequest $request, User $user): RedirectResponse
    {
        $this->authorize('manage users');
        $this->pastikanAnggotaPerusahaanAktif($user);

        $validated = $request->validated();

        $user->update([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone_number' => $validated['phone_number'] ?? null,
            'status' => $validated['status'],
        ]);

        if (! empty($validated['password'])) {
            $user->update(['password' => Hash::make($validated['password'])]);
        }

        // syncRoles() sendirian hanya menyentuh team yang AKTIF. Lewat
        // terapkanKeanggotaan(), perannya ikut diterapkan ke setiap perusahaan yang
        // dicentang — kalau tidak, menambahkan orang ke PT kedua menghasilkan akun
        // yang bisa masuk ke sana tetapi tanpa izin apa pun.
        $this->terapkanKeanggotaan($user, $validated['companies'] ?? null, $validated['role']);

        return redirect()->back()->with('success', __('Pengguna berhasil diperbarui.'));
    }

    public function destroy(User $user): RedirectResponse
    {
        $this->authorize('manage users');
        $this->pastikanAnggotaPerusahaanAktif($user);

        if ($user->id === auth()->id()) {
            return redirect()->back()->with('error', __('Anda tidak dapat menghapus akun sendiri.'));
        }

        $user->delete();

        return redirect()->back()->with('success', __('Pengguna berhasil dihapus.'));
    }

    public function bulkDestroy(BulkDestroyUserRequest $request): RedirectResponse
    {
        $this->authorize('manage users');

        $validated = $request->validated();

        // Saring ke anggota perusahaan aktif LEBIH DULU, lalu hitung dari hasil
        // saringan itu. `User::whereIn('id', $ids)->delete()` tanpa cakupan ini
        // adalah penghapusan massal lintas perusahaan: satu request bisa
        // menghapus seluruh pengguna PT lain, dan pesan suksesnya akan
        // melaporkan jumlah yang tidak sesuai dengan yang benar-benar terhapus.
        $ids = User::query()
            ->memberOfCurrentCompany()
            ->whereIn('id', array_diff($validated['ids'], [auth()->id()]))
            ->pluck('id')
            ->all();

        $count = count($ids);

        if ($count === 0) {
            return redirect()->back()->with('error', __('Tidak ada pengguna yang dapat dihapus.'));
        }

        User::whereIn('id', $ids)->delete();

        return redirect()->back()->with('success', __('Berhasil menghapus :count pengguna.', ['count' => $count]));
    }
}
