/** Baris Laba Rugi (P&L) yang dituju sebuah kategori. Hanya berlaku untuk tipe income/expense. */
export const PL_GROUP_CONFIG: Record<string, { label: string; type: 'income' | 'expense' }> = {
    revenue: { label: 'Pendapatan Usaha', type: 'income' },
    other_income: { label: 'Pendapatan Lain', type: 'income' },
    cogs: { label: 'Harga Pokok (HPP)', type: 'expense' },
    opex: { label: 'Beban Operasional', type: 'expense' },
    other_expense: { label: 'Beban Lain', type: 'expense' },
    tax: { label: 'Pajak Perusahaan', type: 'expense' },
};

export function plGroupLabel(group: string | null): string {
    return group ? (PL_GROUP_CONFIG[group]?.label ?? group) : 'Belum diklasifikasi';
}
