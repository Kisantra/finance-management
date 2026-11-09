/**
 * Katalog bank & dompet digital Indonesia untuk saran Nama Bank dan logo di modul Kas & Bank.
 *
 * `bank_accounts.bank_name` tetap teks bebas: katalog ini hanya membantu mengisi dan mengenali
 * logo. Logo (SVG, versi tanda/simbol persegi) ada di `public/images/banks/{slug}.svg`.
 */
export interface BankInfo {
    /** Nama berkas logo. */
    slug: string;
    /** Nama yang diisikan ke field saat dipilih dari daftar. */
    name: string;
    /** Nama resmi atau keterangan singkat, tampil di bawah nama pada daftar saran. */
    description: string;
    /** Ejaan lain yang juga dikenali (singkatan, nama lama, nama produk). */
    aliases: string[];
}

const EWALLET = 'Dompet digital';

export const BANKS: BankInfo[] = [
    { slug: 'bca', name: 'BCA', description: 'PT Bank Central Asia Tbk', aliases: ['Bank Central Asia', 'Bank BCA'] },
    { slug: 'mandiri', name: 'Bank Mandiri', description: 'PT Bank Mandiri (Persero) Tbk', aliases: ['Mandiri', "Livin' by Mandiri"] },
    { slug: 'bni', name: 'BNI', description: 'PT Bank Negara Indonesia (Persero) Tbk', aliases: ['Bank Negara Indonesia', 'Bank BNI', 'BNI 46', 'wondr'] },
    { slug: 'bri', name: 'BRI', description: 'PT Bank Rakyat Indonesia (Persero) Tbk', aliases: ['Bank Rakyat Indonesia', 'Bank BRI', 'BRImo'] },
    { slug: 'bsi', name: 'BSI', description: 'PT Bank Syariah Indonesia Tbk', aliases: ['Bank Syariah Indonesia', 'Bank BSI'] },
    { slug: 'btn', name: 'BTN', description: 'PT Bank Tabungan Negara (Persero) Tbk', aliases: ['Bank Tabungan Negara', 'Bank BTN'] },
    { slug: 'bsn', name: 'Bank Syariah Nasional', description: 'BSN, d/h BTN Syariah', aliases: ['BSN', 'BTN Syariah'] },
    { slug: 'cimb-niaga', name: 'CIMB Niaga', description: 'PT Bank CIMB Niaga Tbk', aliases: ['Bank CIMB Niaga', 'CIMB', 'Niaga', 'OCTO'] },
    { slug: 'danamon', name: 'Bank Danamon', description: 'PT Bank Danamon Indonesia Tbk', aliases: ['Danamon'] },
    { slug: 'permata', name: 'PermataBank', description: 'PT Bank Permata Tbk', aliases: ['Permata', 'Bank Permata', 'Permata Bank'] },
    { slug: 'ocbc', name: 'OCBC', description: 'PT Bank OCBC NISP Tbk', aliases: ['OCBC NISP', 'Bank OCBC', 'NISP'] },
    { slug: 'panin', name: 'Panin Bank', description: 'PT Bank Panin Indonesia Tbk', aliases: ['Panin', 'Bank Panin', 'PaninBank'] },
    { slug: 'maybank', name: 'Maybank', description: 'PT Bank Maybank Indonesia Tbk', aliases: ['Maybank Indonesia', 'Bank Maybank', 'BII', 'Bank Internasional Indonesia'] },
    { slug: 'mega', name: 'Bank Mega', description: 'PT Bank Mega Tbk', aliases: ['Mega'] },
    { slug: 'uob', name: 'UOB', description: 'PT Bank UOB Indonesia', aliases: ['UOB Indonesia', 'Bank UOB', 'TMRW'] },
    { slug: 'sinarmas', name: 'Bank Sinarmas', description: 'PT Bank Sinarmas Tbk', aliases: ['Sinarmas'] },
    { slug: 'smbc', name: 'SMBC Indonesia', description: 'PT Bank SMBC Indonesia Tbk, d/h Bank BTPN', aliases: ['SMBC', 'BTPN', 'Bank BTPN'] },
    { slug: 'jenius', name: 'Jenius', description: 'Bank SMBC Indonesia', aliases: [] },
    { slug: 'kb-bank', name: 'KB Bank', description: 'd/h Bank KB Bukopin', aliases: ['KB Bukopin', 'Bukopin', 'Bank Bukopin'] },
    { slug: 'muamalat', name: 'Bank Muamalat', description: 'PT Bank Muamalat Indonesia Tbk', aliases: ['Muamalat'] },
    { slug: 'bca-syariah', name: 'BCA Syariah', description: 'PT Bank BCA Syariah', aliases: [] },
    { slug: 'bank-jakarta', name: 'Bank Jakarta', description: 'd/h Bank DKI', aliases: ['Bank DKI', 'DKI'] },
    { slug: 'bank-jatim', name: 'Bank Jatim', description: 'PT Bank Pembangunan Daerah Jawa Timur Tbk', aliases: ['Jatim'] },
    { slug: 'jago', name: 'Bank Jago', description: 'PT Bank Jago Tbk', aliases: ['Jago'] },
    { slug: 'seabank', name: 'SeaBank', description: 'PT Bank Seabank Indonesia', aliases: ['Sea Bank', 'Bank SeaBank'] },
    { slug: 'blu', name: 'blu by BCA Digital', description: 'PT Bank Digital BCA', aliases: ['blu', 'BCA Digital', 'Bank Digital BCA'] },
    { slug: 'allo', name: 'Allo Bank', description: 'PT Allo Bank Indonesia Tbk', aliases: ['Allo'] },
    { slug: 'superbank', name: 'Superbank', description: 'PT Super Bank Indonesia', aliases: ['Super Bank'] },
    { slug: 'bank-raya', name: 'Bank Raya', description: 'PT Bank Raya Indonesia Tbk', aliases: ['Raya Digital', 'BRI Agro'] },
    { slug: 'neobank', name: 'neobank', description: 'PT Bank Neo Commerce Tbk', aliases: ['Bank Neo Commerce', 'Neo Bank', 'BNC'] },
    { slug: 'hana', name: 'Hana Bank', description: 'PT Bank KEB Hana Indonesia', aliases: ['KEB Hana', 'LINE Bank'] },
    { slug: 'hsbc', name: 'HSBC', description: 'PT Bank HSBC Indonesia', aliases: ['Bank HSBC'] },
    { slug: 'stanchart', name: 'Standard Chartered', description: 'Standard Chartered Bank Indonesia', aliases: ['StanChart'] },
    { slug: 'citi', name: 'Citibank', description: 'Citibank N.A. Indonesia', aliases: ['Citi'] },
    { slug: 'dbs', name: 'DBS', description: 'PT Bank DBS Indonesia', aliases: ['Bank DBS', 'digibank'] },
    { slug: 'gopay', name: 'GoPay', description: EWALLET, aliases: ['Go Pay'] },
    { slug: 'ovo', name: 'OVO', description: EWALLET, aliases: [] },
    { slug: 'dana', name: 'DANA', description: EWALLET, aliases: [] },
    { slug: 'shopeepay', name: 'ShopeePay', description: EWALLET, aliases: ['Shopee Pay'] },
    { slug: 'linkaja', name: 'LinkAja', description: EWALLET, aliases: ['Link Aja'] },
];

/** Kata hukum yang tidak membedakan bank ("PT", "Tbk", "(Persero)"). */
const NOISE = new Set(['pt', 'tbk', 'persero']);

export function normalizeBankName(text: string): string {
    return text
        .toLowerCase()
        .replace(/['’`]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .split(' ')
        .filter((word) => word && !NOISE.has(word))
        .join(' ');
}

/** Ejaan ternormalisasi → bank, terpanjang lebih dulu agar "BCA Syariah" tidak terbaca "BCA". */
const LOOKUP: [string, BankInfo][] = BANKS.flatMap((bank) =>
    [bank.name, ...bank.aliases].map((spelling): [string, BankInfo] => [normalizeBankName(spelling), bank]),
).sort((a, b) => b[0].length - a[0].length);

/**
 * Mengenali bank dari nama yang diketik bebas: "Bank Central Asia", "PT BCA Tbk", "BCA KCP Sudirman"
 * → BCA. Cocok bila salah satu ejaan muncul sebagai kata utuh; ejaan terpanjang menang.
 */
export function findBank(bankName: string | null | undefined): BankInfo | null {
    if (!bankName) return null;
    const padded = ` ${normalizeBankName(bankName)} `;
    if (padded.trim() === '') return null;

    for (const [spelling, bank] of LOOKUP) {
        if (padded.includes(` ${spelling} `)) return bank;
    }
    return null;
}

export function bankLogoUrl(bank: Pick<BankInfo, 'slug'>): string {
    return `/images/banks/${bank.slug}.svg`;
}
