import { ImpactScene, impactSceneFrames, Intro, Outro, RecapScene, RecordScene, recordSceneFrames, RolesScene, WarningsScene, warningsSceneFrames } from '../components/scenes';
import { buildTutorial, chapterCard, type Tutorials, walk } from '../components/tutorial';
import { ROLES } from '../roles';
import { guide } from './guide';
import { ADMIN_TRACE_STEPS, CLASSIFY_STEPS, PDF_STEPS, READ_STEPS } from './steps';

/* Laba Rugi hanya untuk Finance manager & Admin (izin view profit-loss). */

const outro = { id: 'outro', frames: 90, node: <Outro where="Laporan › Laba Rugi" action="Unduh PDF" /> };

export const TUTORIALS: Tutorials = {
    fm: buildTutorial('ProfitLossFinanceManager', ROLES.fm, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.fm} title="Membaca & melengkapi laporan" summary="Memilih periode, memahami tiap baris, dan mengklasifikasi kategori yang belum dihitung." />, chapter: 'Pengantar' },
        walk('walk-read', READ_STEPS, ROLES.fm, 'Membaca laporan'),
        chapterCard('chapter-classify', ROLES.fm, 2, 3, 'Mengklasifikasi kategori', 'Transaksi baru dihitung setelah kategorinya punya grup Laba Rugi.', 'Klasifikasi'),
        walk('walk-classify', CLASSIFY_STEPS, ROLES.fm),
        chapterCard('chapter-pdf', ROLES.fm, 3, 3, 'Periode & PDF', 'Simpan laporan untuk periode yang Anda butuhkan.', 'Unduh PDF'),
        walk('walk-pdf', PDF_STEPS, ROLES.fm),
        outro,
    ]),
    admin: buildTutorial('ProfitLossAdmin', ROLES.admin, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.admin} title="Dari mana angka laba rugi" summary="Sumber setiap baris, apa yang tidak dihitung, dan dampak mengubah grup kategori." />, chapter: 'Pengantar' },
        { id: 'roles', frames: 270, node: <RolesScene cards={guide.roles} title="Siapa yang memakai laporan ini" />, chapter: 'Peran' },
        { id: 'impact', frames: impactSceneFrames(guide.impacts!), node: <ImpactScene impacts={guide.impacts!} title="Bagaimana laporan terbentuk" subtitle="Tidak ada input di laporan ini: semua angka mengikuti **Invoice** dan **Arus Kas**." />, chapter: 'Cara kerja' },
        { id: 'record', frames: recordSceneFrames(guide.records![0]), node: <RecordScene record={guide.records![0]} />, chapter: 'Asal tiap baris' },
        walk('walk-trace', ADMIN_TRACE_STEPS, ROLES.admin, 'Jejak di modul lain'),
        { id: 'warnings', frames: warningsSceneFrames(guide.warnings!.length), node: <WarningsScene warnings={guide.warnings!} />, chapter: 'Perhatian' },
        { id: 'recap', frames: 240, node: <RecapScene guide={guide} />, chapter: 'Ringkasan hak akses' },
        outro,
    ]),
};
