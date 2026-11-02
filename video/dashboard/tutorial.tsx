import { ImpactScene, impactSceneFrames, Intro, Outro, RecapScene, RecordScene, recordSceneFrames, RolesScene, WarningsScene, warningsSceneFrames } from '../components/scenes';
import { buildTutorial, type Tutorials, walk } from '../components/tutorial';
import { ROLES } from '../roles';
import { guide } from './guide';
import { ADMIN_IMPACT_STEPS, ADMIN_STEPS, FM_STEPS, STAFF_STEPS } from './steps';

/* Ringkasan: halaman baca-saja. Staff = cara membaca (berlaku untuk semua), FM = tautan lanjut, Admin = asal angka + izin. */

const outro = { id: 'outro', frames: 90, node: <Outro where="Ringkasan" /> };
const record = guide.records![0];

export const TUTORIALS: Tutorials = {
    staff: buildTutorial('DashboardStaff', ROLES.staff, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.staff} title="Membaca Ringkasan" summary="Saldo kas, arus bulan ini, grafik, invoice belum dibayar, dan rekening dalam satu halaman." />, chapter: 'Pengantar' },
        walk('walk-read', STAFF_STEPS.slice(0, 4), ROLES.staff, 'Saldo & arus kas'),
        walk('walk-chart', STAFF_STEPS.slice(4, 10), ROLES.staff, 'Mengatur grafik'),
        walk('walk-rest', STAFF_STEPS.slice(10), ROLES.staff, 'Kartu lainnya'),
        outro,
    ]),
    fm: buildTutorial('DashboardFinanceManager', ROLES.fm, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.fm} title="Dari Ringkasan ke modul terkait" summary="Membaca angka dengan benar dan melanjutkan ke Arus Kas, Rekening, Invoice, dan Laba Rugi." />, chapter: 'Pengantar' },
        walk('walk-links', FM_STEPS, ROLES.fm, 'Tautan lanjut'),
        { id: 'record', frames: recordSceneFrames(record), node: <RecordScene record={record} />, chapter: 'Asal angka' },
        outro,
    ]),
    admin: buildTutorial('DashboardAdmin', ROLES.admin, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.admin} title="Asal angka & siapa yang melihatnya" summary="Setiap angka di Ringkasan dihitung ulang dari modul lain. Perubahan di sana langsung terlihat di sini." />, chapter: 'Pengantar' },
        { id: 'roles', frames: 300, node: <RolesScene cards={guide.roles} title="Tiga peran, angka yang sama" />, chapter: 'Tiga peran' },
        { id: 'impact', frames: impactSceneFrames(guide.impacts!), node: <ImpactScene impacts={guide.impacts!} title="Dari mana angkanya?" subtitle="Ringkasan **tidak menyimpan** angka apa pun. Semuanya dihitung saat halaman dibuka." />, chapter: 'Asal angka' },
        { id: 'record', frames: recordSceneFrames(record), node: <RecordScene record={record} /> },
        walk('walk-impact', ADMIN_IMPACT_STEPS, ROLES.admin, 'Jejak di modul lain'),
        { id: 'warnings', frames: warningsSceneFrames(guide.warnings!.length), node: <WarningsScene warnings={guide.warnings!} />, chapter: 'Perhatian' },
        walk('walk-admin', ADMIN_STEPS, ROLES.admin, 'Izin akses'),
        { id: 'recap', frames: 270, node: <RecapScene guide={guide} />, chapter: 'Ringkasan hak akses' },
        outro,
    ]),
};
