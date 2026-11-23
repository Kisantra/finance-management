import { ImpactScene, impactSceneFrames, Intro, Outro, RecapScene, RecordScene, recordSceneFrames, RolesScene, WarningsScene, warningsSceneFrames } from '../components/scenes';
import { buildTutorial, type Tutorials, walk } from '../components/tutorial';
import { ROLES } from '../roles';
import { guide } from './guide';
import { ADMIN_STEPS, STAFF_STEPS } from './steps';

/* Video pendek untuk pemula: Staff memakai sakelar PPN & PPh 23; Admin menyalakannya dan melihat dampaknya. */

const example = { id: 'example', frames: recordSceneFrames(guide.records![0]), node: <RecordScene record={guide.records![0]} />, chapter: 'Contoh hitungan' };

export const TUTORIALS: Tutorials = {
    staff: buildTutorial('PajakInvoiceStaff', ROLES.staff, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.staff} title="Pajak di invoice, otomatis" summary="PPN ditambahkan, PPh 23 dipotong klien. Cukup periksa sakelarnya dan Total yang ditransfer." />, chapter: 'Pengantar' },
        example,
        walk('walk-invoice', STAFF_STEPS, ROLES.staff, 'Di editor invoice'),
        { id: 'outro', frames: 90, node: <Outro where="Keuangan › Invoice" action="Buat Invoice" /> },
    ]),
    admin: buildTutorial('PajakInvoiceAdmin', ROLES.admin, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.admin} title="Menyalakan PPN & PPh 23" summary="Status PKP, tarif PPN, dan tarif PPh 23 bawaan di Profil perusahaan, lalu dampaknya ke pembukuan." />, chapter: 'Pengantar' },
        { id: 'roles', frames: 300, node: <RolesScene cards={guide.roles} title="Tiga peran untuk pajak invoice" />, chapter: 'Tiga peran' },
        walk('walk-setup', ADMIN_STEPS, ROLES.admin, 'Menyalakan'),
        example,
        { id: 'impact', frames: impactSceneFrames(guide.impacts!), node: <ImpactScene impacts={guide.impacts!} subtitle="**PPN** bukan pendapatan; **PPh 23** tetap pendapatan walau tidak ditransfer klien." />, chapter: 'Dampak' },
        { id: 'warnings', frames: warningsSceneFrames(guide.warnings!.length), node: <WarningsScene warnings={guide.warnings!} />, chapter: 'Perhatian' },
        { id: 'recap', frames: 300, node: <RecapScene guide={guide} />, chapter: 'Ringkasan hak akses' },
        { id: 'outro', frames: 90, node: <Outro where="Pengaturan › Profil perusahaan" action="Status PKP & Pajak" /> },
    ]),
};
