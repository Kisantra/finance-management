import { Intro, Outro } from '../components/scenes';
import { buildTutorial, chapterCard, type Tutorials, walk } from '../components/tutorial';
import { ROLES } from '../roles';
import { guide } from './guide';
import { GUEST_STEPS, SWITCH_STEPS } from './steps';

/* Satu video pendek: berlaku sama untuk semua peran. */

export const TUTORIALS: Tutorials = {
    staff: buildTutorial('BahasaStaff', ROLES.staff, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.staff} title="Indonesia, English, atau 中文" summary="Satu klik di kanan atas mengganti bahasa tampilan untuk akun Anda." />, chapter: 'Pengantar' },
        walk('walk-switch', SWITCH_STEPS, ROLES.staff, 'Setelah masuk'),
        chapterCard('chapter-guest', ROLES.staff, 2, 2, 'Sebelum masuk', 'Bahasa juga bisa dipilih di halaman Masuk, lalu ikut ke akun Anda.', 'Halaman masuk'),
        walk('walk-guest', GUEST_STEPS, ROLES.staff),
        { id: 'outro', frames: 90, node: <Outro where="Kanan atas" action="ID · EN · ZH" /> },
    ]),
};
