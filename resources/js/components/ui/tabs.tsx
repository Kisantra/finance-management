import * as React from 'react';
import { cn } from '@/lib/utils';

interface TabItem {
    value: string;
    label: string;
    icon?: React.ReactNode;
    badge?: number | string;
}

interface TabsProps {
    items: TabItem[];
    value: string;
    onChange: (value: string) => void;
    className?: string;
    storageKey?: string;
    variant?: 'pill' | 'underline';
    /** Pill variant only: stretch the bar to full width with equal-width tabs. */
    fullWidth?: boolean;
}

interface Indicator {
    /** Distance from the container's left padding edge to the active button. */
    left: number;
    /** Distance from the active button to the container's right padding edge. */
    right: number;
    /** Travel direction since the last change: 1 = right, -1 = left, 0 = none. */
    dir: number;
    ready: boolean;
}

const STRETCH_DURATION = 320;
const STRETCH_DELAY = 130;
const STRETCH_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

/**
 * Builds the "stretch & settle" (liquid) transition: the leading edge moves
 * immediately while the trailing edge follows after a delay, so the indicator
 * elongates toward the destination and then contracts onto it.
 */
function stretchTransition(dir: number): string {
    const lead = `${STRETCH_DURATION}ms ${STRETCH_EASE}`;
    const trail = `${STRETCH_DURATION}ms ${STRETCH_EASE} ${STRETCH_DELAY}ms`;
    if (dir > 0) {
        // Moving right: the right edge leads, the left edge trails.
        return `right ${lead}, left ${trail}`;
    }
    if (dir < 0) {
        // Moving left: the left edge leads, the right edge trails.
        return `left ${lead}, right ${trail}`;
    }
    return `left ${lead}, right ${lead}`;
}

/**
 * Measures the active tab button as {left,right} offsets within the container
 * and tracks travel direction. The container uses `ring` (not `border`) so the
 * button's offsetLeft shares the indicator's origin — keeping it pixel-perfect.
 */
function useTabIndicator(activeIndex: number, deps: React.DependencyList) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const btnRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
    const prevIndex = React.useRef(activeIndex);
    const [indicator, setIndicator] = React.useState<Indicator>({ left: 0, right: 0, dir: 0, ready: false });

    React.useLayoutEffect(() => {
        const measure = (withDirection: boolean) => {
            const container = containerRef.current;
            const btn = btnRefs.current[activeIndex];
            if (!container || !btn) return;
            const dir = withDirection
                ? Math.sign(activeIndex - prevIndex.current)
                : 0;
            setIndicator({
                left: btn.offsetLeft,
                right: container.clientWidth - btn.offsetLeft - btn.offsetWidth,
                dir,
                ready: true,
            });
        };

        measure(true);
        prevIndex.current = activeIndex;

        // Re-measure on resize without re-triggering the stretch (dir = 0 → plain settle).
        const container = containerRef.current;
        if (!container || typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver(() => measure(false));
        ro.observe(container);
        return () => ro.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeIndex, ...deps]);

    return { containerRef, btnRefs, indicator };
}

function Badge({ active, children, variant }: { active: boolean; children: React.ReactNode; variant: 'pill' | 'underline' }) {
    return (
        <span
            className={cn(
                'ml-0.5 inline-flex min-w-4.5 items-center justify-center rounded-full px-1.5 text-xs font-semibold leading-tight transition-colors duration-200 ease-out',
                !active && 'bg-ob-chip text-ob-ink-2',
                // Pil aktif duduk di atas thumb terbalik; garis bawah aktif tetap di atas latar biasa.
                active && (variant === 'pill' ? 'bg-ob-invert-ink/15 text-ob-invert-ink' : 'bg-ob-chip text-ob-ink'),
                variant === 'pill' && 'py-px',
            )}
        >
            {children}
        </span>
    );
}

function Tabs({ items, value, onChange, className, variant = 'pill', fullWidth = false }: TabsProps) {
    const activeIndex = Math.max(0, items.findIndex((i) => i.value === value));
    // Re-measure whenever any item's label/badge changes (not just the count),
    // since a badge appearing/disappearing changes button widths without
    // changing the container size — so a ResizeObserver alone would miss it.
    const itemsKey = items.map((i) => `${i.value} ${i.label} ${i.badge ?? ''}`).join('');
    const { containerRef, btnRefs, indicator } = useTabIndicator(activeIndex, [value, itemsKey]);

    /* ── Underline variant ── */
    if (variant === 'underline') {
        return (
            <div
                ref={containerRef}
                className={cn('relative flex items-center border-b border-ob-line', className)}
            >
                {/* sliding underline (liquid stretch) */}
                <span
                    aria-hidden
                    className={cn(
                        '-bottom-px absolute h-0.5 rounded-full bg-ob-ink motion-reduce:transition-none!',
                        indicator.ready ? 'opacity-100' : 'opacity-0',
                    )}
                    style={{
                        left: indicator.left,
                        right: indicator.right,
                        transition: indicator.ready ? stretchTransition(indicator.dir) : 'none',
                    }}
                />
                {items.map((item, i) => {
                    const active = value === item.value;
                    return (
                        <button
                            key={item.value}
                            ref={(el) => { btnRefs.current[i] = el; }}
                            type="button"
                            onClick={() => onChange(item.value)}
                            className={cn(
                                'relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill',
                                active ? 'text-ob-ink' : 'text-ob-ink-2 hover:text-ob-ink',
                            )}
                        >
                            {item.icon && <span className="h-4 w-4 shrink-0">{item.icon}</span>}
                            <span>{item.label}</span>
                            {item.badge !== undefined && <Badge active={active} variant="underline">{item.badge}</Badge>}
                        </button>
                    );
                })}
            </div>
        );
    }

    /* ── Pill variant (segmented) ── */
    return (
        <div
            ref={containerRef}
            className={cn(
                // ring-inset (bukan border) menjaga offsetLeft tombol & indikator sejajar; tampilannya
                // sama dengan trek pil Obsidian `border border-ob-line bg-ob-rail p-[3px]`.
                'relative items-center gap-1 rounded-full bg-ob-rail p-1 ring-1 ring-inset ring-ob-line',
                fullWidth ? 'flex w-full' : 'inline-flex',
                className,
            )}
        >
            {/* sliding thumb (liquid stretch) */}
            <span
                aria-hidden
                className={cn(
                    'absolute top-1 bottom-1 rounded-full bg-ob-invert motion-reduce:transition-none!',
                    indicator.ready ? 'opacity-100' : 'opacity-0',
                )}
                style={{
                    left: indicator.left,
                    right: indicator.right,
                    transition: indicator.ready ? stretchTransition(indicator.dir) : 'none',
                }}
            />
            {items.map((item, i) => {
                const active = value === item.value;
                return (
                    <button
                        key={item.value}
                        ref={(el) => { btnRefs.current[i] = el; }}
                        type="button"
                        onClick={() => onChange(item.value)}
                        className={cn(
                            'relative z-10 flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-medium transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill',
                            fullWidth && 'flex-1 justify-center',
                            active ? 'text-ob-invert-ink' : 'text-ob-ink-2 hover:text-ob-ink',
                        )}
                    >
                        {item.icon && <span className="h-4 w-4 shrink-0">{item.icon}</span>}
                        <span>{item.label}</span>
                        {item.badge !== undefined && <Badge active={active} variant="pill">{item.badge}</Badge>}
                    </button>
                );
            })}
        </div>
    );
}

interface TabsPanelProps {
    value: string;
    activeValue: string;
    children: React.ReactNode;
    className?: string;
}

function TabsPanel({ value, activeValue, children, className }: TabsPanelProps) {
    if (value !== activeValue) return null;
    return (
        <div className={cn('ob-fade-in', className)}>
            {children}
        </div>
    );
}

export { Tabs, TabsPanel };
export type { TabItem };
