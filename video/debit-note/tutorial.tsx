import { FlowScene, flowSceneFrames, ImpactScene, impactSceneFrames, Intro, Outro, RecapScene, RecordScene, recordSceneFrames, RolesScene, WarningsScene, warningsSceneFrames } from '../components/scenes';
import { buildTutorial, chapterCard, type Tutorials, walk } from '../components/tutorial';
import { ROLES } from '../roles';
import { guide } from './guide';
import { ADMIN_IMPACT_STEPS, ADMIN_SETUP_STEPS, STAFF_JASA_STEPS, STAFF_TALANGAN_STEPS } from './steps';

/* Video pendek untuk pemula: Staff membuat Debit Note; Admin menyalakannya dan melihat dampaknya. */

const flow = guide.flow!;
const outro = { id: 'outro', frames: 90, node: <Outro where="Keuangan › Invoice" action="Buat Invoice › Debit Note" /> };
const example = { id: 'example', frames: recordSceneFrames(guide.records![0]), node: <RecordScene record={guide.records![0]} />, chapter: 'Contoh' };

export const TUTORIALS: Tutorials = {
    staff: buildTutorial('DebitNoteStaff', ROLES.staff, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.staff} title="Menagih kembali biaya klien" summary="Biaya yang sudah perusahaan bayar atas nama klien ditagih lewat Debit Note: tanpa PPN dan bukan pendapatan." />, chapter: 'Pengantar' },
        example,
        { id: 'flow', frames: flowSceneFrames(flow), node: <FlowScene flow={flow} title="Perjalanan sebuah Debit Note" />, chapter: 'Alur' },
        walk('walk-talangan', STAFF_TALANGAN_STEPS, ROLES.staff, 'Debit Note talangan'),
        chapterCard('chapter-jasa', ROLES.staff, 2, 2, 'Debit Note tagihan jasa', 'Dokumen berjudul Debit Note yang isinya jasa perusahaan: dihitung seperti invoice.', 'Tagihan jasa'),
        walk('walk-jasa', STAFF_JASA_STEPS, ROLES.staff),
        outro,
    ]),
    admin: buildTutorial('DebitNoteAdmin', ROLES.admin, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.admin} title="Menyalakan & memahami dampaknya" summary="Satu centang di Profil perusahaan, lalu ke mana uang talangan dibukukan saat diganti klien." />, chapter: 'Pengantar' },
        { id: 'roles', frames: 300, node: <RolesScene cards={guide.roles} title="Tiga peran untuk Debit Note" />, chapter: 'Tiga peran' },
        walk('walk-setup', ADMIN_SETUP_STEPS, ROLES.admin, 'Menyalakan'),
        { id: 'impact', frames: impactSceneFrames(guide.impacts!), node: <ImpactScene impacts={guide.impacts!} subtitle="Talangan **bukan pendapatan**: uang dari klien dan biaya ke negara saling menutup." />, chapter: 'Dampak' },
        walk('walk-impact', ADMIN_IMPACT_STEPS, ROLES.admin, 'Jejak di pembukuan'),
        { id: 'warnings', frames: warningsSceneFrames(guide.warnings!.length), node: <WarningsScene warnings={guide.warnings!} />, chapter: 'Perhatian' },
        { id: 'recap', frames: 300, node: <RecapScene guide={guide} />, chapter: 'Ringkasan hak akses' },
        { id: 'outro', frames: 90, node: <Outro where="Pengaturan › Profil perusahaan" action="Debit Note" /> },
    ]),
};
