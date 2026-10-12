import { FlowScene, flowSceneFrames, ImpactScene, impactSceneFrames, Intro, Outro, RecapScene, RecordScene, recordSceneFrames, RolesScene, WarningsScene, warningsSceneFrames } from '../components/scenes';
import { buildTutorial, chapterCard, type Tutorials, walk } from '../components/tutorial';
import { ROLES } from '../roles';
import { guide } from './guide';
import { ADMIN_IMPACT_STEPS, ADMIN_STEPS, FM_STEPS, PAY_STEPS, REJECT_FM_STEPS, REJECT_STAFF_STEPS, STAFF_STEPS } from './steps';

const flow = guide.flow!;
const outro = { id: 'outro', frames: 90, node: <Outro where="Utang & Piutang › Piutang" action="Tambah Piutang" /> };
const flowScene = { id: 'flow', frames: flowSceneFrames(flow), node: <FlowScene flow={flow} title="Alur sebuah piutang" />, chapter: 'Alur' };
const [disbursed, installment] = guide.records!;

export const TUTORIALS: Tutorials = {
    staff: buildTutorial('ReceivablesStaff', ROLES.staff, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.staff} title="Mengajukan kasbon" summary="Mengisi pengajuan pinjaman karyawan, lalu mengirimnya ke finance untuk disetujui." />, chapter: 'Pengantar' },
        flowScene,
        walk('walk-create', STAFF_STEPS, ROLES.staff, 'Mengajukan'),
        chapterCard('chapter-reject', ROLES.staff, 2, 2, 'Bila pengajuan ditolak', 'Baca alasannya, lalu minta revisi ke finance.', 'Bila ditolak'),
        walk('walk-reject', REJECT_STAFF_STEPS, ROLES.staff),
        outro,
    ]),
    fm: buildTutorial('ReceivablesFinanceManager', ROLES.fm, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.fm} title="Menyetujui, mencairkan & menagih" summary="Meninjau pengajuan, mencairkan dari rekening, lalu mencatat cicilan sampai lunas." />, chapter: 'Pengantar' },
        flowScene,
        walk('walk-approve', FM_STEPS, ROLES.fm, 'Menyetujui'),
        chapterCard('chapter-pay', ROLES.fm, 2, 3, 'Mencatat cicilan', 'Transfer Bank tercatat di rekening; Kas dan Potongan Gaji tidak.', 'Mencatat cicilan'),
        walk('walk-pay', PAY_STEPS, ROLES.fm),
        chapterCard('chapter-reject', ROLES.fm, 3, 3, 'Menolak pengajuan', 'Selalu sertakan alasan agar pemohon tahu yang harus diperbaiki.', 'Menolak'),
        walk('walk-reject', REJECT_FM_STEPS, ROLES.fm),
        outro,
    ]),
    admin: buildTutorial('ReceivablesAdmin', ROLES.admin, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.admin} title="Piutang & dampaknya" summary="Apa yang berubah di rekening, arus kas, dan laba rugi saat piutang dicairkan dan dicicil." />, chapter: 'Pengantar' },
        { id: 'roles', frames: 330, node: <RolesScene cards={guide.roles} title="Tiga peran di modul ini" />, chapter: 'Tiga peran' },
        { id: 'impact', frames: impactSceneFrames(guide.impacts!), node: <ImpactScene impacts={guide.impacts!} subtitle="Pengajuan & draft belum memindahkan uang. Pencairan dan cicilan transfer yang mengubah rekening." />, chapter: 'Dampak' },
        { id: 'record-out', frames: recordSceneFrames(disbursed), node: <RecordScene record={disbursed} />, chapter: 'Transaksi bank' },
        { id: 'record-in', frames: recordSceneFrames(installment), node: <RecordScene record={installment} /> },
        walk('walk-impact', ADMIN_IMPACT_STEPS, ROLES.admin, 'Jejak di modul lain'),
        { id: 'warnings', frames: warningsSceneFrames(guide.warnings!.length), node: <WarningsScene warnings={guide.warnings!} />, chapter: 'Perhatian' },
        walk('walk-admin', ADMIN_STEPS, ROLES.admin),
        { id: 'recap', frames: 300, node: <RecapScene guide={guide} />, chapter: 'Ringkasan hak akses' },
        outro,
    ]),
};
