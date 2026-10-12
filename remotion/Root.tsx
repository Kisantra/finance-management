import './style.css';
import { Composition } from 'remotion';
import { REIMBURSEMENT_TUTORIALS } from './reimbursements/tutorial';

/** Daftar video. Tambah modul baru: buat folder remotion/<modul>/ lalu daftarkan di sini. */
export function RemotionRoot() {
    return (
        <>
            {Object.values(REIMBURSEMENT_TUTORIALS).map((t) => (
                <Composition key={t.id} id={t.id} component={t.component} durationInFrames={t.frames} fps={30} width={1920} height={1080} />
            ))}
        </>
    );
}
