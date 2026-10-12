import type { ModuleGuide } from '@video/guide';
import type { RoleKey } from '@video/roles';

/*
 * Aturan siapa melihat apa di panduan & tutorial (keputusan user 12 Okt 2026: "semua, sesuai izin").
 * Panduan bukan data rahasia — ini hanya agar tiap orang tidak dibanjiri hal yang tidak bisa ia lakukan.
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

/** Modul tampil di /panduan bila pengguna punya salah satu izin "view"-nya. */
export function canViewGuide(guide: ModuleGuide, permissions: string[]): boolean {
    if (!guide.permission || (Array.isArray(guide.permission) && guide.permission.length === 0)) return true;
    const needed = Array.isArray(guide.permission) ? guide.permission : [guide.permission];
    return needed.some((p) => permissions.includes(p));
}

/** Bagian dampak, data otomatis, dan peringatan — default hanya untuk admin. */
export function seesInsights(guide: ModuleGuide, roles: string[]): boolean {
    return (guide.insightRoles ?? ['admin']).some((r) => roles.includes(r));
}
