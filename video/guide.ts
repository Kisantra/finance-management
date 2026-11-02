import type { Role, Tone } from './roles';

/*
 * Isi panduan satu modul — SATU sumber untuk halaman /panduan dan adegan video (scenes.tsx).
 * Tanpa impor 'remotion' (dimuat langsung oleh halaman panduan).
 *
 * Teks boleh memakai **tebal** (dirender oleh <Rich>). Tulis dari sisi pengguna, bahasa Indonesia,
 * istilah sesuai label di layar. Setiap klaim harus sesuai kode (bukan asumsi).
 */

export interface GuideRoleCard {
    role: Role;
    /** Sebutan peran di modul ini, mis. "Pemohon", "Peninjau & pembayar". */
    who: string;
    can: string[];
    cannot?: string[];
}

export interface GuideFlowStep {
    /** Label status persis seperti di layar, mis. "Menunggu review". */
    label: string;
    tone: Tone;
    role: Role;
    /** Apa yang dilakukan role itu untuk mencapai status ini. */
    what: string;
}

export interface GuideFlow {
    steps: GuideFlowStep[];
    /** Cabang ke bawah dari langkah `from` (mis. ditolak → diperbaiki → diajukan ulang). */
    branch?: { from: number; label: string; tone: Tone; title: string; down: string; up?: string };
    note?: string;
}

export interface GuideTask {
    title: string;
    role: Role;
    steps: string[];
}

export interface GuideImpact {
    /** Mis. "Saat disetujui", "Saat dibayar". */
    title: string;
    tone: Tone;
    items: string[];
}

export interface GuideRecord {
    /** Mis. "Transaksi bank yang dibuat otomatis". */
    title: string;
    subtitle?: string;
    rows: { label: string; value: string; source: string; tone?: Tone }[];
    note?: string;
}

export interface ModuleGuide {
    slug: string;
    title: string;
    /** Kelompok menu (sama dengan rel navigasi): Ringkasan, Keuangan, Arus Kas, Operasional, ... */
    group: string;
    /** Urutan di dalam kelompok (kecil = atas). Default 100. */
    order?: number;
    /** URL halaman modul di aplikasi. */
    path: string;
    /** Izin "view" modul; array = cukup salah satu. Kosong = semua pengguna. */
    permission?: string | string[];
    summary: string;
    roles: GuideRoleCard[];
    flow?: GuideFlow;
    tasks: GuideTask[];
    /** Bagian "Dampak ke modul lain" (untuk insightRoles). */
    impacts?: GuideImpact[];
    records?: GuideRecord[];
    warnings?: { title: string; body: string }[];
    /** Ringkasan hak akses; urutan cells mengikuti `matrixRoles`. */
    matrix?: { action: string; cells: (boolean | string)[] }[];
    matrixRoles?: Role[];
    /** Role Spatie yang melihat dampak/catatan/peringatan di halaman panduan. Default: ['admin']. */
    insightRoles?: string[];
    /** Video "sekilas" (MP4 di public/, mis. video peluncuran) — tab pertama di panggung video /panduan. */
    overview?: { src: string; poster: string; seconds: number };
}
