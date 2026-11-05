import * as React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

interface PaginationProps {
    meta: PaginationMeta;
    onPageChange: (page: number) => void;
    className?: string;
}

function getPageNumbers(current: number, last: number): (number | '...')[] {
    if (last <= 7) {
        return Array.from({ length: last }, (_, i) => i + 1);
    }

    const pages: (number | '...')[] = [];

    if (current <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', last);
    } else if (current >= last - 3) {
        pages.push(1, '...', last - 4, last - 3, last - 2, last - 1, last);
    } else {
        pages.push(1, '...', current - 1, current, current + 1, '...', last);
    }

    return pages;
}

export function Pagination({ meta, onPageChange, className }: PaginationProps) {
    const { current_page, last_page, total, from, to } = meta;

    if (last_page <= 1) {
        return null;
    }

    const pages = getPageNumbers(current_page, last_page);

    const btnBase =
        'flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill focus-visible:ring-offset-2 focus-visible:ring-offset-ob-page disabled:pointer-events-none disabled:opacity-50';
    const btnDefault = 'text-ob-ink-2 hover:bg-ob-hover hover:text-ob-ink';
    const btnActive = 'bg-ob-invert font-semibold text-ob-invert-ink';

    return (
        <div
            className={cn(
                'flex flex-col sm:flex-row items-center justify-between gap-3',
                className,
            )}
        >
            <p className="text-[13px] text-ob-ink-3 order-2 sm:order-1">
                {from != null && to != null ? (
                    <>
                        Menampilkan <span className="font-medium text-ob-ink-2">{from}</span>–
                        <span className="font-medium text-ob-ink-2">{to}</span> dari{' '}
                        <span className="font-medium text-ob-ink-2">{total}</span> data
                    </>
                ) : (
                    <>Total <span className="font-medium text-ob-ink-2">{total}</span> data</>
                )}
            </p>

            <div className="flex items-center gap-1 order-1 sm:order-2">
                <button type="button"
                    onClick={() => onPageChange(1)}
                    disabled={current_page === 1}
                    className={cn(btnBase, btnDefault)}
                    aria-label="Halaman pertama"
                >
                    <ChevronsLeft className="h-4 w-4" />
                </button>
                <button type="button"
                    onClick={() => onPageChange(current_page - 1)}
                    disabled={current_page === 1}
                    className={cn(btnBase, btnDefault)}
                    aria-label="Halaman sebelumnya"
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>

                {pages.map((page, idx) =>
                    page === '...' ? (
                        <span
                            key={`ellipsis-${idx}`}
                            className="flex h-8 w-8 items-center justify-center text-sm text-ob-ink-3"
                        >
                            …
                        </span>
                    ) : (
                        <button type="button"
                            key={page}
                            aria-current={page === current_page ? 'page' : undefined}
                            onClick={() => onPageChange(page as number)}
                            className={cn(
                                btnBase,
                                page === current_page ? btnActive : btnDefault,
                            )}
                        >
                            {page}
                        </button>
                    ),
                )}

                <button type="button"
                    onClick={() => onPageChange(current_page + 1)}
                    disabled={current_page === last_page}
                    className={cn(btnBase, btnDefault)}
                    aria-label="Halaman berikutnya"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
                <button type="button"
                    onClick={() => onPageChange(last_page)}
                    disabled={current_page === last_page}
                    className={cn(btnBase, btnDefault)}
                    aria-label="Halaman terakhir"
                >
                    <ChevronsRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
