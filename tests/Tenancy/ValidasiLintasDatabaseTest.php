<?php

namespace Tests\Tenancy;

use App\Http\Requests\Admin\BulkDestroyUserRequest;
use App\Http\Requests\Admin\StoreCompanyRequest;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Http\Requests\Admin\UpdateUserRequest;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Validator;
use SplFileInfo;
use Symfony\Component\Finder\Finder;
use Tests\TenancyTestCase;

/**
 * Aturan validasi `unique:`/`exists:` menjalankan query pada koneksi DEFAULT.
 * Saat tenancy aktif koneksi default adalah database TENANT - jadi
 * `unique:users` diam-diam memeriksa tabel `users` di dalam database tenant
 * (yang di produksi tidak ada / selalu kosong), bukan daftar user central.
 * Akibatnya: email duplikat lolos validasi, lalu ditolak unique index di level
 * database sebagai HTTP 500.
 *
 * Satu-satunya cara aman adalah menuliskan koneksinya: `unique:mysql.users`.
 */
class ValidasiLintasDatabaseTest extends TenancyTestCase
{
    /**
     * Tabel central yang pernah / mungkin dipakai di aturan validasi.
     *
     * @var list<string>
     */
    private const CENTRAL_TABLES = [
        'users', 'roles', 'permissions', 'organizations', 'companies',
        'company_user', 'app_notifications', 'feedbacks',
    ];

    /**
     * FormRequest admin yang memvalidasi data CENTRAL - semuanya wajib
     * menyebut koneksi central secara eksplisit.
     *
     * @var array<class-string, list<string>>
     */
    private const REQUEST_ADMIN = [
        StoreUserRequest::class => ['unique:mysql.users', 'exists:mysql.roles,name'],
        UpdateUserRequest::class => ['unique:mysql.users,email'],
        BulkDestroyUserRequest::class => ['exists:mysql.users,id'],
        StoreCompanyRequest::class => ['unique:mysql.companies,id'],
    ];

    public function test_formrequest_admin_menyebut_koneksi_central_secara_eksplisit(): void
    {
        foreach (self::REQUEST_ADMIN as $class => $aturan) {
            $sumber = (string) file_get_contents((new \ReflectionClass($class))->getFileName());

            foreach ($aturan as $potongan) {
                $this->assertStringContainsString(
                    $potongan,
                    $sumber,
                    $class." kehilangan aturan \"{$potongan}\" - tanpa prefiks koneksi, validasi ini "
                    .'menjalankan query ke database TENANT saat tenancy aktif.'
                );
            }
        }
    }

    /**
     * Penjaga regresi untuk aturan BARU: tidak boleh ada satu pun `unique:` /
     * `exists:` ke tabel central tanpa prefiks koneksi di seluruh FormRequest
     * dan Controller.
     */
    public function test_tidak_ada_aturan_unique_atau_exists_ke_tabel_central_tanpa_prefiks(): void
    {
        $pelanggaran = [];

        /** @var SplFileInfo $file */
        foreach (Finder::create()->files()->name('*.php')->in([app_path('Http/Requests'), app_path('Http/Controllers')]) as $file) {
            $sumber = (string) file_get_contents($file->getRealPath());

            // "unique:users", "exists:roles,name"
            preg_match_all('/\b(unique|exists):([A-Za-z0-9_.]+)/', $sumber, $gaya1, PREG_SET_ORDER);
            // "Rule::unique('users')", "Rule::exists('roles', 'name')"
            preg_match_all('/Rule::(unique|exists)\(\s*\'([A-Za-z0-9_.]+)\'/', $sumber, $gaya2, PREG_SET_ORDER);

            foreach (array_merge($gaya1, $gaya2) as [, $jenis, $target]) {
                $tabel = explode(',', $target)[0];

                if (str_contains($tabel, '.')) {
                    continue; // sudah menyebut koneksi
                }

                if (in_array($tabel, self::CENTRAL_TABLES, true)) {
                    $pelanggaran[] = $file->getRelativePathname().": {$jenis}:{$tabel}";
                }
            }
        }

        $this->assertSame(
            [],
            $pelanggaran,
            "Aturan validasi ke tabel central tanpa prefiks koneksi:\n  ".implode("\n  ", $pelanggaran)
            ."\nTulis mis. unique:mysql.users - tanpa itu query berjalan di database tenant."
        );
    }

    /**
     * Bukti perilaku, bukan pembacaan kode: dengan tenancy AKTIF, aturan tanpa
     * prefiks menjalankan query ke database TENANT - yang tidak punya tabel
     * `users` sama sekali, jadi permintaannya meledak jadi HTTP 500 alih-alih
     * memeriksa daftar user central. Aturan ber-prefiks bekerja normal.
     */
    public function test_email_duplikat_lolos_tanpa_prefiks_dan_ditolak_dengan_prefiks(): void
    {
        $terpakai = 'duplikat.lintas.db@example.test';
        User::factory()->create(['email' => $terpakai]);

        $this->useTenant(0);

        try {
            Validator::make(['email' => $terpakai], ['email' => 'unique:users,email'])->passes();
            $this->fail(
                'unique:users berjalan tanpa error saat tenancy aktif - berarti koneksi default '
                .'belum berpindah ke database tenant dan test ini tidak membuktikan apa pun.'
            );
        } catch (QueryException $e) {
            $this->assertStringContainsString(
                'tenant_'.$this->slug(0).'.users',
                $e->getMessage(),
                'unique:users gagal, tetapi bukan karena mencari tabel users di database tenant.'
            );
        }

        $this->assertTrue(
            Validator::make(['email' => $terpakai], ['email' => 'unique:mysql.users,email'])->fails(),
            'unique:mysql.users gagal mendeteksi email yang sudah terpakai di database central.'
        );

        // Jalur HTTP sungguhan: admin membuat user dengan email duplikat -> 422, bukan 500.
        $admin = $this->member($this->slug(0));
        $this->siapkanPeranAdmin($admin, $this->slug(0));

        $this->actingAs($admin)
            ->post('/c/'.$this->slug(0).'/admin/users', [
                'name' => 'Nama Duplikat',
                'email' => $terpakai,
                'password' => 'password123',
                'password_confirmation' => 'password123',
                'role' => 'admin',
                'status' => 'active',
            ])
            ->assertSessionHasErrors('email');
    }

    private function siapkanPeranAdmin(User $user, string $slug): void
    {
        $sebelumnya = getPermissionsTeamId();
        setPermissionsTeamId(null);

        $role = Role::firstOrCreate(['name' => 'admin']);
        $role->givePermissionTo(Permission::firstOrCreate(['name' => 'manage users']));

        setPermissionsTeamId($sebelumnya);

        $this->giveRole($user, $slug, 'admin');
    }
}
