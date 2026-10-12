import { ImpactScene, impactSceneFrames, Intro, Outro, RecapScene, RecordScene, recordSceneFrames, RolesScene, WarningsScene, warningsSceneFrames } from '../components/scenes';
import { buildTutorial, chapterCard, type Tutorials, walk } from '../components/tutorial';
import { ROLES } from '../roles';
import { guide } from './guide';
import { ADMIN_DELETE_STEPS, ADMIN_IMPACT_STEPS, EDIT_STEPS, EXPENSE_STEPS, INCOME_STEPS, TRANSFER_STEPS } from './steps';

/* Arus Kas hanya untuk Finance manager & Admin (Staff tidak punya izin income/expense/transfer). */

const outro = { id: 'outro', frames: 90, node: <Outro where="Arus Kas › Pemasukan" action="Input Pemasukan" /> };

export const TUTORIALS: Tutorials = {
    fm: buildTutorial('CashFlowFinanceManager', ROLES.fm, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.fm} title="Mencatat uang masuk & keluar" summary="Pemasukan, pengeluaran, dan transfer antar rekening, lengkap dengan buktinya." />, chapter: 'Pengantar' },
        walk('walk-income', INCOME_STEPS, ROLES.fm, 'Pemasukan'),
        chapterCard('chapter-expense', ROLES.fm, 2, 4, 'Mencatat pengeluaran', 'Kategori yang Anda pilih menentukan baris di Laba Rugi.', 'Pengeluaran'),
        walk('walk-expense', EXPENSE_STEPS, ROLES.fm),
        chapterCard('chapter-transfer', ROLES.fm, 3, 4, 'Transfer antar rekening', 'Pindah dana antar rekening sendiri, termasuk biaya admin bank.', 'Transfer'),
        walk('walk-transfer', TRANSFER_STEPS, ROLES.fm),
        chapterCard('chapter-edit', ROLES.fm, 4, 4, 'Mengoreksi catatan', 'Yang bisa diubah, dan yang harus dikoreksi dari modul asalnya.', 'Koreksi'),
        walk('walk-edit', EDIT_STEPS, ROLES.fm),
        outro,
    ]),
    admin: buildTutorial('CashFlowAdmin', ROLES.admin, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.admin} title="Akses penuh & dampaknya" summary="Apa yang berubah di rekening dan Laba Rugi setiap kali kas dicatat, diubah, atau dihapus." />, chapter: 'Pengantar' },
        { id: 'roles', frames: 270, node: <RolesScene cards={guide.roles} title="Siapa yang memakai Arus Kas" />, chapter: 'Peran' },
        { id: 'impact', frames: impactSceneFrames(guide.impacts!), node: <ImpactScene impacts={guide.impacts!} subtitle="Setiap catatan kas adalah **transaksi bank**: saldo berubah seketika, Laba Rugi mengikuti kategorinya." />, chapter: 'Dampak' },
        { id: 'record', frames: recordSceneFrames(guide.records![0]), node: <RecordScene record={guide.records![0]} />, chapter: 'Isi transfer' },
        walk('walk-impact', ADMIN_IMPACT_STEPS, ROLES.admin, 'Jejak di modul lain'),
        { id: 'warnings', frames: warningsSceneFrames(guide.warnings!.length), node: <WarningsScene warnings={guide.warnings!} />, chapter: 'Perhatian' },
        walk('walk-delete', ADMIN_DELETE_STEPS, ROLES.admin, 'Menghapus'),
        { id: 'recap', frames: 270, node: <RecapScene guide={guide} />, chapter: 'Ringkasan hak akses' },
        outro,
    ]),
};
