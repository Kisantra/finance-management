import { FlowScene, flowSceneFrames, ImpactScene, impactSceneFrames, Intro, Outro, RecapScene, RecordScene, recordSceneFrames, RolesScene, WarningsScene, warningsSceneFrames } from '../components/scenes';
import { buildTutorial, chapterCard, type Tutorials, walk } from '../components/tutorial';
import { ROLES } from '../roles';
import { guide } from './guide';
import { ADMIN_IMPACT_STEPS, FM_STATUS_STEPS, FM_STEPS, STAFF_PAGE_STEPS, STAFF_REPLY_STEPS, STAFF_SEND_STEPS } from './steps';

const flow = guide.flow!;
const outro = { id: 'outro', frames: 90, node: <Outro where="Administrasi › Feedback" action="Kirim Feedback" /> };
const flowScene = { id: 'flow', frames: flowSceneFrames(flow), node: <FlowScene flow={flow} title="Perjalanan sebuah feedback" />, chapter: 'Alur' };

export const TUTORIALS: Tutorials = {
    staff: buildTutorial('FeedbacksStaff', ROLES.staff, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.staff} title="Melaporkan masalah & memberi usulan" summary="Dari tombol Feedback di setiap halaman sampai membaca tanggapan tim." />, chapter: 'Pengantar' },
        walk('walk-send', STAFF_SEND_STEPS, ROLES.staff, 'Tombol Feedback'),
        walk('walk-page', STAFF_PAGE_STEPS, ROLES.staff, 'Halaman Feedback'),
        chapterCard('chapter-reply', ROLES.staff, 2, 2, 'Melihat tanggapan', 'Notifikasi memberi tahu saat feedback Anda ditanggapi.', 'Tanggapan'),
        walk('walk-reply', STAFF_REPLY_STEPS, ROLES.staff),
        outro,
    ]),
    fm: buildTutorial('FeedbacksFinanceManager', ROLES.fm, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.fm} title="Meninjau & menanggapi feedback" summary="Membaca laporan semua pengguna, membalas, dan menandai kemajuannya." />, chapter: 'Pengantar' },
        flowScene,
        walk('walk-respond', FM_STEPS, ROLES.fm, 'Menanggapi'),
        chapterCard('chapter-status', ROLES.fm, 2, 2, 'Mengubah status saja', 'Tanpa tanggapan, tanpa notifikasi ke pengirim.', 'Ubah Status'),
        walk('walk-status', FM_STATUS_STEPS, ROLES.fm),
        outro,
    ]),
    admin: buildTutorial('FeedbacksAdmin', ROLES.admin, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.admin} title="Akses penuh & dampaknya" summary="Siapa diberi tahu, apa yang tercatat, dan aksi mana yang tidak bisa dibatalkan." />, chapter: 'Pengantar' },
        { id: 'roles', frames: 300, node: <RolesScene cards={guide.roles} title="Tiga peran di modul ini" />, chapter: 'Tiga peran' },
        flowScene,
        { id: 'impact', frames: impactSceneFrames(guide.impacts!), node: <ImpactScene impacts={guide.impacts!} subtitle="Feedback tidak menyentuh data keuangan. Dampaknya ada di **notifikasi** dan hak edit pengirim." />, chapter: 'Dampak' },
        { id: 'record', frames: recordSceneFrames(guide.records![0]), node: <RecordScene record={guide.records![0]} />, chapter: 'Yang tercatat' },
        walk('walk-impact', ADMIN_IMPACT_STEPS, ROLES.admin, 'Jejak di modul lain'),
        { id: 'warnings', frames: warningsSceneFrames(guide.warnings!.length), node: <WarningsScene warnings={guide.warnings!} />, chapter: 'Perhatian' },
        { id: 'recap', frames: 300, node: <RecapScene guide={guide} />, chapter: 'Ringkasan hak akses' },
        outro,
    ]),
};
