import { ImpactScene, impactSceneFrames, Intro, Outro, RecapScene, RecordScene, recordSceneFrames, RolesScene, WarningsScene, warningsSceneFrames } from '../components/scenes';
import { buildTutorial, type Tutorials, walk } from '../components/tutorial';
import { ROLES } from '../roles';
import { guide } from './guide';
import { ADMIN_COMPANY_STEPS, ADMIN_DELETE_STEPS, ADMIN_IMPACT_STEPS, ADMIN_TEMPLATE_STEPS, FM_STEPS, STAFF_STEPS } from './steps';

/* Satu video per role: Staff (akun sendiri), Finance manager (penomoran invoice), Admin (profil perusahaan + template PDF + dampaknya). */

const where = 'Menu akun (kanan atas) › Pengaturan';
const numberingImpact = guide.impacts!.filter((i) => i.title === 'Penomoran invoice');
const warnings = guide.warnings!.slice(0, 4);

export const TUTORIALS: Tutorials = {
    staff: buildTutorial('SettingsStaff', ROLES.staff, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.staff} title="Mengatur akun Anda" summary="Mengubah nama dan email, mengganti kata sandi, dan apa arti Hapus Akun." />, chapter: 'Pengantar' },
        walk('walk-account', STAFF_STEPS, ROLES.staff, 'Profil & kata sandi'),
        { id: 'outro', frames: 90, node: <Outro where={where} action="Profil" /> },
    ]),
    fm: buildTutorial('SettingsFinanceManager', ROLES.fm, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.fm} title="Mengatur penomoran invoice" summary="Menyusun pola nomor, jumlah digit, dan kapan nomor kembali ke 1, dengan pratinjau langsung." />, chapter: 'Pengantar' },
        walk('walk-numbering', FM_STEPS, ROLES.fm, 'Penomoran invoice'),
        { id: 'impact', frames: impactSceneFrames(numberingImpact), node: <ImpactScene impacts={numberingImpact} title="Kapan pola baru berlaku?" />, chapter: 'Dampak' },
        { id: 'outro', frames: 90, node: <Outro where={where} action="Penomoran invoice" /> },
    ]),
    admin: buildTutorial('SettingsAdmin', ROLES.admin, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.admin} title="Identitas perusahaan & dokumen" summary="Profil perusahaan mengisi identitas di dokumen PDF; template PDF menambah pilihan tampilan saat mencetak invoice." />, chapter: 'Pengantar' },
        { id: 'roles', frames: 240, node: <RolesScene cards={guide.roles} title="Siapa melihat apa di Pengaturan" />, chapter: 'Tiga peran' },
        walk('walk-company', ADMIN_COMPANY_STEPS, ROLES.admin, 'Profil perusahaan'),
        { id: 'impact', frames: impactSceneFrames(guide.impacts!), node: <ImpactScene impacts={guide.impacts!} subtitle="Tidak ada transaksi uang di sini, tetapi isinya tercetak di banyak dokumen." />, chapter: 'Dampak' },
        { id: 'record', frames: recordSceneFrames(guide.records![0]), node: <RecordScene record={guide.records![0]} />, chapter: 'Ke mana datanya' },
        walk('walk-template', ADMIN_TEMPLATE_STEPS, ROLES.admin, 'Template PDF'),
        walk('walk-impact', ADMIN_IMPACT_STEPS, ROLES.admin, 'Jejak di modul lain'),
        walk('walk-delete', ADMIN_DELETE_STEPS, ROLES.admin, 'Hapus template'),
        { id: 'warnings', frames: warningsSceneFrames(warnings.length), node: <WarningsScene warnings={warnings} />, chapter: 'Perhatian' },
        { id: 'recap', frames: 240, node: <RecapScene guide={guide} />, chapter: 'Ringkasan hak akses' },
        { id: 'outro', frames: 90, node: <Outro where={where} action="Profil perusahaan" /> },
    ]),
};
