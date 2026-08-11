<?php

namespace App\Services;

use App\Models\Company;
use App\Models\Organization;
use App\Models\User;

class CentralUserImportService
{
    /**
     * Impor user dari deployment lama ke database pusat — idempoten:
     * user di-match by email (password hash existing dipertahankan),
     * keanggotaan & role per perusahaan di-sync tanpa duplikasi.
     *
     * @param  list<array{name: string, email: string, password: string, phone_number?: ?string, status?: ?string, locale?: ?string, role?: ?string}>  $rows
     * @return array{imported: int, existing: int, memberships: int}
     */
    public function import(array $rows, Organization $organization, Company $company): array
    {
        $imported = 0;
        $existing = 0;
        $memberships = 0;

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
                    $user->unsetRelation('roles');
                    $user->assignRole($row['role']);
                }
            }
        } finally {
            setPermissionsTeamId($previousTeamId);
        }

        return [
            'imported' => $imported,
            'existing' => $existing,
            'memberships' => $memberships,
        ];
    }
}
