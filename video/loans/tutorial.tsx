import { FlowScene, flowSceneFrames, ImpactScene, impactSceneFrames, Intro, Outro, RecapScene, RecordScene, recordSceneFrames, RolesScene, WarningsScene, warningsSceneFrames } from '../components/scenes';
import { buildTutorial, chapterCard, type Tutorials, walk } from '../components/tutorial';
import { ROLES } from '../roles';
import { guide } from './guide';
import { ADMIN_IMPACT_STEPS, ADMIN_STEPS, CREATE_STEPS, PAY_STEPS } from './steps';

/* Pinjaman hanya untuk Finance manager & Admin (Staff tidak punya izin "view loans"). */

const outro = { id: 'outro', frames: 90, node: <Outro where="Utang & Piutang › Pinjaman" action="Tambah Pinjaman" /> };
const [received, paid] = guide.records!;

export const TUTORIALS: Tutorials = {
    fm: buildTutorial('LoansFinanceManager', ROLES.fm, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.fm} title="Mencatat pinjaman & angsuran" summary="Dari dana pinjaman masuk ke rekening sampai angsuran terakhir lunas." />, chapter: 'Pengantar' },
        { id: 'flow', frames: flowSceneFrames(guide.flow!), node: <FlowScene flow={guide.flow!} title="Status sebuah pinjaman" />, chapter: 'Alur' },
        walk('walk-create', CREATE_STEPS, ROLES.fm, 'Mencatat pinjaman'),
        chapterCard('chapter-pay', ROLES.fm, 2, 2, 'Membayar angsuran', 'Pokok dan bunga dicatat terpisah, langsung keluar dari rekening.', 'Membayar angsuran'),
        walk('walk-pay', PAY_STEPS, ROLES.fm),
        outro,
    ]),
    admin: buildTutorial('LoansAdmin', ROLES.admin, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.admin} title="Pinjaman & dampaknya" summary="Apa yang berubah di rekening, arus kas, dan laba rugi saat pinjaman dicatat dan dibayar." />, chapter: 'Pengantar' },
        { id: 'roles', frames: 240, node: <RolesScene cards={guide.roles} title="Siapa yang mengelola pinjaman" />, chapter: 'Peran' },
        { id: 'impact', frames: impactSceneFrames(guide.impacts!), node: <ImpactScene impacts={guide.impacts!} subtitle="Pokok pinjaman memindahkan uang, tetapi tidak mengubah laba. Hanya bunga yang menjadi beban." />, chapter: 'Dampak' },
        { id: 'record-in', frames: recordSceneFrames(received), node: <RecordScene record={received} />, chapter: 'Transaksi bank' },
        { id: 'record-pay', frames: recordSceneFrames(paid), node: <RecordScene record={paid} /> },
        walk('walk-impact', ADMIN_IMPACT_STEPS, ROLES.admin, 'Jejak di modul lain'),
        { id: 'warnings', frames: warningsSceneFrames(guide.warnings!.length), node: <WarningsScene warnings={guide.warnings!} />, chapter: 'Perhatian' },
        walk('walk-admin', ADMIN_STEPS, ROLES.admin, 'Hapus pinjaman'),
        { id: 'recap', frames: 270, node: <RecapScene guide={guide} />, chapter: 'Ringkasan hak akses' },
        outro,
    ]),
};
