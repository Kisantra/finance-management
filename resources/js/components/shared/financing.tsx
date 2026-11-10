import { Link } from '@inertiajs/react';
import { ArrowRight, Info, Landmark, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ComboboxOption } from '@/components/ui/combobox';
import { useCan } from '@/hooks/use-can';
import { t, tk, Trans } from '@/i18n';
import { companyUrl } from '@/lib/company';
import { cn, formatCurrency } from '@/lib/utils';

/*
 * Pendanaan (kategori bertipe `financing`): setoran modal, prive, setor PPN, setor titipan pajak klien,
 * serta pokok utang/piutang. Uangnya menggeser saldo rekening tetapi TIDAK masuk Laba Rugi, jadi di
 * mana pun ia tampil selalu diberi penanda yang sama. Nada netral (outline + ikon Landmark): pendanaan
 * adalah jenis, bukan arah atau status. Lihat docs/module/cash-flow.md › Pendanaan.
 */

/** Judul bagian grup Pendanaan di pemilih kategori (selalu grup terakhir). Kunci terjemahan: t(FINANCING_SECTION). */
export const FINANCING_SECTION = tk('Pendanaan · tidak masuk Laba Rugi');

/** Opsi kategori dari server (`TransactionCategory::selectOptions()` / `financingOptions()`). */
export interface CategoryPickerOption {
    value: number;
    label: string;
    disabled?: boolean;
    /** Kategori bertipe `financing` (judul grup maupun sub). */
    financing?: boolean;
}

/**
 * Opsi kategori → opsi Combobox: opsi pendanaan pertama membuka bagian "Pendanaan · tidak masuk
 * Laba Rugi", dan sub pendanaan yang terpilih menampilkan penanda "Pendanaan" di pemicu.
 */
export function withFinancingGroup(options: CategoryPickerOption[]): ComboboxOption[] {
    let sectionOpened = false;

    return options.map((option) => {
        const base: ComboboxOption = { value: option.value, label: option.label, disabled: option.disabled };

        if (!option.financing) return base;

        const decorated: ComboboxOption = option.disabled
            ? base
            : { ...base, tag: t('Pendanaan'), tagIcon: <Landmark aria-hidden="true" /> };

        if (sectionOpened) return decorated;

        sectionOpened = true;
        return { ...decorated, section: t(FINANCING_SECTION), sectionIcon: <Landmark aria-hidden="true" /> };
    });
}

/** Apakah kategori terpilih termasuk grup Pendanaan. */
export function isFinancingCategory(options: CategoryPickerOption[], value: number | null | undefined): boolean {
    if (value == null) return false;
    return options.some((option) => option.value === value && option.financing === true && !option.disabled);
}

/** Opsi induk untuk "+ Tambah" kategori cepat: tanpa grup Pendanaan (kategori cepat bertipe pemasukan/pengeluaran). */
export function quickAddParents(options: CategoryPickerOption[]): Array<{ value: number; label: string }> {
    return options.filter((option) => option.disabled && !option.financing && option.value > 0).map((option) => ({ value: option.value, label: option.label }));
}

/** Penanda "Pendanaan" di baris daftar. */
export function FinancingBadge({ className }: { className?: string }) {
    return (
        <Badge variant="outline" className={cn('shrink-0 gap-1 whitespace-nowrap', className)}>
            <Landmark className="h-3 w-3" aria-hidden="true" />
            {t('Pendanaan')}
        </Badge>
    );
}

interface FinancingHintProps {
    /** credit = saldo bertambah, debit = saldo berkurang. */
    direction: 'credit' | 'debit';
    /** Nama rekening; kosong = "rekening". */
    accountName?: string | null;
    /** Nominal isian Jumlah; 0 = tanpa nominal. */
    amount?: number;
    className?: string;
}

/*
 * Satu kalimat utuh per arah × ada/tidaknya nominal (D1): penerjemah bebas menukar urutan kata, nilai
 * disisipkan lewat placeholder, bagian tebal lewat <b> — kalimat tidak pernah dirangkai dari potongan.
 */
const FINANCING_HINT = {
    credit: {
        amount: tk('<b>Pendanaan:</b> saldo {{account}} bertambah {{amount}}, Laba Rugi tidak berubah.'),
        plain: tk('<b>Pendanaan:</b> saldo {{account}} bertambah, Laba Rugi tidak berubah.'),
    },
    debit: {
        amount: tk('<b>Pendanaan:</b> saldo {{account}} berkurang {{amount}}, Laba Rugi tidak berubah.'),
        plain: tk('<b>Pendanaan:</b> saldo {{account}} berkurang, Laba Rugi tidak berubah.'),
    },
} as const;

/** Petunjuk di bawah pemilih kategori setelah kategori pendanaan dipilih. */
export function FinancingHint({ direction, accountName, amount = 0, className }: FinancingHintProps) {
    const kalimat = FINANCING_HINT[direction][amount > 0 ? 'amount' : 'plain'];

    return (
        <div role="note" className={cn('mt-2 flex gap-2 rounded-xl bg-ob-inner px-3 py-2.5 text-xs leading-relaxed text-ob-ink-2', className)}>
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ob-ink-3" aria-hidden="true" />
            <p>
                <Trans
                    i18nKey={kalimat}
                    values={{ account: accountName || t('rekening'), amount: formatCurrency(amount) }}
                    components={{ b: <span className="font-semibold text-ob-ink" /> }}
                />
            </p>
        </div>
    );
}

/** Modul yang mencatat pokok utang/piutang (dikirim server sebagai `managed_by`). */
export interface ManagedBy {
    module: 'loans' | 'receivables';
    label: 'Utang' | 'Piutang' | string;
    /** Kata cari yang membuka datanya di halaman modul; null = halaman indeks modul. */
    search: string | null;
}

/** Nama modul pengelola (kode → label). Dipakai alih-alih `label` dari server agar ikut bahasa tampilan. */
const MANAGED_BY_MODULE: Record<ManagedBy['module'], string> = {
    loans: tk('Utang', 'menu'),
    receivables: tk('Piutang', 'menu'),
};

/** Label modul pengelola baris hanya-lihat dalam bahasa aktif ("Utang" / "Payables" / "应付借款"). */
export function managedByLabel(managedBy: ManagedBy): string {
    const kunci = MANAGED_BY_MODULE[managedBy.module];
    return kunci ? t(kunci, { context: 'menu' }) : managedBy.label;
}

/** Catatan baris hanya-lihat: gembok + "Hanya-lihat · kelola di Utang/Piutang". */
export function ManagedByNote({ managedBy, className }: { managedBy: ManagedBy; className?: string }) {
    const { can } = useCan();
    const modul = managedByLabel(managedBy);
    const href = companyUrl(`/${managedBy.module}`) + (managedBy.search ? `?search=${encodeURIComponent(managedBy.search)}` : '');

    return (
        <span className={cn('flex flex-wrap items-center gap-x-1 text-xs text-ob-ink-3', className)}>
            <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>{t('Hanya-lihat')} ·</span>
            {can(`view ${managedBy.module}`) ? (
                <Link
                    href={href}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-0.5 rounded-md font-medium text-ob-act hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill"
                >
                    {t('kelola di {{module}}', { module: modul })}
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
            ) : (
                <span>{t('kelola di {{module}}', { module: modul })}</span>
            )}
        </span>
    );
}
