import { ImpactScene, impactSceneFrames, Intro, Outro, RecapScene, RecordScene, recordSceneFrames, RolesScene, WarningsScene, warningsSceneFrames } from '../components/scenes';
import { buildTutorial, type Tutorials, walk } from '../components/tutorial';
import { ROLES } from '../roles';
import { guide } from './guide';
import { ADMIN_IMPACT_STEPS, ADMIN_STEPS, FM_STEPS, STAFF_STEPS } from './steps';

/* Satu video pendek per role. Modul tanpa status, jadi tanpa adegan alur. */

const outro = { id: 'outro', frames: 90, node: <Outro where="Master Data › Layanan" /> };

const roles = <RolesScene cards={guide.roles} title="Tiga peran di modul ini" />;

export const TUTORIALS: Tutorials = {
    staff: buildTutorial('ServicesStaff', ROLES.staff, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.staff} title="Memakai katalog layanan" summary="Mencari layanan dan harganya, lalu mengisinya ke invoice dengan sekali klik." />, chapter: 'Pengantar' },
        walk('walk-catalog', STAFF_STEPS, ROLES.staff, 'Katalog & invoice'),
        outro,
    ]),
    fm: buildTutorial('ServicesFinanceManager', ROLES.fm, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.fm} title="Mengelola katalog layanan" summary="Menambah layanan baru dan memperbarui harganya." />, chapter: 'Pengantar' },
        walk('walk-manage', FM_STEPS, ROLES.fm, 'Tambah & ubah harga'),
        { id: 'outro', frames: 90, node: <Outro where="Master Data › Layanan" action="Tambah Layanan" /> },
    ]),
    admin: buildTutorial('ServicesAdmin', ROLES.admin, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.admin} title="Akses penuh & dampaknya" summary="Apa yang terjadi pada invoice dan template saat layanan ditambah, diubah, atau dihapus." />, chapter: 'Pengantar' },
        { id: 'roles', frames: 330, node: roles, chapter: 'Tiga peran' },
        { id: 'impact', frames: impactSceneFrames(guide.impacts!), node: <ImpactScene impacts={guide.impacts!} subtitle="Katalog hanya **sumber salinan**: tidak ada uang, saldo, atau laporan yang berubah." />, chapter: 'Dampak' },
        { id: 'record', frames: recordSceneFrames(guide.records![0]), node: <RecordScene record={guide.records![0]} />, chapter: 'Yang disalin' },
        walk('walk-impact', ADMIN_IMPACT_STEPS, ROLES.admin, 'Jejak di modul lain'),
        { id: 'warnings', frames: warningsSceneFrames(guide.warnings!.length), node: <WarningsScene warnings={guide.warnings!} />, chapter: 'Perhatian' },
        walk('walk-admin', ADMIN_STEPS, ROLES.admin, 'Hapus layanan'),
        { id: 'recap', frames: 300, node: <RecapScene guide={guide} />, chapter: 'Ringkasan hak akses' },
        outro,
    ]),
};
