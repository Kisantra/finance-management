import { FlowScene, flowSceneFrames, ImpactScene, impactSceneFrames, Intro, Outro, RecapScene, RecordScene, recordSceneFrames, RolesScene, WarningsScene, warningsSceneFrames } from '../components/scenes';
import { buildTutorial, chapterCard, type Tutorials, walk } from '../components/tutorial';
import { ROLES } from '../roles';
import { guide } from './guide';
import { ADMIN_IMPACT_STEPS, ADMIN_STEPS, FM_FOLLOWUP_STEPS, FM_PAY_STEPS, FM_SEND_STEPS, PRINT_STEPS, STAFF_STEPS } from './steps';

/* Satu video per role (tab di dialog Tutorial & halaman /panduan). */

const flow = guide.flow!;
const outro = { id: 'outro', frames: 90, node: <Outro where="Keuangan › Invoice" action="Buat Invoice" /> };
const flowScene = { id: 'flow', frames: flowSceneFrames(flow), node: <FlowScene flow={flow} title="Perjalanan sebuah invoice" />, chapter: 'Alur' };

export const TUTORIALS: Tutorials = {
    staff: buildTutorial('InvoicesStaff', ROLES.staff, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.staff} title="Menyusun invoice untuk klien" summary="Dari memilih klien dan layanan sampai invoice tersimpan dan siap diterbitkan." />, chapter: 'Pengantar' },
        flowScene,
        walk('walk-create', STAFF_STEPS, ROLES.staff, 'Membuat invoice'),
        chapterCard('chapter-print', ROLES.staff, 2, 2, 'Mencetak invoice', 'Invoice yang sudah bernomor bisa dicetak atau diunduh sebagai PDF.', 'Cetak PDF'),
        walk('walk-print', PRINT_STEPS, ROLES.staff),
        outro,
    ]),
    fm: buildTutorial('InvoicesFinanceManager', ROLES.fm, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.fm} title="Menerbitkan & menagih invoice" summary="Memberi nomor resmi, mencetak PDF, mencatat pembayaran, dan mengejar yang lewat jatuh tempo." />, chapter: 'Pengantar' },
        flowScene,
        walk('walk-send', FM_SEND_STEPS, ROLES.fm, 'Menerbitkan'),
        chapterCard('chapter-print', ROLES.fm, 2, 4, 'Mencetak PDF', 'Tagihan penuh, uang muka, atau pelunasan dengan template pilihan.', 'Cetak PDF'),
        walk('walk-print', PRINT_STEPS, ROLES.fm),
        chapterCard('chapter-pay', ROLES.fm, 3, 4, 'Mencatat pembayaran', 'Setiap uang masuk dicatat ke rekening tujuannya; status mengikuti otomatis.', 'Pembayaran'),
        walk('walk-pay', FM_PAY_STEPS, ROLES.fm),
        chapterCard('chapter-followup', ROLES.fm, 4, 4, 'Menagih & rekap', 'Pantau invoice yang lewat jatuh tempo dan ekspor rekap untuk laporan.', 'Perlu ditagih'),
        walk('walk-followup', FM_FOLLOWUP_STEPS, ROLES.fm),
        outro,
    ]),
    admin: buildTutorial('InvoicesAdmin', ROLES.admin, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.admin} title="Akses penuh & dampaknya" summary="Apa yang berubah di rekening, arus kas, dan laba rugi saat invoice diterbitkan dan dibayar." />, chapter: 'Pengantar' },
        { id: 'roles', frames: 300, node: <RolesScene cards={guide.roles} title="Tiga peran di modul ini" />, chapter: 'Tiga peran' },
        { id: 'impact', frames: impactSceneFrames(guide.impacts!), node: <ImpactScene impacts={guide.impacts!} subtitle="Menerbitkan belum memindahkan uang. **Pembayaran** yang mengubah rekening dan laporan." />, chapter: 'Dampak' },
        { id: 'record', frames: recordSceneFrames(guide.records![0]), node: <RecordScene record={guide.records![0]} />, chapter: 'Data pembayaran' },
        { id: 'record-pl', frames: recordSceneFrames(guide.records![1]), node: <RecordScene record={guide.records![1]} />, chapter: 'Laba rugi' },
        walk('walk-impact', ADMIN_IMPACT_STEPS, ROLES.admin, 'Jejak di modul lain'),
        { id: 'warnings', frames: warningsSceneFrames(guide.warnings!.length), node: <WarningsScene warnings={guide.warnings!} />, chapter: 'Perhatian' },
        walk('walk-admin', ADMIN_STEPS, ROLES.admin, 'Menghapus'),
        { id: 'recap', frames: 300, node: <RecapScene guide={guide} />, chapter: 'Ringkasan hak akses' },
        outro,
    ]),
};
