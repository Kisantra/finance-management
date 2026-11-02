import { ImpactScene, impactSceneFrames, Intro, Outro, RecapScene, RecordScene, recordSceneFrames, RolesScene, WarningsScene, warningsSceneFrames } from '../components/scenes';
import { buildTutorial, type Tutorials, walk } from '../components/tutorial';
import { ROLES } from '../roles';
import { guide } from './guide';
import { ADMIN_EDIT_STEPS, ADMIN_IMPACT_STEPS, ADMIN_PERM_STEPS, ADMIN_USER_STEPS, FM_STEPS } from './steps';

/* Staff tidak punya akses ke modul ini, jadi hanya video Finance manager & Admin. */

const roles = { id: 'roles', frames: 210, node: <RolesScene cards={guide.roles} title="Dua peran yang bisa membuka modul ini" />, chapter: 'Peran' };
const recap = { id: 'recap', frames: 240, node: <RecapScene guide={guide} />, chapter: 'Ringkasan hak akses' };
const warnings = guide.warnings!.slice(0, 4);

export const TUTORIALS: Tutorials = {
    fm: buildTutorial('UsersPermissionsFinanceManager', ROLES.fm, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.fm} title="Melihat izin tiap peran" summary="Finance manager bisa memeriksa siapa boleh melakukan apa, tanpa bisa mengubahnya." />, chapter: 'Pengantar' },
        roles,
        walk('walk-fm', FM_STEPS, ROLES.fm, 'Izin & Peran'),
        recap,
        { id: 'outro', frames: 90, node: <Outro where="Administrasi › Izin & Peran" /> },
    ]),
    admin: buildTutorial('UsersPermissionsAdmin', ROLES.admin, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.admin} title="Mengelola akun & hak akses" summary="Membuat akun karyawan, memberi peran, mengatur izin, dan memahami apa yang ikut berubah." />, chapter: 'Pengantar' },
        roles,
        walk('walk-create', ADMIN_USER_STEPS, ROLES.admin, 'Menambah pengguna'),
        walk('walk-edit', ADMIN_EDIT_STEPS, ROLES.admin, 'Mengubah pengguna'),
        walk('walk-perm', ADMIN_PERM_STEPS, ROLES.admin, 'Izin & peran'),
        { id: 'impact', frames: impactSceneFrames(guide.impacts!), node: <ImpactScene impacts={guide.impacts!} subtitle="Peran dan izin menentukan apa yang dilihat orang di seluruh aplikasi." />, chapter: 'Dampak' },
        { id: 'record', frames: recordSceneFrames(guide.records![0]), node: <RecordScene record={guide.records![0]} />, chapter: 'Saat pengguna dihapus' },
        walk('walk-impact', ADMIN_IMPACT_STEPS, ROLES.admin, 'Jejak di modul lain'),
        { id: 'warnings', frames: warningsSceneFrames(warnings.length), node: <WarningsScene warnings={warnings} />, chapter: 'Perhatian' },
        recap,
        { id: 'outro', frames: 90, node: <Outro where="Administrasi › Pengguna" action="Tambah Pengguna" /> },
    ]),
};
