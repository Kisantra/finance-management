import * as React from 'react';
import { router } from '@inertiajs/react';
import { toast } from 'sonner';
import { AppLayout } from '@/layouts/app-layout';
import { Button } from '@/components/ui/button';
import { companyUrl } from '@/lib/company';
import { Type, Image as ImageIcon, Trash2, ZoomIn, ZoomOut, Bold as BoldIcon, GripVertical, Copy, Undo2, Redo2, Eye, Pencil, Plus, Save, FileDown, Lock, Unlock, RotateCcw } from 'lucide-react';

// ponytail: sandbox throwaway. Drag native (tanpa lib), koordinat px @96dpi.
// Belum: resize, mm, binding tabel, simpan, PDF. Align teks ditunda sampai teks punya kotak lebar.
const A4 = { w: 794, h: 1123 }; // A4 @96dpi

// Data contoh untuk preview/binding. Saat cetak nanti diganti data invoice asli.
const DATA = {
    invoice: { number: 'INV/001/KSN/06.26', date: '08 Jun 2026', due_date: '22 Jun 2026', total: 'Rp 5.000.000' },
    client: { name: 'PT Maju Jaya', npwp: '01.234.567.8-901.000' },
    company: { name: 'Kisantra' },
};

// Daftar token tersedia (path + contoh nilai) untuk field picker.
function flattenData(obj: Record<string, unknown>, prefix = ''): { path: string; sample: string }[] {
    return Object.entries(obj).flatMap(([k, v]) => {
        const path = prefix ? `${prefix}.${k}` : k;
        return v && typeof v === 'object'
            ? flattenData(v as Record<string, unknown>, path)
            : [{ path, sample: String(v) }];
    });
}
const TOKENS = flattenData(DATA);

// Ganti {{path}} dengan nilai dari DATA; token tak dikenal dibiarkan apa adanya.
const resolve = (text: string) =>
    text.replace(/\{\{([\w.]+)\}\}/g, (_, path: string) => {
        const val = path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], DATA);
        return val == null ? `{{${path}}}` : String(val);
    });

type Text = { id: number; type: 'text'; x: number; y: number; content: string; fontSize: number; bold: boolean; color: string };
type Img = { id: number; type: 'image'; x: number; y: number; src: string; width: number; height?: number; lockAspect?: boolean };
type El = Text | Img;

export default function TemplateBuilderTest({ layout = [] }: { layout?: El[] }) {
    const initial: El[] = layout.length
        ? layout
        : [{ id: 1, type: 'text', x: 60, y: 60, content: 'Invoice {{invoice.number}}', fontSize: 20, bold: true, color: '#0f172a' }];
    const [els, setEls] = React.useState<El[]>(initial);
    const [selectedId, setSelectedId] = React.useState<number | null>(null);
    const [saving, setSaving] = React.useState(false);
    const [editingId, setEditingId] = React.useState<number | null>(null);
    const [preview, setPreview] = React.useState(false);
    const [fieldMenu, setFieldMenu] = React.useState(false);
    const [zoom, setZoom] = React.useState(0.6);
    const [dragOver, setDragOver] = React.useState(false);
    const [overLayerId, setOverLayerId] = React.useState<number | null>(null);
    const paperRef = React.useRef<HTMLDivElement>(null);
    const canvasRef = React.useRef<HTMLDivElement>(null);
    const fileRef = React.useRef<HTMLInputElement>(null);
    const contentRef = React.useRef<HTMLTextAreaElement>(null);
    const pendingImg = React.useRef<{ x: number; y: number } | null>(null);
    const dragLayerId = React.useRef<number | null>(null);
    const zoomAnchor = React.useRef<{ cx: number; cy: number; clientX: number; clientY: number } | null>(null);
    const nextId = React.useRef(Math.max(0, ...initial.map((e) => e.id)) + 1);

    const clipboard = React.useRef<El | null>(null);
    const history = React.useRef<{ past: El[][]; future: El[][] }>({ past: [], future: [] });

    const selected = els.find((e) => e.id === selectedId) ?? null;
    const update = (id: number, patch: Partial<El>) =>
        setEls((p) => p.map((e) => (e.id === id ? ({ ...e, ...patch } as El) : e)));

    // Snapshot via functional setState → selalu menangkap state TERBARU sebelum mutasi
    // (mengembalikan prev tanpa ubah → React bail-out, tanpa render ekstra).
    const snapshot = () =>
        setEls((prev) => {
            const h = history.current;
            h.past.push(prev);
            if (h.past.length > 100) h.past.shift();
            h.future = [];
            return prev;
        });
    const undo = () =>
        setEls((prev) => {
            const h = history.current;
            if (!h.past.length) return prev;
            h.future.push(prev);
            return h.past.pop()!;
        });
    const redo = () =>
        setEls((prev) => {
            const h = history.current;
            if (!h.future.length) return prev;
            h.past.push(prev);
            return h.future.pop()!;
        });

    // Drag: koordinat dibagi zoom karena kertas di-scale (rect mengembalikan ukuran ter-scale).
    const startDrag = (e: React.PointerEvent, el: El) => {
        e.stopPropagation();
        setSelectedId(el.id);
        const rect = paperRef.current!.getBoundingClientRect();
        const dx = (e.clientX - rect.left) / zoom - el.x;
        const dy = (e.clientY - rect.top) / zoom - el.y;
        let moved = false;
        const move = (ev: PointerEvent) => {
            if (!moved) {
                moved = true;
                snapshot(); // satu entri undo per sesi drag
            }
            // Bebas (boleh negatif/melewati tepi). Kanvas hanya area tampil/ekspor;
            // bagian di luar di-clip oleh kertas (lihat overflow-hidden).
            const x = Math.round((ev.clientX - rect.left) / zoom - dx);
            const y = Math.round((ev.clientY - rect.top) / zoom - dy);
            update(el.id, { x, y });
        };
        const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    // Resize gambar via handle sudut (2D). Sudut seberang jadi jangkar yang diam.
    // Lock aktif → digerakkan oleh lebar, tinggi ikut rasio saat ini; lock nonaktif → bebas.
    const startResize = (e: React.PointerEvent, el: Img, corner: 'nw' | 'ne' | 'sw' | 'se') => {
        e.stopPropagation();
        setSelectedId(el.id);
        const rect = paperRef.current!.getBoundingClientRect();
        const w0 = el.width;
        const h0 = el.height ?? w0;
        const ratio = w0 / h0;
        const left0 = el.x;
        const top0 = el.y;
        const right0 = el.x + w0;
        const bottom0 = el.y + h0;
        const west = corner === 'nw' || corner === 'sw';
        const north = corner === 'nw' || corner === 'ne';
        let resized = false;
        const move = (ev: PointerEvent) => {
            if (!resized) {
                resized = true;
                snapshot();
            }
            const px = (ev.clientX - rect.left) / zoom;
            const py = (ev.clientY - rect.top) / zoom;
            let newW = Math.max(20, west ? right0 - px : px - left0);
            let newH = Math.max(20, north ? bottom0 - py : py - top0);
            if (el.lockAspect) {
                newH = newW / ratio; // tinggi mengikuti lebar agar rasio tetap
            }
            const newX = west ? right0 - newW : left0;
            const newY = north ? bottom0 - newH : top0;
            update(el.id, { x: Math.round(newX), y: Math.round(newY), width: Math.round(newW), height: Math.round(newH) });
        };
        const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    const addText = (x = 80, y = 200, content = 'Teks baru') => {
        snapshot();
        const id = nextId.current++;
        setEls((p) => [...p, { id, type: 'text', x, y, content, fontSize: 14, bold: false, color: '#0f172a' }]);
        setSelectedId(id);
    };
    const addImage = (file: File, x = 80, y = 280) => {
        const reader = new FileReader();
        reader.onload = () => {
            const src = reader.result as string;
            const probe = new Image();
            probe.onload = () => {
                snapshot();
                const id = nextId.current++;
                const width = 160;
                const height = Math.round(width * (probe.naturalHeight / probe.naturalWidth)); // jaga rasio asli saat dibuat
                setEls((p) => [...p, { id, type: 'image', x, y, src, width, height, lockAspect: true }]);
                setSelectedId(id);
            };
            probe.src = src;
        };
        reader.readAsDataURL(file); // base64 → ikut tersimpan & ter-render di PDF
    };

    // Ubah lebar/tinggi gambar dari Inspector; saat lock, sisi lain ikut rasio saat ini.
    const setImgSize = (el: Img, dim: 'width' | 'height', v: number) => {
        if (el.lockAspect && el.height) {
            const r = el.width / el.height;
            if (dim === 'width') update(el.id, { width: v, height: Math.max(1, Math.round(v / r)) });
            else update(el.id, { width: Math.max(1, Math.round(v * r)), height: v });
        } else {
            update(el.id, dim === 'width' ? { width: v } : { height: v });
        }
    };

    // Reset ke ukuran asli gambar — dibaca dari natural size runtime, tanpa simpan di DB.
    const resetImage = (el: Img) => {
        const probe = new Image();
        probe.onload = () => {
            snapshot();
            update(el.id, { width: probe.naturalWidth, height: probe.naturalHeight });
        };
        probe.src = el.src;
    };

    const save = () => {
        setSaving(true);
        router.post(
            companyUrl('/template-builder-test'),
            { layout: els },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => toast.success('Template tersimpan'),
                onError: () => toast.error('Gagal menyimpan'),
                onFinish: () => setSaving(false),
            },
        );
    };
    const openPdf = () => window.open(companyUrl('/template-builder-test/pdf'), '_blank');

    // Posisi drop pada kertas (dibagi zoom karena kertas di-scale), di-clamp ke dalam A4.
    const dropPos = (e: React.DragEvent) => {
        const rect = paperRef.current!.getBoundingClientRect();
        return {
            x: Math.max(0, Math.min(A4.w, (e.clientX - rect.left) / zoom)),
            y: Math.max(0, Math.min(A4.h, (e.clientY - rect.top) / zoom)),
        };
    };
    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const { x, y } = dropPos(e);
        const file = e.dataTransfer.files?.[0];
        if (file?.type.startsWith('image/')) {
            addImage(file, x, y); // gambar diseret langsung dari OS
            return;
        }
        const kind = e.dataTransfer.getData('kind');
        if (kind === 'text') addText(x, y);
        else if (kind === 'image') {
            pendingImg.current = { x, y }; // tool gambar dari toolbar → buka picker, ingat posisi
            fileRef.current?.click();
        }
    };
    const remove = (id: number) => {
        snapshot();
        setEls((p) => p.filter((e) => e.id !== id));
        setSelectedId(null);
    };

    // Reorder z-order via panel Layers. List ditampilkan terbalik (atas=depan),
    // jadi olah di ruang tampilan lalu balik lagi ke urutan array (akhir=depan).
    const moveLayer = (draggedId: number, targetId: number) => {
        if (draggedId === targetId) return;
        snapshot();
        setEls((prev) => {
            const display = [...prev].reverse();
            const from = display.findIndex((e) => e.id === draggedId);
            const to = display.findIndex((e) => e.id === targetId);
            if (from < 0 || to < 0) return prev;
            const [moved] = display.splice(from, 1);
            display.splice(to, 0, moved);
            return display.reverse();
        });
    };

    // Sisip token {{path}} ke teks terpilih, di posisi kursor textarea bila fokus.
    const insertToken = (path: string) => {
        if (!selected || selected.type !== 'text') return;
        snapshot();
        const token = `{{${path}}}`;
        const ta = contentRef.current;
        if (ta && document.activeElement === ta) {
            const s = ta.selectionStart ?? selected.content.length;
            const e = ta.selectionEnd ?? s;
            update(selected.id, { content: selected.content.slice(0, s) + token + selected.content.slice(e) });
        } else {
            update(selected.id, { content: selected.content + token });
        }
    };

    const duplicate = (src: El) => {
        snapshot();
        const id = nextId.current++;
        const copy = { ...src, id, x: Math.min(A4.w, src.x + 20), y: Math.min(A4.h, src.y + 20) } as El;
        setEls((p) => [...p, copy]);
        setSelectedId(id);
        clipboard.current = copy; // cascade: paste berikutnya bergeser lagi
    };

    // Render gambar elemen jadi blob PNG (clipboard.write hanya support image/png).
    const imgToPngBlob = (src: string) =>
        new Promise<Blob>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const c = document.createElement('canvas');
                c.width = img.naturalWidth;
                c.height = img.naturalHeight;
                c.getContext('2d')!.drawImage(img, 0, 0);
                c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob null'))), 'image/png');
            };
            img.onerror = reject;
            img.src = src;
        });

    // Salin elemen ke clipboard OS (selain ke clipboard internal sbg fallback).
    const copyToOS = async (el: El) => {
        try {
            if (el.type === 'text') {
                await navigator.clipboard.writeText(el.content);
            } else {
                const png = await imgToPngBlob(el.src);
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
            }
        } catch {
            // clipboard API bisa gagal (izin/headless) — clipboard internal tetap jadi fallback.
        }
    };

    // Copy/paste keyboard: Ctrl/Cmd+C gandakan elemen; Ctrl/Cmd+V tempel gambar
    // dari clipboard OS (screenshot/web) ATAU gandakan elemen yang disalin.
    React.useEffect(() => {
        const inField = (t: EventTarget | null) =>
            t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);

        const onKey = (e: KeyboardEvent) => {
            if (inField(e.target)) return;
            const mod = e.ctrlKey || e.metaKey;
            if (mod && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) redo(); // Ctrl/Cmd+Shift+Z = redo
                else undo(); // Ctrl/Cmd+Z = undo
                return;
            }
            if (mod && e.key.toLowerCase() === 'c' && selected) {
                clipboard.current = selected;
                copyToOS(selected); // masukkan ke clipboard OS juga
            }
            // Ctrl/Cmd+D: gandakan elemen kanvas langsung (tak bentrok dgn clipboard OS).
            if (mod && e.key.toLowerCase() === 'd' && selected) {
                e.preventDefault();
                duplicate(selected);
            }
            if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
                e.preventDefault();
                remove(selected.id);
            }
        };
        const onPaste = (e: ClipboardEvent) => {
            if (inField(e.target)) return;
            const imageItem = Array.from(e.clipboardData?.items ?? []).find((it) => it.type.startsWith('image/'));
            const file = imageItem?.getAsFile();
            const text = e.clipboardData?.getData('text');
            if (file) {
                e.preventDefault();
                addImage(file, 100, 120); // gambar dari clipboard OS
            } else if (text) {
                e.preventDefault();
                addText(100, 120, text); // teks dari clipboard OS → elemen teks
            } else if (clipboard.current) {
                e.preventDefault();
                duplicate(clipboard.current); // gandakan elemen internal
            }
        };

        window.addEventListener('keydown', onKey);
        window.addEventListener('paste', onPaste);
        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('paste', onPaste);
        };
    }, [selected]);

    // Zoom Ctrl/Cmd + scroll, berpusat di kursor. Wheel native (passive:false) agar bisa preventDefault.
    React.useEffect(() => {
        const node = canvasRef.current;
        if (!node) return;
        const onWheel = (e: WheelEvent) => {
            if (!e.ctrlKey && !e.metaKey) return;
            e.preventDefault();
            const paper = paperRef.current;
            if (!paper) return;
            const rect = paper.getBoundingClientRect();
            const cx = (e.clientX - rect.left) / zoom; // titik di koordinat kertas
            const cy = (e.clientY - rect.top) / zoom;
            const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
            const newZoom = Math.min(3, Math.max(0.2, +(zoom * factor).toFixed(3)));
            if (newZoom === zoom) return;
            zoomAnchor.current = { cx, cy, clientX: e.clientX, clientY: e.clientY };
            setZoom(newZoom);
        };
        node.addEventListener('wheel', onWheel, { passive: false });
        return () => node.removeEventListener('wheel', onWheel);
    }, [zoom]);

    // Setelah zoom berubah, geser scroll agar titik di bawah kursor tetap di tempat.
    React.useLayoutEffect(() => {
        const a = zoomAnchor.current;
        if (!a || !paperRef.current || !canvasRef.current) return;
        const rect = paperRef.current.getBoundingClientRect();
        canvasRef.current.scrollLeft += a.cx * zoom - (a.clientX - rect.left);
        canvasRef.current.scrollTop += a.cy * zoom - (a.clientY - rect.top);
        zoomAnchor.current = null;
    }, [zoom]);

    // Lengkapi tinggi + lock untuk gambar lama (layout tersimpan dulu hanya punya lebar).
    React.useEffect(() => {
        els.filter((e): e is Img => e.type === 'image' && e.height == null).forEach((el) => {
            const probe = new Image();
            probe.onload = () => {
                const height = Math.round(el.width * (probe.naturalHeight / probe.naturalWidth));
                setEls((p) => p.map((e) => (e.id === el.id ? { ...e, height, lockAspect: (e as Img).lockAspect ?? true } : e)));
            };
            probe.src = el.src;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [els]);

    return (
        <div className="flex h-[calc(100vh-7rem)] rounded-xl border border-secondary-200 dark:border-dark-600 overflow-hidden bg-white dark:bg-dark-800">
            {/* ── KIRI: Layers (docked) ── */}
            <aside className="w-52 shrink-0 border-r border-secondary-200 dark:border-dark-600 flex flex-col">
                <PanelHeader title="Layers" meta={els.length ? String(els.length) : undefined} />
                <div className="flex-1 overflow-auto p-2 space-y-0.5">
                    {els.length === 0 && (
                        <p className="text-xs text-dark-400 dark:text-dark-500 px-2 py-3 text-center">Belum ada elemen.<br />Seret dari toolbar.</p>
                    )}
                    {/* urutan teratas = paling depan: tampilkan terbalik */}
                    {[...els].reverse().map((el) => {
                        const active = selectedId === el.id;
                        const isOver = overLayerId === el.id;
                        return (
                            <div
                                key={el.id}
                                draggable
                                onClick={() => setSelectedId(el.id)}
                                onDragStart={(e) => {
                                    dragLayerId.current = el.id;
                                    e.dataTransfer.effectAllowed = 'move';
                                    e.stopPropagation();
                                }}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    if (dragLayerId.current != null && overLayerId !== el.id) setOverLayerId(el.id);
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (dragLayerId.current != null) moveLayer(dragLayerId.current, el.id);
                                    dragLayerId.current = null;
                                    setOverLayerId(null);
                                }}
                                onDragEnd={() => {
                                    dragLayerId.current = null;
                                    setOverLayerId(null);
                                }}
                                className={`group flex items-center gap-1.5 rounded-lg pl-1 pr-1.5 py-1.5 cursor-pointer border-l-2 transition-colors ${
                                    active
                                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                        : 'border-transparent hover:bg-zinc-50 dark:hover:bg-dark-700'
                                } ${isOver ? 'ring-1 ring-primary-400 ring-inset' : ''}`}
                            >
                                <GripVertical className="w-3.5 h-3.5 shrink-0 text-dark-300 dark:text-dark-500 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing" />
                                <span
                                    className={`grid place-items-center h-6 w-6 rounded-md shrink-0 ${
                                        active ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300' : 'bg-zinc-100 dark:bg-dark-700 text-dark-500 dark:text-dark-400'
                                    }`}
                                >
                                    {el.type === 'text' ? <Type className="w-3.5 h-3.5" /> : <ImageIcon className="w-3.5 h-3.5" />}
                                </span>
                                <span className={`flex-1 truncate text-sm ${active ? 'text-primary-700 dark:text-primary-200 font-medium' : 'text-dark-700 dark:text-dark-300'}`}>
                                    {el.type === 'text' ? el.content : 'Gambar'}
                                </span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        remove(el.id);
                                    }}
                                    className="grid place-items-center h-6 w-6 rounded-md text-dark-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition"
                                    title="Hapus"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </aside>

            {/* ── TENGAH: Kanvas ── */}
            <div className="relative flex-1 overflow-hidden">
                {/* lapisan scroll (zoom meluap di sini) */}
                <div ref={canvasRef} className="absolute inset-0 overflow-auto bg-zinc-200 dark:bg-dark-950">
                    <div className="min-h-full flex items-start justify-center p-10">
                    {/* wrapper ber-ukuran ter-scale supaya scroll/center benar */}
                    <div style={{ width: A4.w * zoom, height: A4.h * zoom }}>
                        <div
                            ref={paperRef}
                            onPointerDown={() => setSelectedId(null)}
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'copy';
                                if (!dragOver) setDragOver(true);
                            }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={onDrop}
                            className={`relative overflow-hidden bg-white shadow-xl origin-top-left ${dragOver ? 'ring-2 ring-primary-500' : ''}`}
                            style={{ width: A4.w, height: A4.h, transform: `scale(${zoom})` }}
                        >
                            {els.map((el) => {
                                const isSel = selectedId === el.id;
                                const isEditing = editingId === el.id;
                                return (
                                    <div
                                        key={el.id}
                                        onPointerDown={(e) => {
                                            if (isEditing) {
                                                e.stopPropagation(); // saat edit, klik = taruh kursor, bukan drag
                                                return;
                                            }
                                            startDrag(e, el);
                                        }}
                                        className={`absolute select-none ${isEditing ? 'cursor-text' : 'cursor-move'} ${isSel && !preview ? 'outline-2 outline-primary-500' : ''}`}
                                        style={{
                                            left: el.x,
                                            top: el.y,
                                            touchAction: 'none',
                                            // Lebar eksplisit utk gambar → wrapper tak shrink-to-fit saat dekat tepi kanan.
                                            ...(el.type === 'image' ? { width: el.width, height: el.height } : {}),
                                        }}
                                    >
                                        {el.type === 'text' ? (
                                            preview ? (
                                                <span
                                                    className="whitespace-nowrap leading-none"
                                                    style={{ fontSize: el.fontSize, fontWeight: el.bold ? 700 : 400, color: el.color }}
                                                >
                                                    {resolve(el.content)}
                                                </span>
                                            ) : (
                                                <EditableText
                                                    el={el}
                                                    editing={isEditing}
                                                    onStartEdit={() => setEditingId(el.id)}
                                                    onCommit={(v) => {
                                                        if (v !== el.content) {
                                                            snapshot();
                                                            update(el.id, { content: v });
                                                        }
                                                        setEditingId(null);
                                                    }}
                                                />
                                            )
                                        ) : (
                                            <img
                                                src={el.src}
                                                alt=""
                                                draggable={false}
                                                // w/h penuh dari wrapper; maxWidth:none mematahkan preflight `img{max-width:100%}`.
                                                style={{ width: '100%', height: '100%', maxWidth: 'none' }}
                                                className="pointer-events-none block"
                                            />
                                        )}

                                        {/* Resize handle sudut (gambar terpilih) */}
                                        {isSel && !preview && el.type === 'image' &&
                                            (['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
                                                <span
                                                    key={corner}
                                                    onPointerDown={(e) => startResize(e, el, corner)}
                                                    className={`absolute z-10 h-2.5 w-2.5 rounded-sm border border-primary-500 bg-white ${
                                                        corner === 'nw'
                                                            ? 'left-0 top-0 -translate-x-full -translate-y-full cursor-nwse-resize'
                                                            : corner === 'ne'
                                                              ? 'right-0 top-0 translate-x-full -translate-y-full cursor-nesw-resize'
                                                              : corner === 'sw'
                                                                ? 'left-0 bottom-0 -translate-x-full translate-y-full cursor-nesw-resize'
                                                                : 'right-0 bottom-0 translate-x-full translate-y-full cursor-nwse-resize'
                                                    }`}
                                                />
                                            ))}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
                </div>

                {/* Toolbar mengambang (di luar lapisan scroll → tetap diam) */}
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1.5 rounded-xl bg-white dark:bg-dark-700 border border-secondary-200 dark:border-dark-600 shadow-lg">
                    <div
                        draggable
                        onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = 'copy';
                            e.dataTransfer.setData('kind', 'text');
                        }}
                        title="Seret ke kanvas, atau klik"
                    >
                        <Button variant="ghost" size="sm" className="cursor-grab active:cursor-grabbing" onClick={() => addText()}>
                            <Type className="w-4 h-4" /> Teks
                        </Button>
                    </div>
                    <div
                        draggable
                        onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = 'copy';
                            e.dataTransfer.setData('kind', 'image');
                        }}
                        title="Seret ke kanvas, atau klik"
                    >
                        <Button variant="ghost" size="sm" className="cursor-grab active:cursor-grabbing" onClick={() => fileRef.current?.click()}>
                            <ImageIcon className="w-4 h-4" /> Gambar
                        </Button>
                    </div>
                    <div className="w-px h-6 bg-secondary-200 dark:bg-dark-600 mx-1" />
                    <Button
                        variant={preview ? 'primary' : 'ghost'}
                        size="sm"
                        onClick={() => {
                            setPreview((p) => !p);
                            setEditingId(null);
                        }}
                        title="Lihat hasil dengan data contoh"
                    >
                        {preview ? <Pencil className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        {preview ? 'Edit' : 'Preview'}
                    </Button>
                    <div className="w-px h-6 bg-secondary-200 dark:bg-dark-600 mx-1" />
                    <Button variant="ghost" size="icon" onClick={() => undo()} title="Undo (Ctrl+Z)">
                        <Undo2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => redo()} title="Redo (Ctrl+Shift+Z)">
                        <Redo2 className="w-4 h-4" />
                    </Button>
                    <div className="w-px h-6 bg-secondary-200 dark:bg-dark-600 mx-1" />
                    <Button variant="ghost" size="icon" onClick={() => setZoom((z) => Math.max(0.2, +(z - 0.1).toFixed(2)))}>
                        <ZoomOut className="w-4 h-4" />
                    </Button>
                    <span className="text-xs tabular-nums text-dark-500 dark:text-dark-400 w-10 text-center">{Math.round(zoom * 100)}%</span>
                    <Button variant="ghost" size="icon" onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))}>
                        <ZoomIn className="w-4 h-4" />
                    </Button>
                    <div className="w-px h-6 bg-secondary-200 dark:bg-dark-600 mx-1" />
                    <Button variant="ghost" size="sm" onClick={openPdf} title="Cetak PDF (data contoh)">
                        <FileDown className="w-4 h-4" /> PDF
                    </Button>
                    <Button variant="primary" size="sm" onClick={save} disabled={saving}>
                        <Save className="w-4 h-4" /> {saving ? 'Menyimpan…' : 'Simpan'}
                    </Button>
                </div>

                <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                            const p = pendingImg.current;
                            pendingImg.current = null;
                            addImage(file, p?.x, p?.y);
                        }
                        e.target.value = ''; // reset agar file sama bisa dipilih lagi
                    }}
                />
            </div>

            {/* ── KANAN: Inspector kontekstual (docked) ── */}
            <aside className="w-64 shrink-0 border-l border-secondary-200 dark:border-dark-600 flex flex-col">
                <PanelHeader title={selected ? (selected.type === 'text' ? 'Teks' : 'Gambar') : 'Properti'} />

                {!selected ? (
                    <div className="flex-1 grid place-items-center p-6 text-center">
                        <p className="text-xs text-dark-400 dark:text-dark-500 leading-relaxed">
                            Pilih elemen di kanvas<br />untuk mengatur propertinya.
                        </p>
                    </div>
                ) : (
                    <div
                        className="flex-1 overflow-auto px-3 divide-y divide-secondary-200 dark:divide-dark-600"
                        onFocusCapture={(e) => {
                            const t = e.target as HTMLElement;
                            if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') snapshot(); // satu entri undo per sesi edit field
                        }}
                    >
                        {selected.type === 'text' && (
                            <>
                                <Section title="Konten">
                                    <textarea
                                        ref={contentRef}
                                        value={selected.content}
                                        onChange={(e) => update(selected.id, { content: e.target.value })}
                                        rows={2}
                                        className={`${inputCn} h-auto py-1.5 font-mono text-xs leading-relaxed`}
                                    />
                                    {/* Field picker — sisip token data dinamis */}
                                    <div className="relative">
                                        <Button variant="zinc" size="sm" className="w-full" onClick={() => setFieldMenu((o) => !o)}>
                                            <Plus className="w-4 h-4" /> Sisipkan field
                                        </Button>
                                        {fieldMenu && (
                                            <div className="absolute z-20 left-0 right-0 mt-1 max-h-56 overflow-auto rounded-lg border border-secondary-200 dark:border-dark-600 bg-white dark:bg-dark-700 shadow-lg p-1">
                                                {TOKENS.map((t) => (
                                                    <button
                                                        key={t.path}
                                                        onClick={() => {
                                                            insertToken(t.path);
                                                            setFieldMenu(false);
                                                        }}
                                                        className="w-full text-left px-2 py-1.5 rounded-md hover:bg-zinc-50 dark:hover:bg-dark-600"
                                                    >
                                                        <div className="text-xs font-mono text-primary-600 dark:text-primary-400">{`{{${t.path}}}`}</div>
                                                        <div className="text-[11px] text-dark-400 dark:text-dark-500 truncate">{t.sample}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-dark-400 dark:text-dark-500">
                                        Token diganti data asli saat <strong>Preview</strong> / cetak.
                                    </p>
                                </Section>
                                <Section title="Tampilan">
                                    <Row label="Ukuran">
                                        <NumField value={selected.fontSize} onChange={(v) => update(selected.id, { fontSize: v })} />
                                    </Row>
                                    <Row label="Warna">
                                        <Swatch value={selected.color} onChange={(v) => update(selected.id, { color: v })} />
                                    </Row>
                                    <Row label="Tebal">
                                        <button
                                            onClick={() => {
                                                snapshot();
                                                update(selected.id, { bold: !(selected as Text).bold });
                                            }}
                                            className={`grid place-items-center h-8 w-8 rounded-lg border transition-colors ${
                                                selected.bold
                                                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-300'
                                                    : 'border-secondary-200 dark:border-dark-600 text-dark-500 dark:text-dark-400 hover:bg-zinc-50 dark:hover:bg-dark-700'
                                            }`}
                                            title="Bold"
                                        >
                                            <BoldIcon className="w-4 h-4" />
                                        </button>
                                    </Row>
                                </Section>
                            </>
                        )}

                        {selected.type === 'image' && (
                            <Section title="Gambar">
                                <Row label="Lebar">
                                    <NumField value={selected.width} onChange={(v) => setImgSize(selected, 'width', v)} />
                                </Row>
                                <Row label="Tinggi">
                                    <NumField value={Math.round(selected.height ?? 0)} onChange={(v) => setImgSize(selected, 'height', v)} />
                                </Row>
                                <Row label="Rasio">
                                    <button
                                        onClick={() => {
                                            snapshot();
                                            update(selected.id, { lockAspect: !(selected as Img).lockAspect });
                                        }}
                                        className={`flex items-center gap-2 h-8 w-full rounded-lg border px-2.5 text-sm transition-colors ${
                                            selected.lockAspect
                                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                                                : 'border-secondary-200 dark:border-dark-600 text-dark-500 dark:text-dark-400 hover:bg-zinc-50 dark:hover:bg-dark-700'
                                        }`}
                                        title="Kunci rasio lebar : tinggi"
                                    >
                                        {selected.lockAspect ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                        {selected.lockAspect ? 'Terkunci' : 'Bebas'}
                                    </button>
                                </Row>
                                <Button variant="zinc" size="sm" className="w-full" onClick={() => resetImage(selected)}>
                                    <RotateCcw className="w-4 h-4" /> Reset ke ukuran asli
                                </Button>
                                <Button variant="zinc" size="sm" className="w-full" onClick={() => fileRef.current?.click()}>
                                    <ImageIcon className="w-4 h-4" /> Ganti gambar
                                </Button>
                            </Section>
                        )}

                        <Section title="Posisi">
                            <Row label="X">
                                <NumField value={Math.round(selected.x)} onChange={(v) => update(selected.id, { x: v })} />
                            </Row>
                            <Row label="Y">
                                <NumField value={Math.round(selected.y)} onChange={(v) => update(selected.id, { y: v })} />
                            </Row>
                        </Section>

                        <Section title="">
                            <Button variant="zinc" size="sm" className="w-full" onClick={() => duplicate(selected)}>
                                <Copy className="w-4 h-4" /> Gandakan <span className="text-xs opacity-60">Ctrl+D</span>
                            </Button>
                            <Button variant="red" size="sm" className="w-full" onClick={() => remove(selected.id)}>
                                <Trash2 className="w-4 h-4" /> Hapus elemen
                            </Button>
                        </Section>
                    </div>
                )}
            </aside>
        </div>
    );
}

const inputCn =
    'h-8 w-full rounded-lg border border-secondary-200 dark:border-dark-600 bg-white dark:bg-dark-800 px-2.5 text-sm text-dark-900 dark:text-dark-50 tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500';

function PanelHeader({ title, meta }: { title: string; meta?: string }) {
    return (
        <div className="flex items-center justify-between px-3 h-9 shrink-0 border-b border-secondary-200 dark:border-dark-600 bg-zinc-50/60 dark:bg-dark-900/30">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-dark-500 dark:text-dark-400">{title}</span>
            {meta && (
                <span className="text-[11px] tabular-nums text-dark-500 dark:text-dark-400 bg-zinc-100 dark:bg-dark-700 rounded-full px-1.5 py-0.5">{meta}</span>
            )}
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="py-3.5 first:pt-3 space-y-2.5">
            {title && <h4 className="text-[11px] font-semibold uppercase tracking-wider text-dark-400 dark:text-dark-500">{title}</h4>}
            {children}
        </section>
    );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-xs text-dark-500 dark:text-dark-400">{label}</span>
            <div className="flex-1 min-w-0">{children}</div>
        </div>
    );
}

function NumField({ value, onChange, unit = 'px' }: { value: number; onChange: (v: number) => void; unit?: string }) {
    return (
        <div className="relative">
            <input type="number" value={value} onChange={(e) => onChange(+e.target.value)} className={`${inputCn} pr-8`} />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-dark-400 dark:text-dark-500 pointer-events-none">{unit}</span>
        </div>
    );
}

function Swatch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <div className="flex items-center gap-2 h-8 rounded-lg border border-secondary-200 dark:border-dark-600 bg-white dark:bg-dark-800 pl-1.5 pr-2.5">
            <input
                type="color"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="h-5 w-5 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0 appearance-none"
            />
            <input
                type="text"
                value={value.toUpperCase()}
                onChange={(e) => onChange(e.target.value)}
                className="flex-1 min-w-0 bg-transparent text-xs tabular-nums uppercase text-dark-700 dark:text-dark-300 outline-none"
            />
        </div>
    );
}

// Edit teks inline langsung di kanvas (tanpa prompt). contentEditable di-set via ref
// saat masuk mode edit; children disembunyikan saat edit agar React tak menimpa ketikan.
// ponytail: aman karena saat mengetik tak ada setState lain yang memicu re-render.
function EditableText({ el, editing, onStartEdit, onCommit }: { el: Text; editing: boolean; onStartEdit: () => void; onCommit: (v: string) => void }) {
    const ref = React.useRef<HTMLSpanElement>(null);
    React.useEffect(() => {
        if (!editing || !ref.current) return;
        const node = ref.current;
        node.textContent = el.content;
        node.focus();
        const range = document.createRange();
        range.selectNodeContents(node);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editing]);

    return (
        <span
            ref={ref}
            contentEditable={editing}
            suppressContentEditableWarning
            onDoubleClick={onStartEdit}
            onBlur={(e) => onCommit(e.currentTarget.textContent ?? '')}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.blur();
                } else if (e.key === 'Escape') {
                    e.currentTarget.textContent = el.content;
                    e.currentTarget.blur();
                }
            }}
            className={`whitespace-nowrap leading-none ${editing ? 'cursor-text outline-none' : ''}`}
            style={{ fontSize: el.fontSize, fontWeight: el.bold ? 700 : 400, color: el.color }}
        >
            {editing ? null : el.content}
        </span>
    );
}

TemplateBuilderTest.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;
