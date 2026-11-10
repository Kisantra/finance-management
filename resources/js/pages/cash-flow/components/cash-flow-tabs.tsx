import { router } from '@inertiajs/react';
import * as React from 'react';
import { Tabs } from '@/components/ui/tabs';
import { useCan } from '@/hooks/use-can';
import * as cashFlowRoutes from '@/routes/cash-flow';
import { t, tk } from '@/i18n';

export type CashFlowTab = 'all' | 'income' | 'expenses';

/**
 * Tab menu Arus Kas › Pemasukan & Pengeluaran. Tab tampil sesuai izin (sama dengan middleware
 * route): Semua butuh `view income` DAN `view expense`. Transfer sengaja bukan tab di sini — ia
 * menu tersendiri.
 */
export function CashFlowTabs({ active }: { active: CashFlowTab }) {
    const { can } = useCan();
    const [value, setValue] = React.useState<CashFlowTab>(active);

    const tabs: { value: CashFlowTab; label: string; url: () => string; allowed: boolean }[] = [
        { value: 'all', label: tk('Semua'), url: () => cashFlowRoutes.all.url(), allowed: can('view income') && can('view expense') },
        { value: 'income', label: tk('Pemasukan'), url: () => cashFlowRoutes.income.url(), allowed: can('view income') },
        { value: 'expenses', label: tk('Pengeluaran'), url: () => cashFlowRoutes.expenses.url(), allowed: can('view expense') },
    ];
    const visible = tabs.filter((tab) => tab.allowed);

    if (visible.length === 0) return null;

    return (
        <div className="ob-no-scrollbar max-w-full overflow-x-auto">
            <Tabs
                items={visible.map((tab) => ({ value: tab.value, label: t(tab.label) }))}
                value={value}
                onChange={(next) => {
                    const tab = visible.find((item) => item.value === next);
                    if (!tab || next === value) return;
                    // Thumb pindah seketika; halaman tujuan dimuat dengan filter bawaannya sendiri.
                    setValue(tab.value);
                    router.get(tab.url());
                }}
            />
        </div>
    );
}
