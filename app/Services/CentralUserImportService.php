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
     * ID user lama DIPERTAHANKAN bila baris membawa `id`. Tabel bisnis di database
     * tenant menyimpan ID user sebagai angka tanpa FK (user hidup di database pusat):
     * reimbursements.user_id/reviewed_by/paid_by, fund_requests.*, receivables
     * approved_by + debtor polimorfik. ID baru dari auto-increment membuat semua
     * catatan itu diam-diam menunjuk orang lain. Bentrok ID apa pun membatalkan
     * impor sebelum satu baris pun ditulis.
     *
     * @param  list<array{id?: int, name: string, email: string, password: string, phone_number?: ?string, status?: ?string, locale?: ?string, role?: ?string}>  $rows
     * @return array{imported: int, existing: int, memberships: int, roles_skipped: array<string, list<string>>, id_conflicts: list<string>}
     */
    public function import(array $rows, Organization $organization, Company $company): array
    {
        $imported = 0;
        $existing = 0;
        $memberships = 0;
        $rolesSkipped = [];

        $bentrok = $this->idConflicts($rows);
        if ($bentrok !== []) {
            return ['imported' => 0, 'existing' => 0, 'memberships' => 0, 'roles_skipped' => [], 'id_conflicts' => $bentrok];
        }

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
                    if (isset($row['id'])) {
                        // incrementing=false: Eloquent memakai ID ini apa adanya,
                        // bukan menimpanya dengan hasil lastInsertId.
                        $user->id = (int) $row['id'];
                        $user->incrementing = false;
                    }
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
            'id_conflicts' => [],
        ];
    }

    /**
     * Baris ber-`id` yang tidak bisa diimpor dengan ID-nya sendiri: email sudah
     * ada di pusat dengan ID lain, atau ID-nya sudah dipakai email lain.
     *
     * @param  list<array<string, mixed>>  $rows
     * @return list<string>
     */
    public function idConflicts(array $rows): array
    {
        $idPerEmail = collect($rows)
            ->filter(fn (array $row): bool => isset($row['id']))
            ->mapWithKeys(fn (array $row): array => [strtolower($row['email']) => (int) $row['id']]);

        if ($idPerEmail->isEmpty()) {
            return [];
        }

        $pusat = User::query()
            ->whereIn('email', $idPerEmail->keys())
            ->orWhereIn('id', $idPerEmail->values())
            ->get(['id', 'email']);

        $bentrok = [];

        foreach ($idPerEmail as $email => $id) {
            $pemilikEmail = $pusat->first(fn (User $user): bool => strtolower($user->email) === $email);
            $pemilikId = $pusat->firstWhere('id', $id);

            if ($pemilikEmail && $pemilikEmail->id !== $id) {
                $bentrok[] = "{$email}: ID lama {$id}, di pusat sudah ber-ID {$pemilikEmail->id}";
            } elseif (! $pemilikEmail && $pemilikId) {
                $bentrok[] = "{$email}: ID lama {$id} sudah dipakai {$pemilikId->email}";
            }
        }

        return $bentrok;
    }
}
