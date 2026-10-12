import { ImpactScene, impactSceneFrames, Intro, Outro, RecapScene, RecordScene, recordSceneFrames, RolesScene, WarningsScene, warningsSceneFrames } from '../components/scenes';
import { buildTutorial, type Tutorials, walk } from '../components/tutorial';
import { ROLES } from '../roles';
import { guide } from './guide';
import { ADMIN_IMPACT_STEPS, CLASSIFY_STEPS, CREATE_STEPS, DELETE_STEPS, TOUR_STEPS } from './steps';

/* Modul master data tanpa status. Staff tidak punya akses, jadi hanya Finance manager & Admin. */

const outro = { id: 'outro', frames: 90, node: <Outro where="Operasional › Kategori Transaksi" action="Tambah Kategori" /> };

export const TUTORIALS: Tutorials = {
    fm: buildTutorial('TransactionCategoriesFinanceManager', ROLES.fm, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.fm} title="Merapikan kategori transaksi" summary="Membuat kategori, mengatur grup Laba Rugi, dan menghapus kategori tanpa kehilangan data." />, chapter: 'Pengantar' },
        walk('walk-tour', TOUR_STEPS, ROLES.fm, 'Mengenal halaman'),
        walk('walk-create', CREATE_STEPS, ROLES.fm, 'Tambah kategori'),
        walk('walk-classify', CLASSIFY_STEPS, ROLES.fm, 'Grup Laba Rugi'),
        walk('walk-delete', DELETE_STEPS, ROLES.fm, 'Hapus & pindahkan'),
        outro,
    ]),
    admin: buildTutorial('TransactionCategoriesAdmin', ROLES.admin, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.admin} title="Kategori menentukan laporan" summary="Bagaimana tipe dan Grup Laba Rugi sebuah kategori mengubah Arus Kas dan Laba Rugi, termasuk data lama." />, chapter: 'Pengantar' },
        { id: 'roles', frames: 270, node: <RolesScene cards={guide.roles} title="Siapa yang memakai modul ini" />, chapter: 'Peran' },
        { id: 'impact', frames: impactSceneFrames(guide.impacts!), node: <ImpactScene impacts={guide.impacts!} subtitle="Kategori tidak memindahkan uang, tetapi menentukan di mana uang itu dilaporkan." />, chapter: 'Dampak' },
        { id: 'record', frames: recordSceneFrames(guide.records![0]), node: <RecordScene record={guide.records![0]} />, chapter: 'Pindahkan & Hapus' },
        walk('walk-impact', ADMIN_IMPACT_STEPS, ROLES.admin, 'Jejak di modul lain'),
        { id: 'warnings', frames: warningsSceneFrames(guide.warnings!.length), node: <WarningsScene warnings={guide.warnings!} />, chapter: 'Perhatian' },
        { id: 'recap', frames: 300, node: <RecapScene guide={guide} />, chapter: 'Ringkasan hak akses' },
        outro,
    ]),
};
