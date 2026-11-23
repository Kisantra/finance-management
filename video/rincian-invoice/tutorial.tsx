import { Intro, Outro, RecordScene, recordSceneFrames } from '../components/scenes';
import { buildTutorial, chapterCard, type Tutorials, walk } from '../components/tutorial';
import { ROLES } from '../roles';
import { guide } from './guide';
import { DECIMAL_STEPS, DETAIL_STEPS, PACKAGE_STEPS } from './steps';

/* Satu video pendek untuk Staff: Perihal & ATTENTION, baris paket, dan harga bersen. */

export const TUTORIALS: Tutorials = {
    staff: buildTutorial('RincianInvoiceStaff', ROLES.staff, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.staff} title="Menulis isi invoice seperti dokumen aslinya" summary="Perihal, ATTENTION, keterangan per baris, satu harga untuk beberapa pekerjaan, dan harga bersen." />, chapter: 'Pengantar' },
        chapterCard('chapter-detail', ROLES.staff, 1, 3, 'Perihal & ATTENTION', 'Dua isian di bagian atas invoice yang tercetak di desain perusahaan.', 'Perihal & ATTENTION'),
        walk('walk-detail', DETAIL_STEPS, ROLES.staff),
        chapterCard('chapter-package', ROLES.staff, 2, 3, 'Satu harga, beberapa pekerjaan', 'Satu baris paket dengan keterangan bernomor, bukan harga yang dipecah.', 'Baris paket'),
        { id: 'example', frames: recordSceneFrames(guide.records![0]), node: <RecordScene record={guide.records![0]} /> },
        walk('walk-package', PACKAGE_STEPS, ROLES.staff),
        chapterCard('chapter-decimal', ROLES.staff, 3, 3, 'Harga bersen & hasil cetak', 'Harga satuan dengan koma, jumlah dibulatkan, lalu periksa pratinjau cetak.', 'Harga bersen'),
        walk('walk-decimal', DECIMAL_STEPS, ROLES.staff),
        { id: 'outro', frames: 90, node: <Outro where="Keuangan › Invoice" action="Buat Invoice" /> },
    ]),
};
