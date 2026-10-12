import type { RoleKey } from '@video/roles';

/*
 * Tab video yang tampil di dialog Tutorial dalam aplikasi (sesuai peran pengguna yang login).
 * Halaman /panduan publik tidak memakai ini: semua orang melihat semua peran (keputusan user 13 Okt 2026).
 */

/** Tab video yang relevan: Admin → semua, Finance manager → Staff + Finance manager, lainnya → Staff. */
export function visibleRoleKeys(roles: string[]): RoleKey[] {
    if (roles.includes('admin')) return ['staff', 'fm', 'admin'];
    if (roles.includes('finance manager')) return ['staff', 'fm'];
    return ['staff'];
}

/** Role tertinggi pengguna — tab yang dibuka pertama. */
export function primaryRoleKey(roles: string[]): RoleKey {
    return visibleRoleKeys(roles).at(-1)!;
}
