<?php

/**
 * Kerangka lingkungan QC: dua perusahaan + empat akun berperan berbeda.
 *
 * SENGAJA tidak membuat data bisnis (invoice, pinjaman, reimbursement, dst).
 * Penguji modul yang membuatnya sendiri — hanya ia yang tahu kombinasi status
 * apa yang perlu diuji, dan fixture yang ditebak dari jauh cenderung menguji
 * keadaan yang tidak mungkin terjadi di produksi.
 *
 * Dipanggil oleh docs/qa/siapkan-lingkungan-qc.sh. Idempoten.
 */

use App\Models\Company;
use App\Models\Organization;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\PermissionRegistrar;

// Bootstrap HARUS di bawah seluruh `use`: pernyataan use hanya berlaku untuk
// kode SETELAHNYA, dan Pint menyusun ulang blok import.
require __DIR__.'/../../vendor/autoload.php';

$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

[$slug, $slugA, $slugB] = [$argv[1] ?? null, $argv[2] ?? null, $argv[3] ?? null];

if (! $slug || ! $slugA || ! $slugB) {
    fwrite(STDERR, "Pakai: php docs/qa/isi-kerangka-qc.php <slug> <slugA> <slugB>\n");
    exit(1);
}

// ------------------------------------------------------------------ PENJAGA -
$pusat = config('database.connections.mysql.database');
if (! preg_match('/^qc[a-z0-9]{1,6}_central$/', (string) $pusat)) {
    fwrite(STDERR, "TOLAK: DB_DATABASE='{$pusat}' bukan database QC. Dihentikan sebelum menulis apa pun.\n");
    exit(1);
}

$org = Organization::where('slug', 'grup-qc-'.$slug)->first()
    ?? Organization::orderBy('id')->firstOrFail();

// ------------------------------------------------------- dua perusahaan -----
$spek = [
    [$slugA, 'PT Satu QC'.strtoupper($slug), 'S'.strtoupper($slug)],
    [$slugB, 'PT Dua QC'.strtoupper($slug), 'D'.strtoupper($slug)],
];

foreach ($spek as [$id, $nama, $singkatan]) {
    if (Company::find($id)) {
        echo "perusahaan sudah ada: {$id}\n";

        continue;
    }

    // Company::create() memicu CreateDatabase -> MigrateDatabase -> SeedDatabase
    // -> MarkCompanyActive. Master data (kategori transaksi, profil) ikut terisi.
    $c = Company::create([
        'id' => $id,
        'organization_id' => $org->id,
        'name' => $nama,
        'abbreviation' => $singkatan,
    ]);

    echo "perusahaan dibuat: {$id} ({$nama}) status={$c->fresh()->status}\n";
}

$semua = [$slugA, $slugB];

// ------------------------------------------------------------ empat akun ----
foreach (['admin', 'finance manager', 'staff'] as $peran) {
    Role::firstOrCreate(['name' => $peran]);
}

// `view dashboard` menentukan ke mana pengguna mendarat setelah memilih
// perusahaan; tanpa itu staff terkunci di luar dashboard dan setiap test
// alur gagal karena alasan yang tidak ada hubungannya dengan modulnya.
$sebelumnya = getPermissionsTeamId();
setPermissionsTeamId(null);
Role::where('name', 'staff')->first()
    ?->givePermissionTo(Permission::firstOrCreate(['name' => 'view dashboard']));
setPermissionsTeamId($sebelumnya);

$akun = [
    ["qc{$slug}-admin@qc.test", 'QC Admin', 'admin', $semua],
    ["qc{$slug}-fm@qc.test", 'QC Finance Manager', 'finance manager', $semua],
    ["qc{$slug}-staff@qc.test", 'QC Staff', 'staff', [$slugA]],
    // Hanya di perusahaan KEDUA: dipakai menguji akses silang — ia harus
    // ditolak di mana pun yang bukan miliknya.
    ["qc{$slug}-luar@qc.test", 'QC Orang Luar', 'admin', [$slugB]],
];

foreach ($akun as [$email, $nama, $peran, $perusahaan]) {
    $u = User::firstOrCreate(
        ['email' => $email],
        [
            'name' => $nama,
            'status' => 'active',
            'password' => Hash::make('QcUji#2026'),
            'email_verified_at' => now(),
        ]
    );

    $u->organization()->associate($org->id)->save();
    $u->companies()->sync($perusahaan);

    foreach ($perusahaan as $pt) {
        setPermissionsTeamId($pt);
        $u->unsetRelation('roles')->unsetRelation('permissions');
        $u->syncRoles([$peran]);
    }

    setPermissionsTeamId(null);
    $u->unsetRelation('roles')->unsetRelation('permissions');

    echo "akun: {$email} ({$peran}) -> ".implode(', ', $perusahaan)."\n";
}

app(PermissionRegistrar::class)->forgetCachedPermissions();

echo 'perusahaan terdaftar: '.Company::count().', pengguna: '.User::count()."\n";
