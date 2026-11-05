/** Saran kode URL & singkatan dari nama perusahaan — dipakai walkthrough instalasi dan halaman Perusahaan. */

const LEGAL = /^(pt|cv|ud|pd|tb)\.?\s+/i;

/** "PT Semesta Raya" → "semesta-raya" (aturan sama dengan validasi slug di server, maks. 40). */
export function suggestSlug(name: string): string {
    return name
        .replace(LEGAL, '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
}

/** "PT Semesta Raya" → "SR" (huruf awal tiap kata, maks. 10). */
export function suggestAbbreviation(name: string): string {
    return name
        .replace(LEGAL, '')
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word.replace(/[^A-Za-z]/g, '').charAt(0).toUpperCase())
        .join('')
        .slice(0, 10);
}
