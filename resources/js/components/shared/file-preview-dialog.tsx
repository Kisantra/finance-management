import { ExternalLink, Paperclip, ZoomIn, ZoomOut } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

export function isImageFilename(name: string): boolean {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
}

export function isPdfFilename(name: string): boolean {
    return (name.split('.').pop()?.toLowerCase() ?? '') === 'pdf';
}

const FOCUS_RING =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill focus-visible:ring-offset-2 focus-visible:ring-offset-ob-page';

const ZOOM_BUTTON = cn(
    'inline-flex h-8 w-8 items-center justify-center rounded-full text-ob-ink-2 transition-colors duration-150 ease-out hover:bg-ob-hover hover:text-ob-ink disabled:pointer-events-none disabled:opacity-50',
    FOCUS_RING,
);

const LINK = cn('rounded-lg text-ob-act underline-offset-4 hover:underline', FOCUS_RING);

/* ── Image viewer with cursor-following zoom ── */
function ImageViewer({ url }: { url: string }) {
    const [zoom, setZoom] = React.useState(1);
    const [origin, setOrigin] = React.useState({ x: 50, y: 50 });
    const containerRef = React.useRef<HTMLDivElement>(null);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (zoom <= 1) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
        setOrigin({ x, y });
    };

    const handleWheel = React.useCallback((e: WheelEvent) => {
        e.preventDefault();
        setZoom((prev) => Math.min(Math.max(prev - e.deltaY * 0.005, 1), 5));
    }, []);

    React.useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, [handleWheel]);

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
        if (zoom > 1) {
            setZoom(1);
            setOrigin({ x: 50, y: 50 });
        } else {
            setOrigin({ x, y });
            setZoom(2.5);
        }
    };

    return (
        <div className="space-y-3">
            <div
                ref={containerRef}
                className={cn(
                    'relative overflow-hidden rounded-2xl border border-ob-line bg-ob-inner',
                    zoom > 1 ? 'cursor-zoom-out' : 'cursor-zoom-in',
                )}
                style={{ maxHeight: '62vh' }}
                onMouseMove={handleMouseMove}
                onClick={handleClick}
            >
                <img
                    src={url}
                    alt="Preview"
                    className="w-full select-none"
                    style={{
                        display: 'block',
                        maxHeight: '62vh',
                        objectFit: 'contain',
                        transform: `scale(${zoom})`,
                        transformOrigin: `${origin.x}% ${origin.y}%`,
                        transition: zoom === 1 ? 'transform 0.2s ease, transform-origin 0.2s ease' : 'transform-origin 0.04s linear',
                    }}
                    draggable={false}
                />
            </div>

            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => { setZoom((p) => Math.max(1, +(p - 0.5).toFixed(1))); if (zoom - 0.5 <= 1) setOrigin({ x: 50, y: 50 }); }}
                        disabled={zoom <= 1}
                        aria-label="Perkecil"
                        className={ZOOM_BUTTON}
                    >
                        <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-xs tabular-nums text-ob-ink-2 w-12 text-center">
                        {Math.round(zoom * 100)}%
                    </span>
                    <button
                        type="button"
                        onClick={() => setZoom((p) => Math.min(5, +(p + 0.5).toFixed(1)))}
                        disabled={zoom >= 5}
                        aria-label="Perbesar"
                        className={ZOOM_BUTTON}
                    >
                        <ZoomIn className="w-4 h-4" />
                    </button>
                </div>
                <p className="text-xs text-ob-ink-3">
                    Scroll untuk zoom · Klik untuk toggle
                </p>
            </div>
        </div>
    );
}

function PdfViewer({ url }: { url: string }) {
    return (
        <div
            className="overflow-hidden rounded-2xl border border-ob-line"
            style={{ height: '70vh' }}
        >
            <iframe src={url} className="w-full h-full" title="PDF Preview" />
        </div>
    );
}

/* ── Shared preview dialog ── */
interface FilePreviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    fileName: string;
    fileUrl: string;
}

export function FilePreviewDialog({ open, onOpenChange, fileName, fileUrl }: FilePreviewDialogProps) {
    const isImage = isImageFilename(fileName);
    const isPdf = isPdfFilename(fileName);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size="4xl">
                {/* Pratinjau sudah berbingkai kartu-dalam sendiri, jadi garis di bawah header dilepas. */}
                <DialogHeader className="border-b-0">
                    <div className="flex items-center justify-between gap-4 py-1">
                        <DialogTitle className="truncate text-sm font-semibold max-w-xs">
                            {fileName}
                        </DialogTitle>
                        <a
                            href={fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={cn('shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold', LINK)}
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Buka tab baru
                        </a>
                    </div>
                </DialogHeader>

                <div className="px-6 pb-6">
                    {isImage && <ImageViewer url={fileUrl} />}
                    {isPdf && <PdfViewer url={fileUrl} />}
                    {!isImage && !isPdf && (
                        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ob-line-strong py-16 text-center">
                            <span aria-hidden="true" className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-ob-chip text-ob-ink-2">
                                <Paperclip className="w-5 h-5" />
                            </span>
                            <p className="text-[13px] text-ob-ink-2">Preview tidak tersedia untuk jenis file ini.</p>
                            <a
                                href={fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className={cn('mt-3 text-sm font-semibold', LINK)}
                            >
                                Buka di tab baru
                            </a>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

/* ── Drop-in replacement for <a href target="_blank"> attachment links ── */
interface AttachmentPreviewButtonProps {
    url: string;
    name?: string | null;
    label?: string;
    className?: string;
    iconSize?: string;
}

export function AttachmentPreviewButton({
    url,
    name,
    label = 'Lampiran',
    className,
    iconSize = 'w-3 h-3',
}: AttachmentPreviewButtonProps) {
    const [open, setOpen] = React.useState(false);
    const fileName = name ?? label;

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className={className ?? cn('mt-1 inline-flex items-center gap-1 text-xs', LINK)}
            >
                <Paperclip className={iconSize} />
                {label}
            </button>
            <FilePreviewDialog
                open={open}
                onOpenChange={setOpen}
                fileName={fileName}
                fileUrl={url}
            />
        </>
    );
}
