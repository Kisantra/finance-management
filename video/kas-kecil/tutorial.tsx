import { ImpactScene, impactSceneFrames, Intro, Outro, RecapScene, RecordScene, recordSceneFrames, WarningsScene, warningsSceneFrames } from '../components/scenes';
import { buildTutorial, chapterCard, type Tutorials, walk } from '../components/tutorial';
import { ROLES } from '../roles';
import { guide } from './guide';
import { NEW_STEPS, REFILL_STEPS } from './steps';

/* Video pendek untuk pemula: Finance manager membuat dan mengisi ulang kas kecil; Admin melihat dampaknya. */

const example = { id: 'example', frames: recordSceneFrames(guide.records![0]), node: <RecordScene record={guide.records![0]} />, chapter: 'Contoh isi ulang' };
const outro = { id: 'outro', frames: 90, node: <Outro where="Keuangan › Kas & Bank" action="Tambah Akun › Kas" /> };

export const TUTORIALS: Tutorials = {
    fm: buildTutorial('KasKecilFinanceManager', ROLES.fm, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.fm} title="Uang tunai harian, tercatat rapi" summary="Buat akun kas dengan penanggung jawab dan plafon, lalu isi ulang dengan satu klik." />, chapter: 'Pengantar' },
        chapterCard('chapter-new', ROLES.fm, 1, 2, 'Membuat kas kecil', 'Akun berjenis Kas: tanpa nomor rekening, dengan penanggung jawab dan plafon.', 'Membuat'),
        walk('walk-new', NEW_STEPS, ROLES.fm),
        chapterCard('chapter-refill', ROLES.fm, 2, 2, 'Mengisi ulang', 'Kekurangan dihitung otomatis; transfer dari rekening bank mengembalikan saldo ke plafon.', 'Isi ulang'),
        example,
        walk('walk-refill', REFILL_STEPS, ROLES.fm),
        outro,
    ]),
    admin: buildTutorial('KasKecilAdmin', ROLES.admin, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.admin} title="Isi ulang bukan pengeluaran" summary="Belanja dari kas masuk Laba Rugi; isi ulang hanya memindahkan uang dari bank ke kas." />, chapter: 'Pengantar' },
        { id: 'impact', frames: impactSceneFrames(guide.impacts!), node: <ImpactScene impacts={guide.impacts!} subtitle="Yang menjadi beban adalah **belanjanya**, bukan isi ulangnya." />, chapter: 'Dampak' },
        example,
        walk('walk-refill', REFILL_STEPS, ROLES.fm, 'Isi ulang'),
        { id: 'warnings', frames: warningsSceneFrames(guide.warnings!.length), node: <WarningsScene warnings={guide.warnings!} />, chapter: 'Perhatian' },
        { id: 'recap', frames: 300, node: <RecapScene guide={guide} />, chapter: 'Ringkasan hak akses' },
        outro,
    ]),
};
