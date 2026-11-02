import { ChapterCard, ImpactScene, impactSceneFrames, Intro, Outro, RecapScene, RecordScene, recordSceneFrames, RolesScene, WarningsScene, warningsSceneFrames } from '../components/scenes';
import { buildTutorial, type Tutorials, walk } from '../components/tutorial';
import { ROLES } from '../roles';
import { guide } from './guide';
import { ADMIN_IMPACT_STEPS, FM_STEPS, STAFF_STEPS } from './steps';

/* Notifikasi tidak punya halaman sendiri: lonceng di header setiap halaman. */

const outro = { id: 'outro', frames: 90, node: <Outro where="Ringkasan" action="ikon lonceng di kanan atas" /> };
const fmWarnings = guide.warnings!.slice(0, 2);

export const TUTORIALS: Tutorials = {
    staff: buildTutorial('NotificationsStaff', ROLES.staff, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.staff} title="Membaca notifikasi" summary="Lonceng di setiap halaman memberi tahu hal yang perlu Anda lihat." />, chapter: 'Pengantar' },
        walk('walk-bell', STAFF_STEPS.slice(0, 5), ROLES.staff, 'Lonceng'),
        walk('walk-all', STAFF_STEPS.slice(5), ROLES.staff, 'Tandai & lihat semua'),
        outro,
    ]),
    fm: buildTutorial('NotificationsFinanceManager', ROLES.fm, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.fm} title="Feedback baru & pengingat jatuh tempo" summary="Notifikasi tambahan yang hanya diterima Finance manager dan Admin." />, chapter: 'Pengantar' },
        { id: 'impact', frames: impactSceneFrames(guide.impacts!.slice(0, 1)), node: <ImpactScene impacts={guide.impacts!.slice(0, 1)} title="Notifikasi yang Anda terima" subtitle="Tiga sumber notifikasi di lonceng Finance manager." />, chapter: 'Yang diterima' },
        walk('walk-feedback', FM_STEPS, ROLES.fm, 'Feedback Baru'),
        {
            id: 'chapter-due',
            frames: 150,
            node: <ChapterCard part={2} total={2} role={ROLES.fm} title="Pengingat invoice jatuh tempo" summary="Tiap hari pukul 08.00 WITA, untuk invoice Draft atau Sebagian: 3 hari sebelum dan pada hari jatuh tempo. Klik notifikasinya untuk membuka detail invoice." />,
            chapter: 'Jatuh tempo',
        },
        { id: 'warnings', frames: warningsSceneFrames(fmWarnings.length), node: <WarningsScene warnings={fmWarnings} title="Yang perlu diperhatikan" /> },
        outro,
    ]),
    admin: buildTutorial('NotificationsAdmin', ROLES.admin, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.admin} title="Siapa diberi tahu, dan kapan" summary="Notifikasi dibuat otomatis oleh modul Feedback dan pengingat invoice. Tidak ada pengaturan penerima." />, chapter: 'Pengantar' },
        { id: 'roles', frames: 300, node: <RolesScene cards={guide.roles} title="Tiga peran, notifikasi berbeda" />, chapter: 'Tiga peran' },
        { id: 'impact', frames: impactSceneFrames(guide.impacts!), node: <ImpactScene impacts={guide.impacts!} subtitle="Hanya **dua** sumber notifikasi: Feedback dan pengingat invoice harian." />, chapter: 'Sumber' },
        { id: 'record', frames: recordSceneFrames(guide.records![0]), node: <RecordScene record={guide.records![0]} />, chapter: 'Isi notifikasi' },
        walk('walk-impact', ADMIN_IMPACT_STEPS, ROLES.admin, 'Di layar Admin'),
        { id: 'warnings', frames: warningsSceneFrames(guide.warnings!.length), node: <WarningsScene warnings={guide.warnings!} />, chapter: 'Perhatian' },
        { id: 'recap', frames: 270, node: <RecapScene guide={guide} />, chapter: 'Ringkasan' },
        outro,
    ]),
};
