import * as React from 'react';
import { Series } from 'remotion';
import { type Role, type Step, Walkthrough, walkthroughDuration } from '../components/walkthrough';
import { BackgroundMusic, Sfx } from '../sfx';
import { Anatomy, ChapterCard, Flow, Impact, Intro, Outro, Recap, Roles, Warnings } from './scenes';
import { ADMIN_IMPACT_STEPS, ADMIN_STEPS, FM_STEPS, REJECT_FM_STEPS, REJECT_STAFF_STEPS, ROLES, STAFF_STEPS } from './steps';

/*
 * Satu video pendek per role (tab di dialog tutorial halaman Reimbursement).
 * Scene ber-`chapter` menjadi tombol bab di Player aplikasi.
 */

interface Scene {
    id: string;
    frames: number;
    node: React.ReactNode;
    chapter?: string;
}

export interface Tutorial {
    /** Id komposisi Remotion (Studio / render). */
    id: string;
    role: Role;
    component: React.FC;
    frames: number;
    chapters: { label: string; frame: number }[];
}

const walk = (id: string, steps: Step[], role: Role, chapter?: string): Scene => ({ id, frames: walkthroughDuration(steps), node: <Walkthrough steps={steps} role={role} />, chapter });
const card = (id: string, role: Role, part: number, total: number, title: string, summary: string, chapter: string): Scene => ({
    id,
    frames: 75,
    node: <ChapterCard part={part} total={total} role={role} title={title} summary={summary} />,
    chapter,
});

function build(id: string, role: Role, scenes: Scene[]): Tutorial {
    const starts = scenes.map((_, i) => scenes.slice(0, i).reduce((n, s) => n + s.frames, 0));
    const component: React.FC = () => (
        <>
            <BackgroundMusic />
            <Series>
                {scenes.map((scene, i) => (
                    <Series.Sequence key={scene.id} durationInFrames={scene.frames} name={scene.id}>
                        {i > 0 && <Sfx name="whoosh" at={0} frames={18} />}
                        {scene.node}
                    </Series.Sequence>
                ))}
            </Series>
        </>
    );
    component.displayName = id;
    return {
        id,
        role,
        component,
        frames: scenes.reduce((n, s) => n + s.frames, 0),
        chapters: scenes.flatMap((s, i) => (s.chapter ? [{ label: s.chapter, frame: starts[i] }] : [])),
    };
}

const outro: Scene = { id: 'outro', frames: 90, node: <Outro /> };

export const STAFF_TUTORIAL = build('ReimbursementStaff', ROLES.staff, [
    { id: 'intro', frames: 105, node: <Intro role={ROLES.staff} title="Mengajukan penggantian biaya" summary="Dari mencatat struk sampai uangnya kembali ke rekening Anda." />, chapter: 'Pengantar' },
    { id: 'flow', frames: 330, node: <Flow />, chapter: 'Alur' },
    walk('walk-create', STAFF_STEPS, ROLES.staff, 'Membuat pengajuan'),
    card('chapter-reject', ROLES.staff, 2, 2, 'Bila pengajuan ditolak', 'Lihat alasannya, perbaiki, lalu ajukan ulang.', 'Bila ditolak'),
    walk('walk-reject', REJECT_STAFF_STEPS, ROLES.staff),
    outro,
]);

export const FM_TUTORIAL = build('ReimbursementFinanceManager', ROLES.fm, [
    { id: 'intro', frames: 105, node: <Intro role={ROLES.fm} title="Meninjau & membayar reimbursement" summary="Memeriksa bukti, menyetujui atau menolak, lalu membayar dari rekening bank." />, chapter: 'Pengantar' },
    { id: 'flow', frames: 330, node: <Flow />, chapter: 'Alur' },
    walk('walk-review', FM_STEPS, ROLES.fm, 'Menyetujui & membayar'),
    card('chapter-reject', ROLES.fm, 2, 2, 'Menolak pengajuan', 'Selalu sertakan alasan agar pemohon tahu yang harus diperbaiki.', 'Menolak'),
    walk('walk-reject', REJECT_FM_STEPS, ROLES.fm),
    outro,
]);

export const ADMIN_TUTORIAL = build('ReimbursementAdmin', ROLES.admin, [
    { id: 'intro', frames: 105, node: <Intro role={ROLES.admin} title="Akses penuh & dampaknya" summary="Apa yang berubah di rekening, arus kas, dan laporan saat reimbursement disetujui dan dibayar." />, chapter: 'Pengantar' },
    { id: 'roles', frames: 330, node: <Roles />, chapter: 'Tiga peran' },
    { id: 'impact', frames: 330, node: <Impact />, chapter: 'Dampak' },
    { id: 'anatomy', frames: 300, node: <Anatomy />, chapter: 'Transaksi bank' },
    walk('walk-impact', ADMIN_IMPACT_STEPS, ROLES.admin, 'Jejak di modul lain'),
    { id: 'warnings', frames: 330, node: <Warnings />, chapter: 'Perhatian' },
    walk('walk-admin', ADMIN_STEPS, ROLES.admin, 'Hapus pengajuan'),
    { id: 'recap', frames: 300, node: <Recap />, chapter: 'Ringkasan hak akses' },
    outro,
]);

export const REIMBURSEMENT_TUTORIALS = { staff: STAFF_TUTORIAL, fm: FM_TUTORIAL, admin: ADMIN_TUTORIAL };
