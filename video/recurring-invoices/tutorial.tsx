import { FlowScene, flowSceneFrames, ImpactScene, impactSceneFrames, Intro, Outro, RecapScene, RecordScene, recordSceneFrames, RolesScene, WarningsScene, warningsSceneFrames } from '../components/scenes';
import { buildTutorial, type Tutorials, walk } from '../components/tutorial';
import { ROLES } from '../roles';
import { guide } from './guide';
import { ADMIN_IMPACT_STEPS, ADMIN_STEPS, MONTHLY_STEPS, PUBLISH_STEPS, TEMPLATE_STEPS } from './steps';

/* Satu video per role. Staff tidak punya akses ke modul ini. */

const flow = guide.flow!;
const flowScene = { id: 'flow', frames: flowSceneFrames(flow), node: <FlowScene flow={flow} title="Dari template sampai invoice terkirim" />, chapter: 'Alur' };
const outro = { id: 'outro', frames: 90, node: <Outro where="Keuangan › Invoice Berulang" action="Buat Template" /> };

export const TUTORIALS: Tutorials = {
    fm: buildTutorial('RecurringInvoicesFinanceManager', ROLES.fm, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.fm} title="Menagih klien rutin tanpa mengetik ulang" summary="Susun template sekali, generate setiap bulan, lalu publish menjadi invoice." />, chapter: 'Pengantar' },
        flowScene,
        walk('walk-template', TEMPLATE_STEPS, ROLES.fm, 'Membuat template'),
        walk('walk-monthly', MONTHLY_STEPS, ROLES.fm, 'Generate bulanan'),
        walk('walk-publish', PUBLISH_STEPS, ROLES.fm, 'Publish & analitik'),
        outro,
    ]),
    admin: buildTutorial('RecurringInvoicesAdmin', ROLES.admin, [
        { id: 'intro', frames: 105, node: <Intro module={guide.title} role={ROLES.admin} title="Akses penuh & dampaknya" summary="Apa yang dibuat di menu Invoice saat draft di-publish, dan apa yang terjadi saat data dihapus." />, chapter: 'Pengantar' },
        { id: 'roles', frames: 240, node: <RolesScene cards={guide.roles} title="Siapa yang memakai modul ini" />, chapter: 'Peran' },
        flowScene,
        { id: 'impact', frames: impactSceneFrames(guide.impacts!), node: <ImpactScene impacts={guide.impacts!} subtitle="Template dan draft belum menyentuh uang. **Publish** yang membuat invoice di menu Invoice." />, chapter: 'Dampak' },
        { id: 'record', frames: recordSceneFrames(guide.records![0]), node: <RecordScene record={guide.records![0]} />, chapter: 'Invoice hasil publish' },
        walk('walk-impact', ADMIN_IMPACT_STEPS, ROLES.admin, 'Jejak di modul lain'),
        { id: 'warnings', frames: warningsSceneFrames(guide.warnings!.length), node: <WarningsScene warnings={guide.warnings!} />, chapter: 'Perhatian' },
        walk('walk-admin', ADMIN_STEPS, ROLES.admin, 'Arsip & hapus template'),
        { id: 'recap', frames: 300, node: <RecapScene guide={guide} />, chapter: 'Ringkasan hak akses' },
        outro,
    ]),
};
