/** Baris Laba Rugi (P&L) yang dituju sebuah kategori. Hanya berlaku untuk tipe income/expense. */
import { t, tk } from '@/i18n';
export const PL_GROUP_CONFIG: Record<string, { label: string; type: 'income' | 'expense' }> = {
    revenue: { label: tk('Pendapatan Usaha'), type: 'income' },
    other_income: { label: tk('Pendapatan Lain'), type: 'income' },
    cogs: { label: tk('Harga Pokok Penjualan (HPP)'), type: 'expense' },
    opex: { label: tk('Beban Operasional'), type: 'expense' },
    other_expense: { label: tk('Beban Lain'), type: 'expense' },
    tax: { label: tk('Pajak Perusahaan'), type: 'expense' },
};

export function plGroupLabel(group: string | null): string {
    return group ? (PL_GROUP_CONFIG[group] ? t(PL_GROUP_CONFIG[group].label) : group) : t('Belum diklasifikasi');
}
