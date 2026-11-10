import { t, tk } from '@/i18n';

/**
 * Peran bawaan: nama di database (= teks yang tampil di Bahasa Indonesia) sekaligus kunci terjemahan.
 * Peran buatan pengguna adalah data dan tampil apa adanya. Pencocokan izin tetap memakai nama asli.
 */
const PERAN_BAWAAN: ReadonlySet<string> = new Set([tk('admin'), tk('finance manager'), tk('staff')]);

/** Label tampilan nama peran: peran bawaan diterjemahkan, peran buatan sendiri tidak. */
export function roleLabel(name: string): string {
    return PERAN_BAWAAN.has(name) ? t(name) : name;
}
