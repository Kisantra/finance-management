import { ArrowUpDown } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

/*
 * Bahan tabel bersama tab Semua / Pemasukan / Pengeluaran (gaya Obsidian), supaya ketiga tab
 * tampil sama.
 */

/** Kartu pembungkus daftar: filter, tabel, dan kaki halaman. */
export const LIST_CARD = 'flex flex-col gap-4 rounded-3xl border border-ob-line bg-ob-card p-[22px]';

/** Baris kepala tabel. */
export const HEAD_ROW = 'border-b border-ob-line text-left text-xs font-medium text-ob-ink-3';

/** Sel kepala biasa. */
export const TH = 'px-3 py-2.5 font-medium';

/** Pembungkus gulir tabel; `relative` wajib agar teks sr-only di <th> tidak melebarkan halaman. */
export const TABLE_SCROLL = 'relative -mx-2 overflow-x-auto px-2';

interface SortableThProps {
    label: string;
    column: string;
    current: string;
    direction: 'asc' | 'desc';
    onSort: (column: string) => void;
    align?: 'left' | 'right';
    className?: string;
}

/** Kepala kolom yang bisa diurutkan. */
export function SortableTh({ label, column, current, direction, onSort, align = 'left', className }: SortableThProps) {
    const active = current === column;
    return (
        <th
            scope="col"
            aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : undefined}
            className={cn(TH, align === 'right' ? 'text-right' : 'text-left', className)}
        >
            <button
                type="button"
                onClick={() => onSort(column)}
                className={cn(
                    'inline-flex items-center gap-1 rounded-md transition-colors duration-150 hover:text-ob-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill',
                    active && 'text-ob-ink',
                )}
            >
                {label}
                <ArrowUpDown className={cn('h-3 w-3', active ? 'opacity-100' : 'opacity-40')} aria-hidden="true" />
            </button>
        </th>
    );
}

/** Isi kolom "Diinput oleh": nama pencatat, atau "Tidak tercatat" untuk data sebelum pencatat direkam. */
export function InputByText({ name }: { name: string | null }) {
    if (!name) {
        return <span className="text-xs text-ob-ink-3">Tidak tercatat</span>;
    }
    return <span className="block max-w-40 truncate text-ob-ink-2">{name}</span>;
}

/**
 * Bungkus tombol lampiran di dalam baris yang bisa diklik: klik (termasuk dari dialog pratinjau,
 * yang event React-nya tetap menggelembung lewat portal) tidak ikut membuka dialog rincian baris.
 */
export function StopRowClick({ children }: { children: React.ReactNode }) {
    return (
        <span className="block" onClick={(e) => e.stopPropagation()}>
            {children}
        </span>
    );
}
