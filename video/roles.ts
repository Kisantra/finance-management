/*
 * Peran & nada warna — dipakai bersama oleh video (Remotion) dan halaman /panduan.
 * Sengaja tanpa impor 'remotion' agar halaman panduan bisa memuatnya tanpa ikut mengunduh Remotion.
 */

export type RoleKey = 'staff' | 'fm' | 'admin';

/** Nada warna token Obsidian (sama dengan StatusPill). */
export type Tone = 'act' | 'pos' | 'neg' | 'wait' | 'late' | 'neutral';

export interface Role {
    key: RoleKey;
    label: string;
    /** Nama role Spatie di aplikasi. */
    spatie: string;
    tone: Tone;
}

export const ROLES: Record<RoleKey, Role> = {
    staff: { key: 'staff', label: 'Staff', spatie: 'staff', tone: 'act' },
    fm: { key: 'fm', label: 'Finance manager', spatie: 'finance manager', tone: 'pos' },
    admin: { key: 'admin', label: 'Admin', spatie: 'admin', tone: 'neg' },
};

export const TONE_CLASS: Record<Tone, { dot: string; chip: string }> = {
    act: { dot: 'bg-ob-act', chip: 'bg-ob-act/15 text-ob-act' },
    pos: { dot: 'bg-ob-pos', chip: 'bg-ob-pos/15 text-ob-pos' },
    neg: { dot: 'bg-ob-neg', chip: 'bg-ob-neg/15 text-ob-neg' },
    wait: { dot: 'bg-ob-wait', chip: 'bg-ob-wait/15 text-ob-wait' },
    late: { dot: 'bg-ob-late', chip: 'bg-ob-late/15 text-ob-late' },
    neutral: { dot: 'bg-ob-ink-3', chip: 'bg-ob-chip text-ob-ink-2' },
};
