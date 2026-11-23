import { ImpactScene, impactSceneFrames, Intro, Outro, RecapScene, RecordScene, recordSceneFrames, RolesScene, WarningsScene, warningsSceneFrames } from '../components/scenes';
import { buildTutorial, type Tutorials, walk } from '../components/tutorial';
import { ROLES } from '../roles';
import { guide } from './guide';
import { ADMIN_SETUP_STEPS, FM_STEPS, STAFF_STEPS } from './steps';

/* Video pendek untuk pemula: Staff menagih dalam USD, Finance manager mencatat pembayarannya, Admin menyalakannya. */

const example = { id: 'example', frames: recordSceneFrames(guide.records![0]), node: <RecordScene record={guide.records![0]} />, chapter: 'Contoh hitungan' };

export const TUTORIALS: Tutorials = {
    staff: buildTutorial('TagihanUsdStaff', ROLES.staff, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.staff} title="Menagih klien dalam dolar" summary="Pilih USD, isi kurs hari itu, dan harga USD per baris. Pembukuan tetap Rupiah." />, chapter: 'Pengantar' },
        example,
        walk('walk-create', STAFF_STEPS, ROLES.staff, 'Membuat tagihan USD'),
        { id: 'outro', frames: 90, node: <Outro where="Keuangan › Invoice" action="Buat Invoice › USD" /> },
    ]),
    fm: buildTutorial('TagihanUsdFinanceManager', ROLES.fm, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.fm} title="Mencatat pembayaran USD" summary="Jumlah USD dan kurs saat diterima; aplikasi menghitung Rupiah yang masuk dan selisih kursnya." />, chapter: 'Pengantar' },
        walk('walk-pay', FM_STEPS, ROLES.fm, 'Pembayaran USD'),
        example,
        { id: 'outro', frames: 90, node: <Outro where="Keuangan › Invoice" action="Catat pembayaran" /> },
    ]),
    admin: buildTutorial('TagihanUsdAdmin', ROLES.admin, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.admin} title="Menyalakan & memahami selisih kurs" summary="Satu centang dan rekening USD di Profil perusahaan, lalu ke mana selisih kurs dibukukan." />, chapter: 'Pengantar' },
        { id: 'roles', frames: 300, node: <RolesScene cards={guide.roles} title="Tiga peran untuk tagihan USD" />, chapter: 'Tiga peran' },
        walk('walk-setup', ADMIN_SETUP_STEPS, ROLES.admin, 'Menyalakan'),
        { id: 'impact', frames: impactSceneFrames(guide.impacts!), node: <ImpactScene impacts={guide.impacts!} subtitle="Tagihan dalam **USD**, pembukuan tetap **Rupiah**. Beda kurs saat dibayar menjadi selisih kurs." />, chapter: 'Dampak' },
        example,
        { id: 'warnings', frames: warningsSceneFrames(guide.warnings!.length), node: <WarningsScene warnings={guide.warnings!} />, chapter: 'Perhatian' },
        { id: 'recap', frames: 300, node: <RecapScene guide={guide} />, chapter: 'Ringkasan hak akses' },
        { id: 'outro', frames: 90, node: <Outro where="Pengaturan › Profil perusahaan" action="Tagihan USD" /> },
    ]),
};
