#!/usr/bin/env node
/**
 * Pemindai multi bahasa frontend — lapis 1 jaring "tidak ada yang terlewat".
 *
 *   npm run i18n:check                          # seluruh resources/js
 *   npm run i18n:check -- --scope pages/invoices # hanya folder/berkas tertentu (boleh berulang)
 *   npm run i18n:check -- --ringkas             # hanya ringkasan per folder
 *   npm run i18n:check -- --kunci-hilang x.json # tulis kunci yang belum ada di kamus (bahan penerjemah)
 *
 * Yang diperiksa (galat = keluar dengan kode 1):
 *   teks-keras       teks tampilan yang belum lewat t(): teks JSX, prop teks (label, placeholder, title,
 *                    aria-label, alt, …), argumen toast/confirm, nilai peta label, nilai bawaan prop teks,
 *                    serta kalimat yang dikembalikan fungsi / disimpan ke variabel / dikirim ke setState.
 *   kunci-hilang     kunci t() / tk() / <Trans i18nKey> yang belum ada di locales/en.json atau zh.json
 *                    (kunci ber-count: en wajib _one + _other, zh wajib _other; konteks literal
 *                    t('X', { context: 'menu' }) / tk('X', 'menu') → kunci kamus "X_menu").
 *   nama-t-bentrok   variabel/parameter lokal bernama `t` di berkas yang mengimpor t dari @/i18n.
 *   placeholder      {{nama}} di terjemahan tidak sama dengan di kunci.
 *   tag              tag <b>…</b> / <1>…</1> di terjemahan tidak sama dengan di kunci.
 *   nilai-kosong     terjemahan berupa string kosong.
 *   kunci-dinamis    t(`… ${x}`) atau t('…' + x): pakai placeholder {{x}}.
 *   tk-bukan-literal tk() wajib berisi literal string.
 *   t-tingkat-modul  t() dipanggil saat modul dimuat (sebelum kamus siap): pakai tk() lalu t() saat render.
 *   abaikan-tanpa-alasan  komentar i18n-abaikan tanpa alasan.
 * Peringatan (tidak menggagalkan): kunci kamus yang tidak dipakai (hanya saat memindai seluruh folder).
 *
 * Pengecualian SATU baris: komentar `// i18n-abaikan: <alasan>` (atau `{/* i18n-abaikan: <alasan> *\/}`
 * di JSX) di baris yang sama atau tepat di atasnya. Tanpa alasan = galat.
 *
 * Tidak dipindai: pages/guide/** (panduan tetap Bahasa Indonesia, K3), berkas hasil generator Wayfinder
 * (routes/, actions/, wayfinder/), dan berkas .d.ts. Folder video/ berada di luar resources/js.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'resources', 'js');
const BERKAS_KAMUS = {
    en: path.join(SRC, 'locales', 'en.json'),
    zh: path.join(SRC, 'locales', 'zh.json'),
};
const DIABAIKAN = ['pages/guide/', 'routes/', 'actions/', 'wayfinder/', 'locales/'];

/* ── Argumen ─────────────────────────────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const cakupan = [];
let hanyaRingkasan = false;
/** Berkas JSON tujuan daftar kunci yang belum ada di kamus (bahan kerja penerjemah). */
let berkasKunciHilang = null;
for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--scope' || a === '--cakupan') {
        cakupan.push(argv[++i]);
    } else if (a.startsWith('--scope=') || a.startsWith('--cakupan=')) {
        cakupan.push(a.split('=').slice(1).join('='));
    } else if (a === '--ringkas' || a === '--summary') {
        hanyaRingkasan = true;
    } else if (a === '--kunci-hilang') {
        berkasKunciHilang = argv[++i];
    } else if (a === '--help' || a === '-h') {
        console.log('Pemakaian: node scripts/i18n-check.mjs [--scope <folder|berkas>]... [--ringkas] [--kunci-hilang <berkas.json>]');
        process.exit(0);
    } else {
        console.error(`Argumen tidak dikenal: ${a}`);
        process.exit(2);
    }
}

/** Path cakupan boleh relatif ke akar repo atau ke resources/js. */
function resolveCakupan(p) {
    if (!p) {
        return null;
    }
    const kandidat = [path.resolve(ROOT, p), path.resolve(SRC, p)];
    const ada = kandidat.find((k) => fs.existsSync(k));
    if (!ada) {
        console.error(`Cakupan tidak ditemukan: ${p}`);
        process.exit(2);
    }
    return ada;
}
const cakupanAbs = cakupan.map(resolveCakupan);
const pindaiPenuh = cakupanAbs.length === 0;

/* ── Daftar berkas ───────────────────────────────────────────────────────────────────────────── */

const rel = (abs) => path.relative(SRC, abs).split(path.sep).join('/');

function daftarBerkas(dir) {
    const hasil = [];
    for (const entri of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, entri.name);
        if (entri.isDirectory()) {
            if (entri.name === 'node_modules') {
                continue;
            }
            hasil.push(...daftarBerkas(abs));
        } else if (/\.(ts|tsx)$/.test(entri.name) && !entri.name.endsWith('.d.ts')) {
            hasil.push(abs);
        }
    }
    return hasil;
}

const semuaBerkas = daftarBerkas(SRC).filter((abs) => !DIABAIKAN.some((d) => rel(abs).startsWith(d)));
const berkasDipindai = pindaiPenuh
    ? semuaBerkas
    : semuaBerkas.filter((abs) => cakupanAbs.some((c) => abs === c || abs.startsWith(c + path.sep)));

/* ── Kamus ───────────────────────────────────────────────────────────────────────────────────── */

function bacaKamus(berkas) {
    if (!fs.existsSync(berkas)) {
        return {};
    }
    try {
        return JSON.parse(fs.readFileSync(berkas, 'utf8'));
    } catch (e) {
        console.error(`Kamus tidak valid (${path.relative(ROOT, berkas)}): ${e.message}`);
        process.exit(2);
    }
}
const kamus = { en: bacaKamus(BERKAS_KAMUS.en), zh: bacaKamus(BERKAS_KAMUS.zh) };

/* ── Heuristik "teks manusia" ────────────────────────────────────────────────────────────────── */

/** Kata/frasa yang tidak diterjemahkan (merek, simbol mata uang, format berkas, tombol keyboard, endonim). */
const DIIZINKAN = [
    'Kisantra Finance', 'Finance Management', 'Kisantra', 'Claude', 'Anthropic', 'Watchpost', 'Rp',
    'PDF', 'Excel', 'XLSX', 'CSV', 'JPG', 'JPEG', 'PNG', 'WEBP', 'SVG', 'KB', 'MB', 'GB', 'URL', 'OAuth',
    'Esc', 'Enter', 'Ctrl', 'Shift', 'Cmd', 'Alt', 'Tab', 'Indonesia', 'English', '中文', 'ID', 'EN', 'ZH',
];
const POLA_DIIZINKAN = DIIZINKAN.map(
    (kata) => new RegExp(`(^|[^\\p{L}])${kata.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^\\p{L}])`, 'gu'),
);

/** Utilitas Tailwind yang berdiri tanpa tanda hubung. Kata lain hanya dianggap kelas bila ber-awalan + "-". */
const UTILITAS_TUNGGAL = new Set([
    'flex', 'grid', 'hidden', 'block', 'inline', 'contents', 'table', 'truncate', 'italic', 'underline',
    'uppercase', 'lowercase', 'capitalize', 'visible', 'invisible', 'absolute', 'relative', 'fixed', 'sticky',
    'static', 'isolate', 'antialiased', 'container', 'grow', 'shrink', 'border', 'rounded', 'shadow', 'ring',
    'outline', 'transition', 'filter', 'group', 'peer', 'dark', 'prose', 'tabular-nums',
]);
const AWALAN_TAILWIND =
    /^(?:bg|text|border|rounded|ring|shadow|font|leading|tracking|items|justify|content|gap|space|[mp][xytrbls]?|w|h|min|max|size|flex|grid|col|row|inline|block|top|left|right|bottom|inset|z|opacity|overflow|whitespace|break|cursor|select|pointer|transition|duration|ease|delay|animate|translate|rotate|scale|origin|fill|stroke|outline|divide|place|self|order|aspect|object|backdrop|blur|sr|not|line|underline|decoration|tabular|ob|group|peer|shrink|grow|basis|list|align|accent|caret|appearance|resize|snap|scroll|touch|will|mix|float|clear|columns|drop|sepia|invert|grayscale|saturate|hue|brightness|contrast|data|aria|focus|hover|active|disabled|motion|print|dark|sm|md|lg|xl|2xl|first|last|odd|even|placeholder|file|marker|selection|before|after|outline|stroke|skew|transform|gradient|from|via|to)-/;

function tokenTailwind(tk) {
    if (/\[[^\]]+\]/.test(tk) || /^[a-z0-9-]+:[!-]?[a-z]/.test(tk) || /[a-z]-\d+\/\d/.test(tk)) {
        return true; // nilai bebas [..], varian hover:x, pecahan w-1/2
    }
    const inti = tk.replace(/^!/, '').replace(/^-/, '');
    return UTILITAS_TUNGGAL.has(inti) || AWALAN_TAILWIND.test(inti);
}

function miripCss(s) {
    const token = s.split(/\s+/).filter(Boolean);
    if (token.length === 0) {
        return false;
    }
    const pantas = token.every((tk) => /^[!-]?[a-z0-9@*&>[\]()_.:/%#,'"=~+-]+$/.test(tk) || /\[.*\]/.test(tk));
    if (!pantas) {
        return false;
    }
    return token.some(tokenTailwind);
}

/** Pola format date-fns ("dd MMM yyyy", "PPP"): setiap rangkaian huruf adalah satu huruf yang diulang. */
function miripPolaTanggal(s) {
    const runs = s.match(/\p{L}+/gu) ?? [];
    return (
        runs.length > 0 &&
        runs.every((r) => /^([yMdEHhmsaSLceiQqwkKXxzOPptTGuD])\1*$/.test(r)) &&
        runs.some((r) => r.length >= 2)
    );
}

/** Kata kunci nilai CSS (huruf kecil persis; "Center" berhuruf kapital tetap dianggap teks). */
const KATA_CSS = new Set([
    'left', 'right', 'top', 'bottom', 'center', 'auto', 'none', 'solid', 'dashed', 'dotted', 'transparent',
    'inherit', 'initial', 'unset', 'linear', 'radial', 'conic', 'gradient', 'repeating', 'to', 'px', 'rem', 'em',
    'vh', 'vw', 'dvh', 'deg', 'turn', 'ms', 'rgba', 'rgb', 'hsl', 'oklch', 'var', 'calc', 'min', 'max', 'clamp',
    'ease', 'in', 'out', 'infinite', 'alternate', 'forwards', 'backwards', 'both', 'normal', 'nowrap', 'wrap',
    'scroll', 'contain', 'cover', 'repeat', 'no', 'round', 'stretch', 'start', 'end', 'baseline', 'translate',
    'translateX', 'translateY', 'rotate', 'scale', 'cubic', 'bezier', 'steps', 'url', 'format', 'truetype',
    'woff', 'woff2', 'opentype', 'inset', 'currentColor', 'mask', 'black', 'white',
]);

function bersihkan(teks) {
    return teks
        .replace(/&[a-zA-Z]+;|&#\d+;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * @param {string} mentah
 * @param {'longgar'|'ketat'|'templat'} mode  longgar = konteks yang pasti tampil (teks JSX, prop teks, toast);
 *        ketat = konteks campuran kode/teks (return, variabel, setter): hanya kalimat;
 *        templat = template literal dengan substitusi pada konteks ketat.
 */
function teksManusia(mentah, mode) {
    const s = bersihkan(mentah);
    if (!s || !/\p{L}/u.test(s)) {
        return false;
    }
    if (/^(https?:\/\/|mailto:|tel:|www\.)/i.test(s)) {
        return false;
    }
    if (/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(s)) {
        return false;
    }
    if (/^\/\S*$/.test(s) || /^[#?][\w=&%.:/-]*$/.test(s) || /^\.[a-z0-9]+$/i.test(s)) {
        return false;
    }
    if (!/\s/.test(s) && /^[a-z]+\/[\w.+*-]+$/i.test(s)) {
        return false;
    }
    if (miripCss(s) || miripPolaTanggal(s)) {
        return false;
    }
    // Blok CSS (@font-face { … }) dan tumpukan font ("Helvetica, Arial, sans-serif").
    if (/^@[\w-]+\s*\{/.test(s) || /\{[^}]*:[^}]*;/.test(s) || /(^|,\s*)(sans-serif|serif|monospace|system-ui)$/.test(s)) {
        return false;
    }
    // Nilai CSS dari kata kunci saja ("right 12px, left 0", "linear-gradient(to right, …)").
    const kata = s.match(/\p{L}{2,}/gu) ?? [];
    if (kata.length > 0 && kata.every((k) => KATA_CSS.has(k))) {
        return false;
    }
    let sisa = s;
    for (const pola of POLA_DIIZINKAN) {
        sisa = sisa.replace(pola, '$1');
    }
    if (!/\p{L}/u.test(sisa)) {
        return false;
    }
    if (mode === 'longgar') {
        return true;
    }
    sisa = sisa.trim();
    if (/\p{Script=Han}/u.test(sisa)) {
        return true;
    }
    if (mode === 'templat') {
        // Template tanpa spasi (`${id}-list`, `svc-${n}`) adalah id/kunci, bukan kalimat.
        return /\s/.test(sisa) && /\p{L}{3,}/u.test(sisa);
    }
    return (
        /\p{L}{2,}[^\S\n]+\S*\p{L}{2,}/u.test(sisa) ||
        /^\p{Lu}\p{Ll}{2,}/u.test(sisa) ||
        /\p{L}{2,}(?:[.?!:…]|\.\.\.)$/u.test(sisa)
    );
}

/* ── Nama yang dikenali ──────────────────────────────────────────────────────────────────────── */

/** Prop JSX yang nilainya teks tampilan. */
const PROP_TEKS = new Set([
    'label', 'placeholder', 'title', 'description', 'hint', 'emptyText', 'emptyMessage', 'searchPlaceholder',
    'caption', 'aria-label', 'aria-description', 'aria-valuetext', 'aria-roledescription', 'alt', 'tooltip',
    'confirmLabel', 'cancelLabel', 'placeholderTo', 'subtitle', 'heading', 'helperText', 'message', 'text',
    'tag', 'section', 'centerLabel', 'centerSub', 'suffix', 'prefix', 'summary', 'note', 'okLabel',
    'actionLabel', 'loadingText',
]);

/** Kunci objek yang nilainya teks tampilan (peta label, opsi Combobox/Tabs/SegmentedControl, dst.). */
const KUNCI_LABEL = new Set([
    'label', 'labels', 'title', 'description', 'hint', 'placeholder', 'searchPlaceholder', 'emptyText',
    'emptyMessage', 'caption', 'tooltip', 'text', 'message', 'section', 'tag', 'confirmLabel', 'cancelLabel',
    'subtitle', 'heading', 'helper', 'helperText', 'summary', 'note', 'placeholderTo', 'centerLabel',
    'centerSub', 'aria-label', 'ariaLabel', 'alt',
]);

/** Segmen nama variabel penanda peta label (STATUS_LABEL, typeLabels, WEEKDAYS, …). */
const SEGMEN_PETA = new Set([
    'label', 'labels', 'text', 'texts', 'title', 'titles', 'caption', 'captions', 'message', 'messages',
    'hint', 'hints', 'judul', 'teks', 'pesan', 'keterangan', 'description', 'descriptions', 'copy', 'month',
    'months', 'bulan', 'weekday', 'weekdays', 'hari',
]);

function segmenNama(nama) {
    return nama
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .split(/[_\W]+/)
        .filter(Boolean)
        .map((s) => s.toLowerCase());
}
const namaPetaLabel = (nama) => segmenNama(nama).some((s) => SEGMEN_PETA.has(s));

const PEMANGGIL_TOAST = new Set([
    'toast', 'toast.success', 'toast.error', 'toast.warning', 'toast.info', 'toast.message', 'toast.loading',
    'toastError',
]);
const PEMANGGIL_DIALOG = new Set(['confirm', 'alert', 'prompt', 'window.confirm', 'window.alert', 'window.prompt']);
const TAG_KODE = new Set(['code', 'kbd', 'pre', 'samp']);

/* ── Temuan ──────────────────────────────────────────────────────────────────────────────────── */

/** @type {{berkas: string, baris: number, kolom: number, jenis: string, pesan: string}[]} */
const galat = [];
/** @type {{berkas: string, baris: number, kolom: number, jenis: string, pesan: string}[]} */
const peringatan = [];
/** kunci → { jamak: boolean, lokasi: string } */
const kunciDipakai = new Map();

function potong(s, n = 90) {
    const satuBaris = bersihkan(s);
    return satuBaris.length > n ? satuBaris.slice(0, n - 1) + '…' : satuBaris;
}

function placeholder(s) {
    return [...String(s).matchAll(/\{\{\s*([\w.-]+)(?:\s*,[^}]*)?\s*\}\}/g)].map((m) => m[1]).sort();
}

function tag(s) {
    return [...String(s).matchAll(/<\s*(\/?)\s*([A-Za-z0-9]+)\s*(\/?)\s*>/g)]
        .map((m) => (m[1] ? '/' : '') + m[2] + (m[3] ? '/' : ''))
        .sort();
}

const samaArray = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/* ── Pemindaian satu berkas ──────────────────────────────────────────────────────────────────── */

function pindai(abs) {
    const teks = fs.readFileSync(abs, 'utf8');
    const berkas = rel(abs);
    const sf = ts.createSourceFile(abs, teks, ts.ScriptTarget.Latest, true, abs.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const baris = teks.split(/\r?\n/);

    /** baris (1-based) → alasan; null = tanpa alasan. */
    const abaikan = new Map();
    baris.forEach((isi, i) => {
        const m = isi.match(/i18n-abaikan\b\s*:?\s*(.*)$/);
        if (!m) {
            return;
        }
        const alasan = m[1].replace(/\*\/.*$/, '').replace(/[}\s]+$/, '').trim();
        abaikan.set(i + 1, alasan || null);
        if (!alasan) {
            galat.push({ berkas, baris: i + 1, kolom: 1, jenis: 'abaikan-tanpa-alasan', pesan: 'komentar i18n-abaikan wajib diberi alasan' });
        }
    });
    const diabaikan = (b) => abaikan.get(b) || abaikan.get(b - 1);

    /** Berkas ini memakai t() dari @/i18n (impor bernama `t`). */
    const memakaiT = sf.statements.some(
        (st) =>
            ts.isImportDeclaration(st) &&
            ts.isStringLiteral(st.moduleSpecifier) &&
            st.moduleSpecifier.text === '@/i18n' &&
            st.importClause?.namedBindings &&
            ts.isNamedImports(st.importClause.namedBindings) &&
            st.importClause.namedBindings.elements.some((el) => el.name.text === 't'),
    );

    const sudah = new Set();
    function lapor(node, jenis, pesan, daftar = galat) {
        const kunci = `${node.pos}:${node.end}:${jenis}`;
        if (sudah.has(kunci)) {
            return;
        }
        sudah.add(kunci);
        const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
        if (diabaikan(line + 1)) {
            return;
        }
        daftar.push({ berkas, baris: line + 1, kolom: character + 1, jenis, pesan });
    }

    const sudahTeks = new Set();
    function laporTeks(item, mode, konteks) {
        const { node, isi, templat } = item;
        const m = templat && mode === 'ketat' ? 'templat' : mode;
        if (!teksManusia(isi, m)) {
            return;
        }
        if (sudahTeks.has(node.pos)) {
            return;
        }
        sudahTeks.add(node.pos);
        lapor(node, 'teks-keras', `"${potong(isi)}" (${konteks})`);
    }

    /** Literal teks yang benar-benar bisa menjadi nilai ekspresi (tidak menembus pemanggilan fungsi). */
    function literalTeks(expr) {
        if (!expr) {
            return [];
        }
        if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
            return [{ node: expr, isi: expr.text, templat: false }];
        }
        if (ts.isTemplateExpression(expr)) {
            const kerangka = expr.head.text + expr.templateSpans.map((s) => '0' + s.literal.text).join('');
            return [{ node: expr, isi: kerangka, templat: true }];
        }
        if (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr) || ts.isNonNullExpression(expr) || ts.isSatisfiesExpression?.(expr)) {
            return literalTeks(expr.expression);
        }
        if (ts.isConditionalExpression(expr)) {
            return [...literalTeks(expr.whenTrue), ...literalTeks(expr.whenFalse)];
        }
        if (ts.isBinaryExpression(expr)) {
            const op = expr.operatorToken.kind;
            if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) {
                return [...literalTeks(expr.left), ...literalTeks(expr.right)];
            }
            if (op === ts.SyntaxKind.AmpersandAmpersandToken) {
                return literalTeks(expr.right);
            }
            if (op === ts.SyntaxKind.PlusToken) {
                const bagian = [...literalTeks(expr.left), ...literalTeks(expr.right)];
                if (bagian.length === 0) {
                    return [];
                }
                return [{ node: expr, isi: bagian.map((b) => b.isi).join('0'), templat: true }];
            }
        }
        return [];
    }

    /** Semua nilai string di dalam peta label (objek/array bersarang). */
    function nilaiPeta(expr) {
        if (!expr) {
            return [];
        }
        if (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr) || ts.isSatisfiesExpression?.(expr)) {
            return nilaiPeta(expr.expression);
        }
        if (ts.isObjectLiteralExpression(expr)) {
            return expr.properties.flatMap((p) => (ts.isPropertyAssignment(p) ? nilaiPeta(p.initializer) : []));
        }
        if (ts.isArrayLiteralExpression(expr)) {
            return expr.elements.flatMap((e) => nilaiPeta(e));
        }
        return literalTeks(expr);
    }

    function namaPemanggil(call) {
        const e = call.expression;
        if (ts.isIdentifier(e)) {
            return e.text;
        }
        if (ts.isPropertyAccessExpression(e)) {
            const kiri = ts.isIdentifier(e.expression) ? e.expression.text : ts.isPropertyAccessExpression(e.expression) ? e.expression.name.text : '?';
            return `${kiri}.${e.name.text}`;
        }
        return '';
    }

    const namaProp = (name) =>
        ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name) ? name.text : ts.isPrivateIdentifier?.(name) ? name.text : null;

    function catatKunci(nodeKunci, kunci, jamak) {
        const { line } = sf.getLineAndCharacterOfPosition(nodeKunci.getStart(sf));
        const lama = kunciDipakai.get(kunci);
        const lokasi = `${berkas}:${line + 1}`;
        if (!lama) {
            kunciDipakai.set(kunci, { jamak, lokasi, node: nodeKunci, berkas, baris: line + 1, diabaikan: Boolean(diabaikan(line + 1)) });
        } else if (jamak && !lama.jamak) {
            lama.jamak = true;
        }
    }

    const literalString = (n) => (n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null);

    function periksaPanggilanI18n(call, nama, kedalaman) {
        const [arg0, arg1] = call.arguments;
        if (nama === 'tk') {
            if (!arg0 || !(ts.isStringLiteral(arg0) || ts.isNoSubstitutionTemplateLiteral(arg0))) {
                lapor(call, 'tk-bukan-literal', 'tk() wajib berisi literal string (teks Indonesia persis)');
                return;
            }
            // tk(teks, 'konteks') → kunci kamus "teks_konteks" (dirender lewat t(teks, { context })).
            const konteks = literalString(arg1);
            catatKunci(arg0, konteks ? `${arg0.text}_${konteks}` : arg0.text, false);
            return;
        }
        if (kedalaman === 0) {
            lapor(call, 't-tingkat-modul', 't() dipanggil saat modul dimuat: tandai dengan tk() lalu terjemahkan saat render');
        }
        if (!arg0) {
            return;
        }
        if (ts.isStringLiteral(arg0) || ts.isNoSubstitutionTemplateLiteral(arg0)) {
            const opsi = arg1 && ts.isObjectLiteralExpression(arg1) ? arg1 : null;
            const jamak = Boolean(opsi && opsi.properties.some((p) => p.name && namaProp(p.name) === 'count'));
            const propKonteks = opsi?.properties.find((p) => ts.isPropertyAssignment(p) && namaProp(p.name) === 'context');
            const konteks = propKonteks ? literalString(propKonteks.initializer) : null;
            catatKunci(arg0, konteks ? `${arg0.text}_${konteks}` : arg0.text, jamak);
        } else if (ts.isTemplateExpression(arg0) || (ts.isBinaryExpression(arg0) && arg0.operatorToken.kind === ts.SyntaxKind.PlusToken)) {
            lapor(arg0, 'kunci-dinamis', 'kunci t() dirangkai: pakai satu kalimat utuh dengan placeholder {{name}}');
        }
    }

    function kunjungi(node, kedalaman) {
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) {
            return;
        }

        /* Variabel/parameter lokal bernama `t` menutupi t() dari @/i18n di cakupannya. */
        if (memakaiT && (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)) && ts.isIdentifier(node.name) && node.name.text === 't') {
            lapor(node, 'nama-t-bentrok', 'variabel lokal bernama `t` menutupi t() dari @/i18n: ganti namanya (timer, tone, tab, …)');
        }
        if (ts.isTypeNode(node) && !ts.isExpressionWithTypeArguments(node)) {
            return;
        }

        /* (a) teks JSX */
        if (ts.isJsxText(node)) {
            if (!node.containsOnlyTriviaWhiteSpaces) {
                const induk = node.parent;
                const namaTag = ts.isJsxElement(induk) ? induk.openingElement.tagName.getText(sf) : '';
                if (!TAG_KODE.has(namaTag)) {
                    laporTeks({ node, isi: node.text, templat: false }, 'longgar', 'teks JSX');
                }
            }
            return;
        }

        /* (b) prop teks + <Trans i18nKey> */
        if (ts.isJsxAttribute(node)) {
            const nama = node.name.getText(sf);
            const elemen = node.parent?.parent;
            const namaTag = elemen && (ts.isJsxOpeningElement(elemen) || ts.isJsxSelfClosingElement(elemen)) ? elemen.tagName.getText(sf) : '';
            if (namaTag === 'Trans' && nama === 'i18nKey') {
                const init = node.initializer;
                const lit = init && ts.isStringLiteral(init) ? init : init && ts.isJsxExpression(init) && init.expression && (ts.isStringLiteral(init.expression) || ts.isNoSubstitutionTemplateLiteral(init.expression)) ? init.expression : null;
                if (lit) {
                    const jamak = elemen.attributes.properties.some((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === 'count');
                    catatKunci(lit, lit.text, jamak);
                }
                return;
            }
            if (PROP_TEKS.has(nama) && node.initializer) {
                if (ts.isStringLiteral(node.initializer)) {
                    laporTeks({ node: node.initializer, isi: node.initializer.text, templat: false }, 'longgar', `prop ${nama}`);
                } else if (ts.isJsxExpression(node.initializer)) {
                    for (const item of literalTeks(node.initializer.expression)) {
                        laporTeks(item, 'longgar', `prop ${nama}`);
                    }
                }
            }
        }

        /* (c) ekspresi anak JSX: {'Teks'}, {x ? 'A' : 'B'} */
        if (ts.isJsxExpression(node) && node.expression && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
            for (const item of literalTeks(node.expression)) {
                laporTeks(item, 'longgar', 'teks JSX');
            }
        }

        /* (d) pemanggilan */
        if (ts.isCallExpression(node)) {
            const nama = namaPemanggil(node);
            if (nama.startsWith('console.')) {
                return;
            }
            if (nama === 't' || nama === 'i18n.t' || nama === 'tk') {
                periksaPanggilanI18n(node, nama, kedalaman);
            } else if (PEMANGGIL_TOAST.has(nama)) {
                const [pesan, opsi] = node.arguments;
                for (const item of literalTeks(pesan)) {
                    laporTeks(item, 'longgar', nama);
                }
                if (opsi && ts.isObjectLiteralExpression(opsi)) {
                    for (const p of opsi.properties) {
                        if (ts.isPropertyAssignment(p) && namaProp(p.name) === 'description') {
                            for (const item of literalTeks(p.initializer)) {
                                laporTeks(item, 'longgar', `${nama} description`);
                            }
                        }
                    }
                }
            } else if (nama === 'toast.promise') {
                const opsi = node.arguments[1];
                if (opsi && ts.isObjectLiteralExpression(opsi)) {
                    for (const p of opsi.properties) {
                        if (ts.isPropertyAssignment(p) && ['loading', 'success', 'error', 'description'].includes(namaProp(p.name))) {
                            for (const item of literalTeks(p.initializer)) {
                                laporTeks(item, 'longgar', 'toast.promise');
                            }
                        }
                    }
                }
            } else if (PEMANGGIL_DIALOG.has(nama)) {
                for (const item of literalTeks(node.arguments[0])) {
                    laporTeks(item, 'longgar', nama);
                }
            } else if (/^set[A-Z]/.test(nama)) {
                for (const arg of node.arguments) {
                    for (const item of literalTeks(arg)) {
                        laporTeks(item, 'ketat', nama);
                    }
                }
            }
        }

        /* (e) properti peta label */
        if (ts.isPropertyAssignment(node)) {
            const nama = namaProp(node.name);
            if (nama && KUNCI_LABEL.has(nama)) {
                const nilai = ts.isArrayLiteralExpression(node.initializer) ? nilaiPeta(node.initializer) : literalTeks(node.initializer);
                for (const item of nilai) {
                    laporTeks(item, 'longgar', `nilai ${nama}`);
                }
            }
        }

        /* (f) variabel peta label, (h) variabel berisi kalimat */
        if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.name)) {
            if (namaPetaLabel(node.name.text) && (ts.isObjectLiteralExpression(stripBungkus(node.initializer)) || ts.isArrayLiteralExpression(stripBungkus(node.initializer)))) {
                for (const item of nilaiPeta(node.initializer)) {
                    laporTeks(item, 'longgar', `peta ${node.name.text}`);
                }
            } else {
                for (const item of literalTeks(node.initializer)) {
                    laporTeks(item, 'ketat', `variabel ${node.name.text}`);
                }
            }
        }

        /* (k) penugasan berisi kalimat: errors.nama = 'Nama wajib diisi'; pesan = 'Gagal …' */
        if (
            ts.isBinaryExpression(node) &&
            node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            !(ts.isPropertyAccessExpression(node.left) && node.left.name.text === 'displayName')
        ) {
            for (const item of literalTeks(node.right)) {
                laporTeks(item, 'ketat', 'penugasan');
            }
        }

        /* (g) kalimat yang dikembalikan fungsi */
        if (ts.isReturnStatement(node) && node.expression) {
            for (const item of literalTeks(node.expression)) {
                laporTeks(item, 'ketat', 'nilai kembali');
            }
        }
        if (ts.isArrowFunction(node) && !ts.isBlock(node.body)) {
            for (const item of literalTeks(node.body)) {
                laporTeks(item, 'ketat', 'nilai kembali');
            }
        }

        /* (j) nilai bawaan prop teks: ({ placeholder = 'Pilih...' }) */
        if ((ts.isBindingElement(node) || ts.isParameter(node)) && node.initializer && ts.isIdentifier(node.name)) {
            const nama = node.name.text;
            if (PROP_TEKS.has(nama) || KUNCI_LABEL.has(nama)) {
                for (const item of literalTeks(node.initializer)) {
                    laporTeks(item, 'longgar', `nilai bawaan ${nama}`);
                }
            }
        }

        const kedalamanAnak = ts.isFunctionLike(node) || ts.isClassStaticBlockDeclaration?.(node) ? kedalaman + 1 : kedalaman;
        ts.forEachChild(node, (anak) => kunjungi(anak, kedalamanAnak));
    }

    function stripBungkus(expr) {
        let e = expr;
        while (e && (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression?.(e))) {
            e = e.expression;
        }
        return e;
    }

    kunjungi(sf, 0);
}

for (const abs of berkasDipindai) {
    pindai(abs);
}

/* ── Pemeriksaan kamus ───────────────────────────────────────────────────────────────────────── */

/** bahasa → kunci persis (bersufiks jamak) yang belum ada → teks Indonesia (bahan terjemahan). */
const hilang = { en: {}, zh: {} };

for (const [kunci, info] of kunciDipakai) {
    if (info.diabaikan) {
        continue;
    }
    const phKunci = placeholder(kunci);
    const tagKunci = tag(kunci);
    for (const bahasa of ['en', 'zh']) {
        const sufiks = info.jamak ? (bahasa === 'en' ? ['_one', '_other'] : ['_other']) : [''];
        for (const suf of sufiks) {
            const nama = kunci + suf;
            const nilai = kamus[bahasa][nama];
            const tempat = { berkas: info.berkas, baris: info.baris, kolom: 1 };
            if (nilai === undefined) {
                hilang[bahasa][nama] = kunci;
                galat.push({ ...tempat, jenis: 'kunci-hilang', pesan: `${bahasa}.json belum punya "${potong(nama, 120)}"` });
                continue;
            }
            if (typeof nilai !== 'string' || nilai.trim() === '') {
                galat.push({ ...tempat, jenis: 'nilai-kosong', pesan: `${bahasa}.json: "${potong(nama, 120)}" kosong` });
                continue;
            }
            const harap = suf === '_one' ? phKunci.filter((p) => p !== 'count') : phKunci;
            const ada = placeholder(nilai).filter((p) => !(suf === '_one' && p === 'count'));
            if (!samaArray(harap, [...new Set(ada)].sort()) && !samaArray(phKunci, [...new Set(placeholder(nilai))].sort())) {
                galat.push({ ...tempat, jenis: 'placeholder', pesan: `${bahasa}.json "${potong(nama, 70)}": {{${phKunci.join('}}, {{')}}} ≠ {{${placeholder(nilai).join('}}, {{')}}}` });
            }
            if (!samaArray(tagKunci, tag(nilai))) {
                galat.push({ ...tempat, jenis: 'tag', pesan: `${bahasa}.json "${potong(nama, 70)}": tag ${tagKunci.join(' ') || '(tidak ada)'} ≠ ${tag(nilai).join(' ') || '(tidak ada)'}` });
            }
        }
    }
}

if (pindaiPenuh) {
    const terpakai = new Set(kunciDipakai.keys());
    for (const bahasa of ['en', 'zh']) {
        for (const nama of Object.keys(kamus[bahasa])) {
            const dasar = nama.replace(/_(zero|one|two|few|many|other)$/, '');
            if (!terpakai.has(nama) && !terpakai.has(dasar)) {
                peringatan.push({ berkas: `locales/${bahasa}.json`, baris: 0, kolom: 0, jenis: 'kunci-tak-terpakai', pesan: `"${potong(nama, 120)}"` });
            }
        }
    }
}

if (berkasKunciHilang) {
    fs.writeFileSync(berkasKunciHilang, JSON.stringify(hilang, null, 4) + '\n', 'utf8');
    console.log(`Kunci yang belum ada ditulis ke ${berkasKunciHilang} (en ${Object.keys(hilang.en).length}, zh ${Object.keys(hilang.zh).length}).`);
}

/* ── Laporan ─────────────────────────────────────────────────────────────────────────────────── */

function kelompok(berkas) {
    const seg = berkas.split('/');
    if (seg[0] === 'pages' || seg[0] === 'components') {
        return seg.length > 2 ? `${seg[0]}/${seg[1]}` : `${seg[0]}/${seg[1].replace(/\.tsx?$/, '')}`;
    }
    if (seg[0] === 'locales') {
        return 'locales';
    }
    return seg.length > 1 ? seg[0] : seg[0].replace(/\.tsx?$/, '');
}

const urut = (a, b) => a.berkas.localeCompare(b.berkas) || a.baris - b.baris || a.kolom - b.kolom;
galat.sort(urut);
peringatan.sort(urut);

if (!hanyaRingkasan) {
    let terakhir = '';
    for (const g of galat) {
        if (g.berkas !== terakhir) {
            console.log(`\nresources/js/${g.berkas}`);
            terakhir = g.berkas;
        }
        console.log(`  ${String(g.baris).padStart(4)}:${String(g.kolom).padEnd(3)} ${g.jenis.padEnd(16)} ${g.pesan}`);
    }
    if (peringatan.length > 0) {
        console.log(`\nPeringatan (${peringatan.length}):`);
        for (const p of peringatan.slice(0, 200)) {
            console.log(`  ${p.berkas}  ${p.jenis}  ${p.pesan}`);
        }
        if (peringatan.length > 200) {
            console.log(`  … ${peringatan.length - 200} lagi`);
        }
    }
}

const perKelompok = new Map();
const perJenis = new Map();
for (const g of galat) {
    const k = kelompok(g.berkas);
    perKelompok.set(k, (perKelompok.get(k) ?? 0) + 1);
    perJenis.set(g.jenis, (perJenis.get(g.jenis) ?? 0) + 1);
}

console.log(`\nDipindai: ${berkasDipindai.length} berkas${pindaiPenuh ? '' : ` (cakupan: ${cakupan.join(', ')})`} · kunci dipakai: ${kunciDipakai.size}`);
if (perKelompok.size > 0) {
    console.log('Temuan per folder:');
    for (const [k, n] of [...perKelompok].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
        console.log(`  ${k.padEnd(36)} ${n}`);
    }
}
const ringkasJenis = [...perJenis].map(([j, n]) => `${j} ${n}`).join(', ');
if (galat.length > 0) {
    console.log(`\n✖ ${galat.length} galat (${ringkasJenis})${peringatan.length ? ` · ⚠ ${peringatan.length} peringatan` : ''}`);
    process.exit(1);
}
console.log(`\n✔ 0 galat${peringatan.length ? ` · ⚠ ${peringatan.length} peringatan` : ''}`);
