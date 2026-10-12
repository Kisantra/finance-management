import { ImpactScene, impactSceneFrames, Intro, Outro, RecapScene, RecordScene, recordSceneFrames, RolesScene, WarningsScene, warningsSceneFrames } from '../components/scenes';
import { buildTutorial, chapterCard, type Tutorials, walk } from '../components/tutorial';
import { ROLES } from '../roles';
import { guide } from './guide';
import { ADMIN_IMPACT_STEPS, ADMIN_STEPS, CREATE_STEPS, EDIT_STEPS } from './steps';

/* Staff dan Finance manager punya hak yang sama di modul ini, jadi cukup satu video (tab Staff tampil juga untuk Finance manager). */

const outro = { id: 'outro', frames: 90, node: <Outro where="Master Data › Klien" action="Tambah Klien" /> };

export const TUTORIALS: Tutorials = {
    staff: buildTutorial('ClientsStaff', ROLES.staff, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.staff} title="Mengelola data klien" summary="Untuk Staff dan Finance manager: menambah, mencari, dan memperbarui data pelanggan." />, chapter: 'Pengantar' },
        walk('walk-create', CREATE_STEPS, ROLES.staff, 'Menambah klien'),
        chapterCard('chapter-edit', ROLES.staff, 2, 2, 'Mengubah & menonaktifkan', 'Perbarui data klien, atau nonaktifkan klien yang sudah tidak dilayani.', 'Mengubah'),
        walk('walk-edit', EDIT_STEPS, ROLES.staff),
        outro,
    ]),
    admin: buildTutorial('ClientsAdmin', ROLES.admin, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.admin} title="Akses penuh & dampaknya" summary="Data klien mengalir ke invoice, arus kas, dan laporan. Menghapusnya ikut menghapus semua itu." />, chapter: 'Pengantar' },
        { id: 'roles', frames: 330, node: <RolesScene cards={guide.roles} title="Tiga peran di modul ini" />, chapter: 'Tiga peran' },
        { id: 'impact', frames: impactSceneFrames(guide.impacts!), node: <ImpactScene impacts={guide.impacts!} subtitle="Mengubah data klien aman. Menghapus klien menghapus seluruh riwayat tagihannya." />, chapter: 'Dampak' },
        { id: 'record', frames: recordSceneFrames(guide.records![0]), node: <RecordScene record={guide.records![0]} />, chapter: 'Data klien' },
        walk('walk-impact', ADMIN_IMPACT_STEPS, ROLES.admin, 'Jejak di modul lain'),
        { id: 'warnings', frames: warningsSceneFrames(guide.warnings!.length), node: <WarningsScene warnings={guide.warnings!} />, chapter: 'Perhatian' },
        walk('walk-admin', ADMIN_STEPS, ROLES.admin, 'Hapus klien'),
        { id: 'recap', frames: 300, node: <RecapScene guide={guide} />, chapter: 'Ringkasan hak akses' },
        outro,
    ]),
};
