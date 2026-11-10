/*
 * Inti multi bahasa (id · en · zh). Konvensi lengkap: CLAUDE.md › "Multi Bahasa".
 *
 * - Kunci = teks Indonesia persis (K1): t('Simpan Pemasukan'). Bahasa Indonesia tidak butuh kamus;
 *   kunci yang belum diterjemahkan tampil sebagai teks Indonesia, bukan kunci mentah.
 * - Kamus en/zh (resources/js/locales/*.json) dimuat lewat import() hanya untuk bahasa aktif, oleh
 *   initI18n() di inertia.tsx SEBELUM render pertama. Ganti bahasa = muat ulang penuh (POST /language
 *   dibalas Inertia::location), jadi bahasa tidak pernah berganti selama halaman hidup.
 * - JANGAN memanggil t() saat modul dimuat (konstanta tingkat modul): kamus belum siap. Tandai teksnya
 *   dengan tk() lalu terjemahkan saat render: t(LABEL[kode]).
 * - Rupiah & angka tetap format id-ID di semua bahasa (formatCurrency); hanya tanggal yang ikut bahasa.
 */
import i18next, { type TOptions } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { enGB, id as idDayPicker, zhCN, type DayPickerLocale } from 'react-day-picker/locale';

export { Trans } from 'react-i18next';

export type Bahasa = 'id' | 'en' | 'zh';

export const DAFTAR_BAHASA: readonly Bahasa[] = ['id', 'en', 'zh'];

const KAMUS: Record<Exclude<Bahasa, 'id'>, () => Promise<{ default: Record<string, string> }>> = {
    en: () => import('./locales/en.json'),
    zh: () => import('./locales/zh.json'),
};

/** Mode dev (Vite). Aman di bundler lain (Remotion/webpack) yang tidak mengenal import.meta.env. */
const DEV = import.meta.env?.DEV === true;

/** Kunci yang sudah diperingatkan, agar console tidak banjir saat render ulang. */
const sudahDiperingatkan = new Set<string>();

/**
 * Instance i18next aplikasi. Diinisialisasi sinkron saat modul dimuat dengan bahasa 'id' tanpa kamus,
 * sehingga t() selalu bekerja (termasuk di Remotion/halaman yang tidak memanggil initI18n): hasilnya
 * teks Indonesia dengan placeholder terisi.
 */
export const i18n = i18next.createInstance();

void i18n.use(initReactI18next).init({
    lng: 'id',
    fallbackLng: false,
    resources: {},
    initAsync: false,
    // Teks Indonesia boleh berisi titik dan titik dua: jangan dipecah jadi namespace/kunci bersarang.
    keySeparator: false,
    nsSeparator: false,
    // Terjemahan kosong dianggap belum ada → tampil teks Indonesia.
    returnEmptyString: false,
    returnNull: false,
    // React sudah meng-escape; escape ganda merusak "&" dan tanda kutip.
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    saveMissing: DEV,
    saveMissingPlurals: false,
    missingKeyHandler: (_bahasa, _ns, kunci) => {
        if (i18n.language === 'id' || sudahDiperingatkan.has(kunci)) {
            return;
        }
        sudahDiperingatkan.add(kunci);
        console.warn('[i18n] belum diterjemahkan:', kunci);
    },
});

function normalisasi(locale: string | null | undefined): Bahasa {
    return DAFTAR_BAHASA.includes(locale as Bahasa) ? (locale as Bahasa) : 'id';
}

/** Tag BCP 47 untuk Intl & atribut lang. EN = en-GB (tanggal-bulan-tahun, minggu mulai Senin). */
const TAG_INTL: Record<Bahasa, string> = { id: 'id-ID', en: 'en-GB', zh: 'zh-CN' };
const TAG_HTML: Record<Bahasa, string> = { id: 'id', en: 'en-GB', zh: 'zh-CN' };

/**
 * Siapkan bahasa aktif sebelum render pertama: muat kamusnya (hanya bahasa itu) lalu aktifkan.
 * Gagal memuat kamus → tetap jalan dengan teks Indonesia (lebih baik daripada layar kosong).
 */
export async function initI18n(locale: string | null | undefined): Promise<void> {
    const bahasa = normalisasi(locale);
    if (bahasa !== 'id') {
        try {
            const kamus = await KAMUS[bahasa]();
            i18n.addResourceBundle(bahasa, 'translation', kamus.default, true, true);
        } catch (galat) {
            console.error(`[i18n] kamus ${bahasa} gagal dimuat`, galat);
        }
    }
    await i18n.changeLanguage(bahasa);
    if (typeof document !== 'undefined') {
        // zh-CN memilih bentuk huruf Han aksara sederhana pada font CJK.
        document.documentElement.lang = TAG_HTML[bahasa];
    }
}

/** Bahasa tampilan yang sedang aktif. */
export function bahasaAktif(): Bahasa {
    return normalisasi(i18n.language);
}

/**
 * Terjemahkan teks Indonesia ke bahasa aktif. Panggil saat render/fungsi berjalan, BUKAN saat modul dimuat.
 *
 *   t('Simpan')                                     → "Save" / "保存"
 *   t('Hapus layanan {{name}}?', { name })          → nilai disisipkan lewat placeholder, jangan dirangkai
 *   t('{{count}} layanan', { count: total })        → en butuh "_one" & "_other" di kamus
 *   t('Jumlah', { context: 'jurnal' })              → kunci kamus "Jumlah_jurnal" (kata sama, makna beda);
 *                                                     tanpa entri itu jatuh ke "Jumlah", di ID tetap "Jumlah"
 */
export function t(kunci: string, opsi?: TOptions): string {
    return i18n.t(kunci, opsi) as string;
}

/**
 * Penanda teks untuk konstanta tingkat modul (peta label, opsi). Tidak menerjemahkan apa pun — hanya
 * menandai kunci agar ikut diperiksa pemindai — terjemahkan saat render: t(LABEL_STATUS[kode]).
 *
 * `konteks` (opsional, literal) = kata Indonesia sama tetapi terjemahannya beda menurut tempat; pemindai
 * lalu menuntut kunci kamus `kunci_konteks`. Saat render: t(label, { context: 'menu' }).
 */
export function tk<T extends string>(kunci: T, konteks?: string): T {
    void konteks;
    return kunci;
}

/* ── Tanggal ─────────────────────────────────────────────────────────────────────────────────── */

const LOCALE_TANGGAL: Record<Bahasa, DayPickerLocale> = { id: idDayPicker, en: enGB, zh: zhCN };

/**
 * Locale date-fns + label aria react-day-picker (dari `react-day-picker/locale`) untuk bahasa aktif.
 * Pakai untuk `format()` date-fns dan prop `locale` DayPicker.
 */
export function dateLocale(): DayPickerLocale {
    return LOCALE_TANGGAL[bahasaAktif()];
}

/** Tag BCP 47 bahasa aktif untuk Intl (id-ID / en-GB / zh-CN). */
export function intlLocale(): string {
    return TAG_INTL[bahasaAktif()];
}

/**
 * Gaya tanggal bernama untuk formatTanggal(). Contoh (id · en · zh):
 *   tanggal      09 Agu 2026 · 09 Aug 2026 · 2026年8月9日      (bawaan; sama dengan formatDate lama)
 *   pendek       9 Agu · 9 Aug · 8月9日
 *   panjang      9 Agustus 2026 · 9 August 2026 · 2026年8月9日
 *   hari         Minggu, 9 Agustus 2026 · Sunday, 9 August 2026 · 2026年8月9日星期日
 *   bulan        Agustus 2026 · August 2026 · 2026年8月
 *   bulanPendek  Agu 2026 · Aug 2026 · 2026年8月
 *   waktu        09 Agu 2026, 14.05 · 09 Aug 2026, 14:05 · 2026年8月9日 14:05
 *   jam          14.05 · 14:05 · 14:05
 */
export type GayaTanggal = 'tanggal' | 'pendek' | 'panjang' | 'hari' | 'bulan' | 'bulanPendek' | 'waktu' | 'jam';

const GAYA_TANGGAL: Record<GayaTanggal, Intl.DateTimeFormatOptions> = {
    tanggal: { day: '2-digit', month: 'short', year: 'numeric' },
    pendek: { day: 'numeric', month: 'short' },
    panjang: { day: 'numeric', month: 'long', year: 'numeric' },
    hari: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
    bulan: { month: 'long', year: 'numeric' },
    bulanPendek: { month: 'short', year: 'numeric' },
    waktu: { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' },
    jam: { hour: '2-digit', minute: '2-digit' },
};

const formatter = new Map<string, Intl.DateTimeFormat>();

/**
 * Nilai tanggal → Date. String "YYYY-MM-DD" / "YYYY-MM" dibaca sebagai tanggal LOKAL (tanpa geser zona
 * waktu); string lain (ISO berjam) diteruskan ke Date. Tidak valid → null.
 */
export function keTanggal(nilai: Date | string | number | null | undefined): Date | null {
    if (nilai === null || nilai === undefined || nilai === '') {
        return null;
    }
    let tanggal: Date;
    if (nilai instanceof Date) {
        tanggal = nilai;
    } else if (typeof nilai === 'string' && /^\d{4}-\d{2}(-\d{2})?$/.test(nilai)) {
        const [y, m, d] = nilai.split('-').map(Number);
        tanggal = new Date(y, m - 1, d || 1);
    } else {
        tanggal = new Date(nilai);
    }
    return Number.isNaN(tanggal.getTime()) ? null : tanggal;
}

/**
 * Format tanggal sesuai bahasa aktif (Intl). `gaya` = nama gaya di atas atau opsi Intl mentah.
 * Di zh, bulan "short" yang digabung dengan hari/tahun dibaca angka (8月), bukan singkatan.
 * Nilai kosong/tidak valid → ''.
 */
export function formatTanggal(
    nilai: Date | string | number | null | undefined,
    gaya: GayaTanggal | Intl.DateTimeFormatOptions = 'tanggal',
): string {
    const tanggal = keTanggal(nilai);
    if (!tanggal) {
        return '';
    }
    const bahasa = bahasaAktif();
    let opsi = typeof gaya === 'string' ? GAYA_TANGGAL[gaya] : gaya;
    if (bahasa === 'zh' && opsi.month === 'short' && (opsi.day || opsi.year)) {
        opsi = { ...opsi, month: 'long', day: opsi.day ? 'numeric' : undefined };
    }
    const kunci = `${bahasa}|${JSON.stringify(opsi)}`;
    let f = formatter.get(kunci);
    if (!f) {
        f = new Intl.DateTimeFormat(TAG_INTL[bahasa], opsi);
        formatter.set(kunci, f);
    }
    if (bahasa !== 'id' || opsi.month !== 'short') {
        return f.format(tanggal);
    }
    // ponytail: Intl id menyingkat Agustus "Agu", sedangkan DatePicker (date-fns) dan layar lama memakai "Agt";
    // diseragamkan ke "Agt" agar tampilan Indonesia tidak berubah.
    return f
        .formatToParts(tanggal)
        .map((bagian) => (bagian.type === 'month' && bagian.value === 'Agu' ? 'Agt' : bagian.value)) // i18n-abaikan: singkatan bulan Indonesia, bagian format tanggal
        .join('');
}

/**
 * Pola date-fns per bahasa untuk komponen kalender (DatePicker, kalender Ringkasan). ID & EN memakai
 * pola yang sama dengan sebelumnya; ZH berurutan tahun-bulan-hari. Di luar kalender, pakai formatTanggal().
 */
const POLA_TANGGAL = {
    tanggal: { id: 'dd MMM yyyy', en: 'dd MMM yyyy', zh: 'yyyy年M月d日' },
    tanggalRingkas: { id: 'd MMM yyyy', en: 'd MMM yyyy', zh: 'yyyy年M月d日' },
    tanggalPanjang: { id: 'd MMMM yyyy', en: 'd MMMM yyyy', zh: 'yyyy年M月d日' },
    hariBulan: { id: 'dd MMM', en: 'dd MMM', zh: 'M月d日' },
    hariBulanRingkas: { id: 'd MMM', en: 'd MMM', zh: 'M月d日' },
    bulanTahun: { id: 'MMMM yyyy', en: 'MMMM yyyy', zh: 'yyyy年M月' },
    judulKalender: { id: 'MMMM, yyyy', en: 'MMMM yyyy', zh: 'yyyy年M月' },
} as const satisfies Record<string, Record<Bahasa, string>>;

export type PolaTanggal = keyof typeof POLA_TANGGAL;

export function polaTanggal(gaya: PolaTanggal): string {
    return POLA_TANGGAL[gaya][bahasaAktif()];
}
