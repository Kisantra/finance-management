<?php

namespace App\Mcp;

use App\Models\Company;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

/**
 * Satu-satunya penentu "boleh membaca lewat Claude": dipakai alat MCP dan halaman
 * persetujuan OAuth agar keduanya tidak pernah berbeda pendapat.
 *
 * Izin Spatie di aplikasi ini per perusahaan (teams), sehingga setiap cek WAJIB
 * memasang team perusahaan itu lebih dulu, lalu memulihkannya. Tanpa team, user
 * tidak punya peran apa pun dan setiap cek bernilai false (gagal-tertutup).
 */
class AksesClaude
{
    /** Izin untuk menghubungkan Claude; bawaannya admin & finance manager. */
    public const IZIN = 'use claude';

    /**
     * Perusahaan aktif tempat user menjadi anggota DAN memegang izin koneksi Claude.
     *
     * @return Collection<int, Company>
     */
    public function perusahaan(User $user): Collection
    {
        return $user->companies()
            ->where('status', 'active')
            ->orderBy('name')
            ->get()
            ->filter(fn (Company $company) => $this->boleh($user, $company))
            ->values();
    }

    /** Anggota perusahaan + izin koneksi Claude + (bila diberikan) izin modul di perusahaan itu. */
    public function boleh(User $user, Company $company, ?string $izinModul = null): bool
    {
        if ($company->status !== 'active' || ! $user->companies()->whereKey($company->getKey())->exists()) {
            return false;
        }

        return $this->dalamTim($user, (string) $company->getKey(), fn () => $user->checkPermissionTo(self::IZIN)
            && ($izinModul === null || $user->checkPermissionTo($izinModul)));
    }

    /** Peran user di perusahaan itu (nama peran pertama), untuk ditampilkan. */
    public function peran(User $user, Company $company): ?string
    {
        return $this->dalamTim($user, (string) $company->getKey(), fn () => $user->getRoleNames()->first());
    }

    /**
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    private function dalamTim(User $user, string $team, callable $callback): mixed
    {
        $sebelumnya = getPermissionsTeamId();
        setPermissionsTeamId($team);
        $user->unsetRelation('roles')->unsetRelation('permissions');

        try {
            return $callback();
        } finally {
            setPermissionsTeamId($sebelumnya);
            $user->unsetRelation('roles')->unsetRelation('permissions');
        }
    }
}
