import { ClipboardPaste, Paperclip, Upload, X } from 'lucide-react';
import * as React from 'react';
import { t, Trans } from '@/i18n';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';
import { FilePreviewDialog } from './file-preview-dialog';

interface FileUploadProps {
    value?: File | null;
    onChange?: (file: File | null) => void;
    label?: string;
    hint?: string;
    error?: string;
    accept?: string[];
    maxSizeMb?: number;
    existingFileName?: string | null;
    existingFileUrl?: string | null;
    onRemoveExisting?: () => void;
    disabled?: boolean;
    className?: string;
}

const EXT_TO_MIME: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.pdf': 'application/pdf',
};

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp']);

export function FileUpload({
    value,
    onChange,
    label,
    hint,
    error,
    accept = ['.jpg', '.jpeg', '.png', '.pdf'],
    maxSizeMb = 5,
    existingFileName,
    existingFileUrl,
    onRemoveExisting,
    disabled,
    className,
}: FileUploadProps) {
    const [sizeError, setSizeError] = React.useState<string | null>(null);
    const [pasteHint, setPasteHint] = React.useState(false);
    const [previewOpen, setPreviewOpen] = React.useState(false);
    const [previewData, setPreviewData] = React.useState<{ url: string; name: string; isObjectUrl: boolean } | null>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const openPreview = React.useCallback((url: string, name: string, isObjectUrl = false) => {
        setPreviewData({ url, name, isObjectUrl });
        setPreviewOpen(true);
    }, []);

    const closePreview = React.useCallback(() => {
        setPreviewOpen(false);
        setPreviewData((prev) => {
            if (prev?.isObjectUrl) URL.revokeObjectURL(prev.url);
            return null;
        });
    }, []);

    const acceptedMimes = React.useMemo(
        () => new Set(accept.map((e) => EXT_TO_MIME[e]).filter(Boolean) as string[]),
        [accept],
    );

    const maxBytes = maxSizeMb * 1024 * 1024;

    const processFile = React.useCallback((file: File) => {
        setSizeError(null);
        if (file.size > maxBytes) {
            setSizeError(t('Ukuran file melebihi batas {{size}}MB.', { size: maxSizeMb }));
            return;
        }
        if (acceptedMimes.size > 0 && !acceptedMimes.has(file.type)) {
            setSizeError(t('Format file tidak didukung.'));
            return;
        }
        onChange?.(file);
    }, [maxBytes, maxSizeMb, acceptedMimes, onChange]);

    /* ── Clipboard paste (Ctrl+V / Cmd+V) ── */
    const supportsImagePaste = accept.some((e) => ['.jpg', '.jpeg', '.png'].includes(e));

    React.useEffect(() => {
        if (disabled || value || (existingFileName && !value)) return;

        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            for (const item of Array.from(items)) {
                if (IMAGE_MIMES.has(item.type) && acceptedMimes.has(item.type)) {
                    const file = item.getAsFile();
                    if (file) {
                        e.preventDefault();
                        const named = new File(
                            [file],
                            `clipboard-${Date.now()}.${item.type.split('/')[1] ?? 'png'}`,
                            { type: item.type },
                        );
                        processFile(named);
                        return;
                    }
                }
            }
        };

        document.addEventListener('paste', handlePaste);
        return () => document.removeEventListener('paste', handlePaste);
    }, [disabled, value, existingFileName, acceptedMimes, processFile]);

    /* ── react-dropzone ── */
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        disabled,
        maxSize: maxBytes,
        accept: accept.reduce<Record<string, string[]>>((acc, ext) => {
            const mime = EXT_TO_MIME[ext];
            if (mime) {
                acc[mime] = [...(acc[mime] ?? []), ext];
            }
            return acc;
        }, {}),
        onDropAccepted: (files) => {
            setSizeError(null);
            onChange?.(files[0] ?? null);
        },
        onDropRejected: (rejections) => {
            const tooLarge = rejections.some((r) =>
                r.errors.some((e) => e.code === 'file-too-large'),
            );
            setSizeError(tooLarge ? t('Ukuran file melebihi batas {{size}}MB.', { size: maxSizeMb }) : t('Format file tidak didukung.'));
        },
        multiple: false,
        noClick: false,
    });

    const displayError = error ?? sizeError ?? undefined;
    const acceptedFormats = accept.map((e) => e.replace('.', '').toUpperCase()).join(', ');

    const showExisting = !value && !!existingFileName;

    const fileRow = 'flex items-center gap-2.5 rounded-xl border border-ob-line bg-ob-inner px-3 py-2.5';
    const fileLink =
        'flex-1 truncate rounded-lg text-left text-sm text-ob-act underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill';
    const removeBtn =
        'shrink-0 rounded-full p-0.5 text-ob-ink-3 transition-colors duration-150 ease-out hover:bg-ob-late/10 hover:text-ob-late focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill motion-reduce:transition-none';

    return (
        <div ref={containerRef} className={cn('w-full', className)}>
            {label && <label className="mb-1.5 block text-[13px] font-medium text-ob-ink-2">{label}</label>}

            {showExisting ? (
                /* Existing file chip */
                <div className={fileRow}>
                    <Paperclip className="h-4 w-4 shrink-0 text-ob-ink-3" />
                    {existingFileUrl ? (
                        <button type="button" onClick={() => openPreview(existingFileUrl, existingFileName!)} className={fileLink}>
                            {existingFileName}
                        </button>
                    ) : (
                        <span className="flex-1 truncate text-sm text-ob-ink">{existingFileName}</span>
                    )}
                    {onRemoveExisting && (
                        <button type="button" onClick={onRemoveExisting} className={removeBtn} aria-label={t('Hapus lampiran')}>
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            ) : value ? (
                /* Newly-selected file chip */
                <div className={fileRow}>
                    <Paperclip className="h-4 w-4 shrink-0 text-ob-ink-3" />
                    <button type="button" onClick={() => openPreview(URL.createObjectURL(value), value.name, true)} className={fileLink}>
                        {value.name}
                    </button>
                    <button
                        type="button"
                        onClick={() => { setSizeError(null); onChange?.(null); }}
                        className={removeBtn}
                        aria-label={t('Hapus pilihan')}
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            ) : (
                /* Dropzone */
                <div
                    {...getRootProps()}
                    onMouseEnter={() => supportsImagePaste && setPasteHint(true)}
                    onMouseLeave={() => setPasteHint(false)}
                    className={cn(
                        'relative flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-5',
                        'transition-colors duration-150 ease-out motion-reduce:transition-none',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill focus-visible:ring-offset-2 focus-visible:ring-offset-ob-page',
                        isDragActive
                            ? 'border-ob-act-fill bg-ob-act-fill/10'
                            : displayError
                                ? 'border-ob-late bg-ob-inner hover:bg-ob-hover'
                                : 'border-ob-line-strong bg-ob-inner hover:bg-ob-hover',
                        disabled && 'pointer-events-none opacity-50',
                    )}
                >
                    <input {...getInputProps()} />

                    <Upload className={cn(
                        'h-5 w-5 transition-colors duration-150 ease-out motion-reduce:transition-none',
                        isDragActive ? 'text-ob-act' : 'text-ob-ink-3',
                    )} />

                    <div className="text-center">
                        <p className="text-sm text-ob-ink-2">
                            {isDragActive ? (
                                t('Lepaskan file di sini...')
                            ) : (
                                <Trans
                                    i18nKey="<b>Klik untuk memilih</b> atau seret & lepas"
                                    components={{ b: <span className="font-medium text-ob-act" /> }}
                                />
                            )}
                        </p>
                        <p className="mt-0.5 text-xs text-ob-ink-3">
                            {t('{{formats}} · maks {{size}}MB', { formats: acceptedFormats, size: maxSizeMb })}
                        </p>
                    </div>

                    {/* Paste hint — appears on hover when images are accepted */}
                    {supportsImagePaste && pasteHint && !isDragActive && (
                        <div className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1 rounded-full border border-ob-line bg-ob-card px-2.5 py-1 text-xs text-ob-ink-2">
                            <ClipboardPaste className="h-3 w-3" />
                            {t('Ctrl+V untuk menempel gambar')}
                        </div>
                    )}
                </div>
            )}

            {displayError && <p className="mt-1 text-xs text-ob-late">{displayError}</p>}
            {hint && !displayError && <p className="mt-1 text-xs text-ob-ink-3">{hint}</p>}

            {/* File preview dialog */}
            {previewData && (
                <FilePreviewDialog
                    open={previewOpen}
                    onOpenChange={(o) => { if (!o) closePreview(); }}
                    fileName={previewData.name}
                    fileUrl={previewData.url}
                />
            )}
        </div>
    );
}
