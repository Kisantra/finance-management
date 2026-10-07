import * as React from 'react';
import { cn } from '@/lib/utils';

/*
 * Kartu widget Obsidian: padding 22, radius 24, header 32 px agar baseline judul sejajar
 * antar kartu di baris yang sama. Tinggi tetap hanya berlaku di layar lebar (xl); di bawah
 * itu kartu mengikuti isinya.
 */

interface WidgetProps {
    title: React.ReactNode;
    /** Hitungan di samping judul, mis. "3 dari 5". */
    count?: React.ReactNode;
    action?: React.ReactNode;
    /** Tinggi tetap di xl (px). */
    height?: number;
    className?: string;
    bodyClassName?: string;
    children: React.ReactNode;
    'aria-label'?: string;
}

export function Widget({ title, count, action, height, className, bodyClassName, children }: WidgetProps) {
    const id = React.useId();
    return (
        <section
            aria-labelledby={id}
            style={height ? ({ ['--widget-h' as string]: `${height}px` } as React.CSSProperties) : undefined}
            className={cn(
                'flex min-h-0 flex-col gap-3 rounded-3xl border border-ob-line bg-ob-card p-[22px]',
                height && 'xl:h-[var(--widget-h)]',
                className,
            )}
        >
            <div className="flex h-8 shrink-0 items-center justify-between gap-3">
                <h2 id={id} className="flex min-w-0 items-baseline gap-2 truncate text-base font-semibold text-ob-ink">
                    <span className="truncate">{title}</span>
                    {count && <span className="shrink-0 text-[13px] font-medium text-ob-ink-2">{count}</span>}
                </h2>
                {action && <div className="shrink-0">{action}</div>}
            </div>
            <div className={cn('flex min-h-0 flex-1 flex-col', bodyClassName)}>{children}</div>
        </section>
    );
}

/** Tautan kecil di header kartu: "Lihat semua →". */
export function WidgetLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
    return (
        <a
            href={href}
            className={cn('inline-flex items-center gap-1 text-xs font-semibold text-ob-ink-2 hover:text-ob-ink', className)}
        >
            {children}
        </a>
    );
}

/** Daftar yang menggulir di dalam kartu; fade 12 px hanya saat masih ada sisa di bawah. */
export function ScrollList({
    children,
    className,
    label,
    height,
}: {
    children: React.ReactNode;
    className?: string;
    label: string;
    /** Tinggi viewport di xl (px); di bawah xl daftar mengikuti isi. */
    height: number;
}) {
    const ref = React.useRef<HTMLUListElement>(null);
    const [more, setMore] = React.useState(false);

    React.useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const check = () => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
        check();
        el.addEventListener('scroll', check, { passive: true });
        const ro = new ResizeObserver(check);
        ro.observe(el);
        return () => {
            el.removeEventListener('scroll', check);
            ro.disconnect();
        };
    }, [children]);

    return (
        <ul
            ref={ref}
            tabIndex={0}
            aria-label={label}
            style={{ ['--list-h' as string]: `${height}px` } as React.CSSProperties}
            className={cn(
                'ob-scroll m-0 flex list-none flex-col p-0 outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill rounded-lg',
                'xl:h-[var(--list-h)]',
                more && 'has-more',
                className,
            )}
        >
            {children}
        </ul>
    );
}

/** State kosong di dalam kartu: setinggi slot, satu kalimat yang mengajarkan, satu aksi. */
export function WidgetEmpty({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-ob-line-strong p-4 text-center">
            <span className="text-[13px] font-semibold text-ob-ink">{title}</span>
            {description && <span className="max-w-[260px] text-xs leading-relaxed text-ob-ink-2">{description}</span>}
            {action}
        </div>
    );
}

/** State gagal per widget, bukan per halaman. */
export function WidgetError({ title, description, onRetry }: { title: string; description?: string; onRetry: () => void }) {
    return (
        <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-ob-late/35 bg-ob-inner p-4 text-center">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ob-late/15 text-[13px] font-bold text-ob-late">!</span>
            <span className="text-[13px] font-semibold text-ob-ink">{title}</span>
            {description && <span className="max-w-[260px] text-xs leading-relaxed text-ob-ink-2">{description}</span>}
            <button
                type="button"
                onClick={onRetry}
                className="mt-1 h-8 rounded-xl border border-ob-line bg-ob-card px-3.5 text-xs font-semibold text-ob-ink hover:bg-ob-hover"
            >
                Coba lagi
            </button>
        </div>
    );
}

/** Pil status Obsidian: latar tembus, teks warna penuh, titik atau ikon di kiri. */
export function StatusPill({
    tone,
    children,
    icon,
    className,
}: {
    tone: 'act' | 'wait' | 'pos' | 'neg' | 'late' | 'neutral';
    children: React.ReactNode;
    icon?: React.ReactNode;
    className?: string;
}) {
    const tones: Record<typeof tone, string> = {
        act: 'bg-ob-act/12 text-ob-act',
        wait: 'bg-ob-wait/12 text-ob-wait',
        pos: 'bg-ob-pos/12 text-ob-pos',
        neg: 'bg-ob-neg/12 text-ob-neg',
        late: 'bg-ob-late/12 text-ob-late',
        neutral: 'bg-ob-chip text-ob-ink-2',
    };
    return (
        <span className={cn('inline-flex h-[22px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-xs font-semibold', tones[tone], className)}>
            {icon ?? <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />}
            {children}
        </span>
    );
}
