import { FlowScene, flowSceneFrames, ImpactScene, impactSceneFrames, Intro, Outro, RecapScene, RecordScene, recordSceneFrames, RolesScene, WarningsScene, warningsSceneFrames } from '../components/scenes';
import { buildTutorial, chapterCard, type Tutorials, walk } from '../components/tutorial';
import { ROLES } from '../roles';
import { guide } from './guide';
import { ADMIN_IMPACT_STEPS, ADMIN_STEPS, FM_STEPS, REJECT_FM_STEPS, REJECT_STAFF_STEPS, STAFF_STEPS } from './steps';

/* Satu video pendek per role (tab di dialog Tutorial & halaman /panduan). Contoh acuan untuk modul lain. */

const flow = guide.flow!;
const outro = { id: 'outro', frames: 90, node: <Outro where="Operasional › Reimbursement" action="Buat pengajuan" /> };
const flowScene = { id: 'flow', frames: flowSceneFrames(flow), node: <FlowScene flow={flow} title="Alur sebuah pengajuan" />, chapter: 'Alur' };

export const TUTORIALS: Tutorials = {
    staff: buildTutorial('ReimbursementStaff', ROLES.staff, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.staff} title="Mengajukan penggantian biaya" summary="Dari mencatat struk sampai uangnya kembali ke rekening Anda." />, chapter: 'Pengantar' },
        flowScene,
        walk('walk-create', STAFF_STEPS, ROLES.staff, 'Membuat pengajuan'),
        chapterCard('chapter-reject', ROLES.staff, 2, 2, 'Bila pengajuan ditolak', 'Lihat alasannya, perbaiki, lalu ajukan ulang.', 'Bila ditolak'),
        walk('walk-reject', REJECT_STAFF_STEPS, ROLES.staff),
        outro,
    ]),
    fm: buildTutorial('ReimbursementFinanceManager', ROLES.fm, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.fm} title="Meninjau & membayar reimbursement" summary="Memeriksa bukti, menyetujui atau menolak, lalu membayar dari rekening bank." />, chapter: 'Pengantar' },
        flowScene,
        walk('walk-review', FM_STEPS, ROLES.fm, 'Menyetujui & membayar'),
        chapterCard('chapter-reject', ROLES.fm, 2, 2, 'Menolak pengajuan', 'Selalu sertakan alasan agar pemohon tahu yang harus diperbaiki.', 'Menolak'),
        walk('walk-reject', REJECT_FM_STEPS, ROLES.fm),
        outro,
    ]),
    admin: buildTutorial('ReimbursementAdmin', ROLES.admin, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.admin} title="Akses penuh & dampaknya" summary="Apa yang berubah di rekening, arus kas, dan laporan saat reimbursement disetujui dan dibayar." />, chapter: 'Pengantar' },
        { id: 'roles', frames: 330, node: <RolesScene cards={guide.roles} title="Tiga peran di modul ini" />, chapter: 'Tiga peran' },
        { id: 'impact', frames: impactSceneFrames(guide.impacts!), node: <ImpactScene impacts={guide.impacts!} subtitle="Menyetujui belum memindahkan uang. Membayar yang mengubah rekening dan laporan." />, chapter: 'Dampak' },
        { id: 'record', frames: recordSceneFrames(guide.records![0]), node: <RecordScene record={guide.records![0]} />, chapter: 'Transaksi bank' },
        walk('walk-impact', ADMIN_IMPACT_STEPS, ROLES.admin, 'Jejak di modul lain'),
        { id: 'warnings', frames: warningsSceneFrames(guide.warnings!.length), node: <WarningsScene warnings={guide.warnings!} />, chapter: 'Perhatian' },
        walk('walk-admin', ADMIN_STEPS, ROLES.admin, 'Hapus pengajuan'),
        { id: 'recap', frames: 300, node: <RecapScene guide={guide} />, chapter: 'Ringkasan hak akses' },
        outro,
    ]),
};
