import { ImpactScene, impactSceneFrames, Intro, Outro, RecapScene, RecordScene, recordSceneFrames, RolesScene, WarningsScene, warningsSceneFrames } from '../components/scenes';
import { buildTutorial, type Tutorials, walk } from '../components/tutorial';
import { ROLES } from '../roles';
import { guide } from './guide';
import { ADMIN_IMPACT_STEPS, ADMIN_STEPS, CREATE_STEPS, EXPENSE_STEPS, HISTORY_STEPS, TOUR_STEPS, TRANSFER_STEPS } from './steps';

/* Modul tanpa status (tidak ada FlowScene). Staff tidak punya akses, jadi hanya Finance manager & Admin. */

const outro = { id: 'outro', frames: 90, node: <Outro where="Keuangan › Rekening Bank" action="Tambah Rekening" /> };

export const TUTORIALS: Tutorials = {
    fm: buildTutorial('BankAccountsFinanceManager', ROLES.fm, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.fm} title="Mengelola rekening & mencatat transaksi" summary="Menambah rekening, mencatat uang masuk dan keluar, transfer antar rekening, lalu membaca riwayatnya." />, chapter: 'Pengantar' },
        walk('walk-tour', TOUR_STEPS, ROLES.fm, 'Mengenal halaman'),
        walk('walk-create', CREATE_STEPS, ROLES.fm, 'Tambah rekening'),
        walk('walk-expense', EXPENSE_STEPS, ROLES.fm, 'Pemasukan & pengeluaran'),
        walk('walk-transfer', TRANSFER_STEPS, ROLES.fm, 'Transfer'),
        walk('walk-history', HISTORY_STEPS, ROLES.fm, 'Riwayat'),
        outro,
    ]),
    admin: buildTutorial('BankAccountsAdmin', ROLES.admin, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.admin} title="Saldo, arus kas & dampaknya" summary="Apa yang berubah di Arus Kas dan Laba Rugi saat transaksi dicatat, ditransfer, atau rekening dihapus." />, chapter: 'Pengantar' },
        { id: 'roles', frames: 270, node: <RolesScene cards={guide.roles} title="Siapa yang memakai modul ini" />, chapter: 'Peran' },
        { id: 'impact', frames: impactSceneFrames(guide.impacts!), node: <ImpactScene impacts={guide.impacts!} subtitle="Saldo tidak pernah diketik: setiap transaksi langsung mengubah saldo, lalu Arus Kas dan Laba Rugi sesuai kategorinya." />, chapter: 'Dampak' },
        { id: 'record', frames: recordSceneFrames(guide.records![0]), node: <RecordScene record={guide.records![0]} />, chapter: 'Transaksi transfer' },
        walk('walk-impact', ADMIN_IMPACT_STEPS, ROLES.admin, 'Jejak di modul lain'),
        // 7 peringatan tidak muat satu layar (kartu terakhir terpotong): dibagi 4 + 3.
        { id: 'warnings', frames: warningsSceneFrames(4), node: <WarningsScene warnings={guide.warnings!.slice(0, 4)} />, chapter: 'Perhatian' },
        { id: 'warnings-2', frames: warningsSceneFrames(guide.warnings!.length - 4), node: <WarningsScene warnings={guide.warnings!.slice(4)} title="Yang perlu diperhatikan Admin (lanjutan)" /> },
        walk('walk-admin', ADMIN_STEPS, ROLES.admin, 'Edit & hapus rekening'),
        { id: 'recap', frames: 300, node: <RecapScene guide={guide} />, chapter: 'Ringkasan hak akses' },
        outro,
    ]),
};
