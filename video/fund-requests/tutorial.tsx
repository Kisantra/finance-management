import { FlowScene, flowSceneFrames, ImpactScene, impactSceneFrames, Intro, Outro, RecapScene, RecordScene, recordSceneFrames, RolesScene, WarningsScene, warningsSceneFrames } from '../components/scenes';
import { buildTutorial, chapterCard, type Tutorials, walk } from '../components/tutorial';
import { ROLES } from '../roles';
import { guide } from './guide';
import { ADMIN_IMPACT_STEPS, ADMIN_STEPS, DISBURSE_STEPS, FM_STEPS, REJECT_FM_STEPS, REJECT_STAFF_STEPS, STAFF_STEPS } from './steps';

const flow = guide.flow!;
const outro = { id: 'outro', frames: 90, node: <Outro where="Operasional › Permintaan Dana" action="Buat Permintaan" /> };
const flowScene = { id: 'flow', frames: flowSceneFrames(flow), node: <FlowScene flow={flow} title="Alur sebuah permintaan dana" />, chapter: 'Alur' };

export const TUTORIALS: Tutorials = {
    staff: buildTutorial('FundRequestsStaff', ROLES.staff, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.staff} title="Mengajukan dana operasional" summary="Merinci kebutuhan per item, mengajukan, lalu memantau sampai dananya cair." />, chapter: 'Pengantar' },
        flowScene,
        walk('walk-create', STAFF_STEPS, ROLES.staff, 'Membuat permintaan'),
        chapterCard('chapter-reject', ROLES.staff, 2, 2, 'Bila permintaan ditolak', 'Baca catatannya, lalu buat permintaan baru.', 'Bila ditolak'),
        walk('walk-reject', REJECT_STAFF_STEPS, ROLES.staff),
        outro,
    ]),
    fm: buildTutorial('FundRequestsFinanceManager', ROLES.fm, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.fm} title="Meninjau & mencairkan dana" summary="Memeriksa rincian item, menyetujui atau menolak, lalu mencairkan dari rekening bank." />, chapter: 'Pengantar' },
        flowScene,
        walk('walk-review', FM_STEPS, ROLES.fm, 'Meninjau'),
        chapterCard('chapter-disburse', ROLES.fm, 2, 3, 'Mencairkan dana', 'Setiap item menjadi satu transaksi pengeluaran di rekening.', 'Mencairkan'),
        walk('walk-disburse', DISBURSE_STEPS, ROLES.fm),
        chapterCard('chapter-reject', ROLES.fm, 3, 3, 'Menolak permintaan', 'Selalu tulis alasannya di Catatan Review.', 'Menolak'),
        walk('walk-reject', REJECT_FM_STEPS, ROLES.fm),
        outro,
    ]),
    admin: buildTutorial('FundRequestsAdmin', ROLES.admin, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.admin} title="Akses penuh & dampaknya" summary="Apa yang berubah di rekening, arus kas, dan laba rugi saat dana dicairkan." />, chapter: 'Pengantar' },
        { id: 'roles', frames: 330, node: <RolesScene cards={guide.roles} title="Tiga peran di modul ini" />, chapter: 'Tiga peran' },
        { id: 'impact', frames: impactSceneFrames(guide.impacts!), node: <ImpactScene impacts={guide.impacts!} subtitle="Menyetujui belum memindahkan uang. Mencairkan yang mengubah rekening dan laporan." />, chapter: 'Dampak' },
        { id: 'record', frames: recordSceneFrames(guide.records![0]), node: <RecordScene record={guide.records![0]} />, chapter: 'Transaksi bank' },
        walk('walk-impact', ADMIN_IMPACT_STEPS, ROLES.admin, 'Jejak di modul lain'),
        { id: 'warnings', frames: warningsSceneFrames(guide.warnings!.length), node: <WarningsScene warnings={guide.warnings!} />, chapter: 'Perhatian' },
        walk('walk-admin', ADMIN_STEPS, ROLES.admin, 'Hapus permintaan'),
        { id: 'recap', frames: 300, node: <RecapScene guide={guide} />, chapter: 'Ringkasan hak akses' },
        outro,
    ]),
};
