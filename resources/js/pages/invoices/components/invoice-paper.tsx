import * as React from 'react';
import { cn } from '@/lib/utils';

/*
 * Kertas pratinjau = PDF asli. Server merender lewat InvoicePrintService::renderPdf, jalur yang
 * sama dengan tombol Unduh, jadi yang tampil di sini adalah berkas yang akan diekspor (bukan
 * tiruan HTML). Ditampilkan dengan penampil PDF bawaan browser tanpa toolbar.
 *
 * Dua lapis iframe: PDF baru dimuat di belakang lalu menggantikan yang lama setelah siap,
 * supaya kertas tidak berkedip putih setiap isian berubah.
 */

export type PaperZoom = 'fit' | 'actual';

/** Rasio A4 (842 / 595 pt) + sedikit ruang tepi penampil PDF. */
const A4_RATIO = 842 / 595;

interface InvoicePaperProps {
    /** URL PDF (rute pratinjau atau blob: URL). */
    src: string | null;
    zoom?: PaperZoom;
    /** Redupkan kertas saat PDF baru sedang dirender. */
    stale?: boolean;
    title?: string;
    className?: string;
}

interface Layer {
    src: string;
    ready: boolean;
}

export function InvoicePaper({ src, zoom = 'fit', stale, title = 'Pratinjau invoice', className }: InvoicePaperProps) {
    const boxRef = React.useRef<HTMLDivElement>(null);
    const [width, setWidth] = React.useState(620);
    const [layers, setLayers] = React.useState<Layer[]>([]);

    React.useEffect(() => {
        const el = boxRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    React.useEffect(() => {
        if (!src) return;
        setLayers((ls) => [...ls.filter((l) => l.ready && l.src !== src).slice(-1), { src, ready: false }]);
    }, [src]);

    const onLoad = (loaded: string) => {
        // Beri penampil PDF sejenak untuk menggambar halaman sebelum lapisan lama dibuang.
        window.setTimeout(() => {
            setLayers((ls) => {
                const idx = ls.findIndex((l) => l.src === loaded);
                return idx < 0 ? ls : ls.slice(idx).map((l, i) => (i === 0 ? { ...l, ready: true } : l));
            });
        }, 150);
    };

    const height = zoom === 'fit' ? Math.round(width * A4_RATIO) + 8 : Math.round(window.innerHeight * 0.7);
    const hash = `#toolbar=0&navpanes=0&${zoom === 'fit' ? 'view=FitH' : 'zoom=100'}`;

    return (
        <div ref={boxRef} className={cn('relative w-full min-w-0', className)} style={{ height }}>
            {layers.length === 0 && <div className="absolute inset-0 animate-pulse rounded-md bg-white/80" />}
            {layers.map((layer, i) => (
                <iframe
                    key={`${layer.src}${hash}`}
                    title={title}
                    src={layer.src + hash}
                    onLoad={() => onLoad(layer.src)}
                    tabIndex={i === layers.length - 1 ? 0 : -1}
                    aria-hidden={!layer.ready && i !== 0}
                    className={cn(
                        'absolute inset-0 h-full w-full rounded-md border-0 bg-white transition-opacity duration-200',
                        layer.ready ? 'opacity-100' : i === 0 ? 'opacity-100' : 'pointer-events-none opacity-0',
                        stale && layer.ready && 'opacity-60',
                    )}
                />
            ))}
        </div>
    );
}
