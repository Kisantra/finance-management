<?php

namespace App\Services;

use App\Models\Company;
use App\Models\Organization;
use App\Models\User;
use Spatie\Permission\Models\Role;

class CentralUserImportService
{
    /**
     * Impor user dari deployment lama ke database pusat — idempoten:
     * user di-match by email (password hash existing dipertahankan),
     * keanggotaan & role per perusahaan di-sync tanpa duplikasi.
     *
     * Role yang tidak dikenal TIDAK menghentikan impor. Deployment lama kerap
     * menyimpan role sisa eksperimen (`staff_test`, `admin_t`, …) yang tidak
     * ada di sistem baru; membiarkan Spatie melempar RoleDoesNotExist akan
     * menghentikan cutover di tengah jalan dengan sebagian user sudah masuk dan
     * sebagian belum. Role semacam itu dilewati dan dilaporkan, supaya operator
     * yang memutuskan — bukan proses yang mati.
     *
     * @param  list<array{name: string, email: string, password: string, phone_number?: ?string, status?: ?string, locale?: ?string, role?: ?string}>  $rows
     * @return array{imported: int, existing: int, memberships: int, roles_skipped: array<string, list<string>>}
     */
    public function import(array $rows, Organization $organization, Company $company): array
    {
        $imported = 0;
        $existing = 0;
        $memberships = 0;
        $rolesSkipped = [];

        $roleTersedia = Role::query()
            ->where('guard_name', 'web')
            ->pluck('name')
            ->all();

        $previousTeamId = getPermissionsTeamId();
        setPermissionsTeamId($company->getTenantKey());

        try {
            foreach ($rows as $row) {
                $user = User::where('email', $row['email'])->first();

                if ($user) {
                    $existing++;
                } else {
                    $user = new User([
                        'name' => $row['name'],
                        'email' => $row['email'],
                        'phone_number' => $row['phone_number'] ?? null,
                        'status' => $row['status'] ?? 'active',
                        'locale' => $row['locale'] ?? 'id',
                    ]);
                    $user->forceFill([
                        'password' => $row['password'],
                        'email_verified_at' => now(),
                    ]);
                    $imported++;
                }

                if ($user->organization_id === null) {
                    $user->organization()->associate($organization->id);
                }
                $user->save();

                $attached = $user->companies()->syncWithoutDetaching([$company->getTenantKey()]);
                $memberships += count($attached['attached']);

                if (! empty($row['role'])) {
                    if (in_array($row['role'], $roleTersedia, true)) {
                        $user->unsetRelation('roles');
                        $user->assignRole($row['role']);
                    } else {
                        $rolesSkipped[$row['role']][] = $row['email'];
                    }
                }
            }
        } finally {
            setPermissionsTeamId($previousTeamId);
        }

        return [
            'imported' => $imported,
            'existing' => $existing,
            'memberships' => $memberships,
            'roles_skipped' => $rolesSkipped,
        ];
    }
}
