import * as React from 'react';
import {
    type ColumnDef,
    type SortingState,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Pagination } from './pagination';

export type { ColumnDef };

interface PaginationMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

interface DataTableProps<TData> {
    columns: ColumnDef<TData, unknown>[];
    data: TData[];
    loading?: boolean;
    pagination?: PaginationMeta;
    sorting?: SortingState;
    onSortingChange?: (sorting: SortingState) => void;
    onPageChange?: (page: number) => void;
    emptyMessage?: string;
    className?: string;
}

export function DataTable<TData>({
    columns,
    data,
    loading = false,
    pagination,
    sorting = [],
    onSortingChange,
    onPageChange,
    emptyMessage = 'Tidak ada data.',
    className,
}: DataTableProps<TData>) {
    const table = useReactTable({
        data,
        columns,
        state: { sorting },
        onSortingChange: onSortingChange
            ? (updaterOrValue) => {
                  const next =
                      typeof updaterOrValue === 'function'
                          ? updaterOrValue(sorting)
                          : updaterOrValue;
                  onSortingChange(next);
              }
            : undefined,
        manualSorting: true,
        manualPagination: true,
        getCoreRowModel: getCoreRowModel(),
    });

    return (
        <div className={cn('space-y-4', className)}>
            {/* relative: teks sr-only (absolut) di dalam tabel tetap terpotong wadah ini, tidak melebarkan halaman. */}
            <div className="relative overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr
                                key={headerGroup.id}
                                className="border-b border-ob-line text-left text-xs font-medium text-ob-ink-3"
                            >
                                {headerGroup.headers.map((header) => {
                                    const canSort = header.column.getCanSort();
                                    const sorted = header.column.getIsSorted();

                                    return (
                                        <th
                                            key={header.id}
                                            aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : canSort ? 'none' : undefined}
                                            className={cn(
                                                'whitespace-nowrap px-3 py-2.5 font-medium select-none',
                                                canSort && 'cursor-pointer transition-colors duration-150 ease-out hover:text-ob-ink',
                                                sorted && 'font-semibold text-ob-ink',
                                            )}
                                            onClick={
                                                canSort
                                                    ? header.column.getToggleSortingHandler()
                                                    : undefined
                                            }
                                        >
                                            {header.isPlaceholder ? null : (
                                                <div className="flex items-center gap-1">
                                                    {flexRender(
                                                        header.column.columnDef.header,
                                                        header.getContext(),
                                                    )}
                                                    {canSort && (
                                                        <span className="shrink-0">
                                                            {sorted === 'asc' ? (
                                                                <ArrowUp className="h-3 w-3" />
                                                            ) : sorted === 'desc' ? (
                                                                <ArrowDown className="h-3 w-3" />
                                                            ) : (
                                                                <ArrowUpDown className="h-3 w-3 opacity-40" />
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </th>
                                    );
                                })}
                            </tr>
                        ))}
                    </thead>
                    <tbody aria-busy={loading}>
                        {loading ? (
                            /* Memuat = kerangka berbentuk baris, bukan spinner. */
                            Array.from({ length: 5 }, (_, i) => (
                                <tr key={`skeleton-${i}`} className="border-b border-ob-line-soft">
                                    <td colSpan={columns.length} className="px-3 py-2.5">
                                        {i === 0 && <span className="sr-only">Memuat...</span>}
                                        <Skeleton className="h-9 rounded-xl bg-ob-inner" />
                                    </td>
                                </tr>
                            ))
                        ) : table.getRowModel().rows.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={columns.length}
                                    className="px-3 py-16 text-center text-[13px] text-ob-ink-2"
                                >
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            table.getRowModel().rows.map((row) => (
                                <tr
                                    key={row.id}
                                    className="border-b border-ob-line-soft transition-colors duration-150 ease-out hover:bg-ob-hover"
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <td
                                            key={cell.id}
                                            className="px-3 py-2.5 text-ob-ink"
                                        >
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext(),
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {pagination && onPageChange && (
                <Pagination meta={pagination} onPageChange={onPageChange} />
            )}
        </div>
    );
}
