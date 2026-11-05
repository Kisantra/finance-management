import { router } from '@inertiajs/react';
import * as React from 'react';
import { Tabs } from '@/components/ui/tabs';
import { useCan } from '@/hooks/use-can';
import * as cashFlowRoutes from '@/routes/cash-flow';

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
        { value: 'all', label: 'Semua', url: () => cashFlowRoutes.all.url(), allowed: can('view income') && can('view expense') },
        { value: 'income', label: 'Pemasukan', url: () => cashFlowRoutes.income.url(), allowed: can('view income') },
        { value: 'expenses', label: 'Pengeluaran', url: () => cashFlowRoutes.expenses.url(), allowed: can('view expense') },
    ];
    const visible = tabs.filter((t) => t.allowed);

    if (visible.length === 0) return null;

    return (
        <div className="ob-no-scrollbar max-w-full overflow-x-auto">
            <Tabs
                items={visible.map((t) => ({ value: t.value, label: t.label }))}
                value={value}
                onChange={(next) => {
                    const tab = visible.find((t) => t.value === next);
                    if (!tab || next === value) return;
                    // Thumb pindah seketika; halaman tujuan dimuat dengan filter bawaannya sendiri.
                    setValue(tab.value);
                    router.get(tab.url());
                }}
            />
        </div>
    );
}
