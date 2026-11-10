import { Calendar, FileText, TrendingUp } from 'lucide-react';
import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn, formatCurrency } from '@/lib/utils';
import type { CashFlowStats } from '../types';
import { t } from '@/i18n';

interface Props {
    stats: CashFlowStats;
    period: string;
    primaryLabel: string;
    /** Tone for the main amount card. */
    primaryTone: 'green' | 'red' | 'purple';
}

const TONE = {
    green: { accent: 'bg-green-500', icon: 'text-green-500', value: 'text-green-600 dark:text-green-400' },
    red: { accent: 'bg-red-500', icon: 'text-red-500', value: 'text-red-600 dark:text-red-400' },
    purple: { accent: 'bg-purple-500', icon: 'text-purple-500', value: 'text-purple-600 dark:text-purple-400' },
};

export function CashFlowStatsBar({ stats, period, primaryLabel, primaryTone }: Props) {
    const tone = TONE[primaryTone];
    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="overflow-hidden hover:shadow-md transition-shadow">
                <div className={cn('h-1', tone.accent)} />
                <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-dark-500 dark:text-dark-400 leading-none">
                            {primaryLabel}
                        </p>
                        <TrendingUp className={cn('w-5 h-5 shrink-0', tone.icon)} />
                    </div>
                    <p className={cn('text-2xl font-bold tabular-nums leading-none', tone.value)}>
                        {formatCurrency(stats.total_amount)}
                    </p>
                    <p className="text-xs text-dark-500 dark:text-dark-400 mt-2">
                        {t('Total transaksi terfilter')}
                    </p>
                </CardContent>
            </Card>

            <Card className="overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-1 bg-blue-500" />
                <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-dark-500 dark:text-dark-400 leading-none">
                            {t('Jumlah Transaksi')}
                        </p>
                        <FileText className="w-5 h-5 text-blue-500 shrink-0" />
                    </div>
                    <p className="text-2xl font-bold text-dark-900 dark:text-dark-50 tabular-nums leading-none">
                        {stats.total_count.toLocaleString('id-ID')}
                    </p>
                    <p className="text-xs text-dark-500 dark:text-dark-400 mt-2">
                        {t('Catatan tersaring')}
                    </p>
                </CardContent>
            </Card>

            <Card className="overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-1 bg-emerald-500" />
                <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-dark-500 dark:text-dark-400 leading-none">
                            {t('Periode')}
                        </p>
                        <Calendar className="w-5 h-5 text-emerald-500 shrink-0" />
                    </div>
                    <p className="text-2xl font-bold text-dark-900 dark:text-dark-50 leading-none truncate">
                        {period}
                    </p>
                    <p className="text-xs text-dark-500 dark:text-dark-400 mt-2">
                        {t('Rentang aktif')}
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
