<?php
/**
 * Pengguna tambahan untuk D.3.5: peran BERBEDA di tiap perusahaan.
 * Tanpa ini uji "izin dihitung per perusahaan" tidak membuktikan apa pun,
 * karena both-manager punya peran yang sama di kedua perusahaan.
 */
require __DIR__.'/../../vendor/autoload.php';
$app = require_once __DIR__.'/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Organization;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

if (! str_starts_with(DB::connection()->getDatabaseName(), 'qa_')) {
    fwrite(STDERR, "PENJAGA: bukan database qa_*\n");
    exit(1);
}

$u = User::firstOrCreate(['email' => 'mixed-roles@qa.test'], [
    'name' => 'Mixed Roles',
    'password' => Hash::make('QaGerbang#2026'),
    'email_verified_at' => now(),
]);
$u->organization_id = Organization::where('slug', 'qa-grup')->value('id');
$u->save();

foreach (['qaalpha' => 'finance manager', 'qabeta' => 'staff'] as $slug => $role) {
    $u->companies()->syncWithoutDetaching([$slug]);
    setPermissionsTeamId($slug);
    $u->unsetRelation('roles');
    if (! $u->hasRole($role)) {
        $u->assignRole($role);
    }
    echo "mixed-roles@qa.test: $slug -> $role\n";
}
setPermissionsTeamId(null);

foreach (['qaalpha', 'qabeta'] as $slug) {
    setPermissionsTeamId($slug);
    $u->unsetRelation('roles');
    $u->unsetRelation('permissions');
    app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();
    echo "  harapan $slug: peran=".$u->roles->pluck('name')->implode(',')
        .' jumlah_izin='.$u->getAllPermissions()->count()."\n";
}
setPermissionsTeamId(null);
