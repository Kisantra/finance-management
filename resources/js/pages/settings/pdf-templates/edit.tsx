import * as React from 'react';
import { router, usePage } from '@inertiajs/react';
import { toast } from 'sonner';
import { AppLayout } from '@/layouts/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Combobox } from '@/components/ui/combobox';
import { ColorInput } from '@/components/ui/color-input';
import { Slider } from '@/components/ui/slider';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
    Type,
    Image as ImageIcon,
    Table2,
    LayoutGrid,
    Trash2,
    ZoomIn,
    ZoomOut,
    Bold as BoldIcon,
    Italic,
    Underline,
    Strikethrough,
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignJustify,
    AlignStartVertical,
    AlignCenterVertical,
    AlignEndVertical,
    GripVertical,
    Copy,
    Undo2,
    Redo2,
    Eye,
    Pencil,
    Plus,
    Minus,
    Save,
    FileDown,
    Lock,
    Unlock,
    RotateCcw,
    ArrowLeft,
    ChevronUp,
    ChevronDown,
    GripHorizontal,
    Upload,
    Minus as LineIcon,
    Square as RectIcon,
    Repeat2,
    Layers,
} from 'lucide-react';
import { companyUrl } from '@/lib/company';
import type { SharedProps } from '@/types';

// ponytail: koordinat px @96dpi. A4 = 794x1123.
const A4 = { w: 794, h: 1123 };

const DEFAULT_MARGINS = { top: 40, right: 40, bottom: 40, left: 40 };

// â”€â”€ Font map (ONE source of truth â€” editor CSS stack + DomPDF family name) â”€â”€â”€â”€â”€â”€
export const FONT_MAP = [
    { label: 'Helvetica / Arial',  cssFontStack: 'Helvetica, Arial, sans-serif',     dompdfFamily: 'Helvetica' },
    { label: 'Times New Roman',    cssFontStack: '"Times New Roman", Times, serif',   dompdfFamily: 'Times New Roman' },
    { label: 'Courier',            cssFontStack: '"Courier New", Courier, monospace', dompdfFamily: 'Courier' },
    { label: 'DejaVu Sans',        cssFontStack: '"DejaVu Sans", sans-serif',         dompdfFamily: 'DejaVu Sans' },
] as const;

export type FontLabel = typeof FONT_MAP[number]['label'];

export interface CustomFontEntry {
    id: number;
    name: string;
    url: string;
}

export function fontCssStack(label: FontLabel | string | undefined, customFonts: CustomFontEntry[] = []): string {
    const curated = FONT_MAP.find((f) => f.label === label);
    if (curated) return curated.cssFontStack;
    if (label && customFonts.some((f) => f.name === label)) return `"${label}"`;
    return 'Helvetica, Arial, sans-serif';
}

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type Text = {
    id: number; type: 'text';
    x: number; y: number;
    content: string; fontSize: number; bold: boolean; color: string;
    fontFamily?: FontLabel;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    highlight?: string | null;
    align?: 'left' | 'center' | 'right' | 'justify';
    valign?: 'top' | 'middle' | 'bottom';
    lineHeight?: number;
    letterSpacing?: number;
    padding?: number;
    borderWidth?: number;
    borderColor?: string;
    fill?: string | null;
    width?: number;
    height?: number;
};

type Img = {
    id: number; type: 'image';
    x: number; y: number;
    src: string; width: number; height?: number; lockAspect?: boolean;
    opacity?: number;
    borderWidth?: number;
    borderColor?: string;
    borderRadius?: number;
};

type TableColumn = {
    key: string;
    label: string;
    width: number;
    align: 'left' | 'center' | 'right';
    format: 'text' | 'number' | 'rupiah';
};

// â”€â”€ TRB (Tabel Terpadu Row-Band) types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type TableCell = {
    content: string;
    colSpan?: number;
    rowSpan?: number;
    align: 'left' | 'center' | 'right';
    bold?: boolean;
    color?: string;
    fill?: string;
    fontSize?: number;
    merged?: boolean;
};

type TableRow = {
    kind: 'head' | 'body' | 'foot';
    repeat?: 'items';
    height?: number;
    cells: TableCell[];
};

type TableEl = {
    id: number; type: 'table';
    x: number; y: number;
    width: number;
    colWidths: number[];
    rows: TableRow[];
    border: { width: number; color: string };
    // LEGACY fields kept for migration detection only:
    columns?: unknown;
    showFooterSum?: boolean;
    headerGroups?: unknown;
};

type GridCell = {
    text: string;
    align: 'left' | 'center' | 'right';
    bold: boolean;
    color: string;
    fill?: string;
    colSpan?: number;
    rowSpan?: number;
    merged?: boolean;
};

type GridEl = {
    id: number; type: 'grid';
    x: number; y: number;
    width: number;
    cols: number;
    rows: number;
    colWidths: number[];
    cells: GridCell[][];
    border: { width: number; color: string };
    anchorCell?: { row: number; col: number } | null;
};

type RectEl = {
    id: number; type: 'rect';
    x: number; y: number;
    width: number; height: number;
    fill?: string | null;
    borderWidth: number;
    borderColor: string;
    borderRadius: number;
};

type LineEl = {
    id: number; type: 'line';
    x: number; y: number;
    length: number;
    thickness: number;
    color: string;
    orientation: 'h' | 'v';
};

type El = Text | Img | TableEl | GridEl | RectEl | LineEl;
type BandEl = Text | Img | GridEl | RectEl | LineEl;

// â”€â”€ Banded layout types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type BandName = 'header' | 'content' | 'footerFlow' | 'footerFixed';

type Band = {
    height: number;
    elements: BandEl[];
};

type HeaderBand = Band & { repeat: boolean };

type BandedLayout = {
    paper: { margins: { top: number; right: number; bottom: number; left: number } };
    bands: {
        header: HeaderBand;
        content: { table: TableEl | null };
        footerFlow: Band;
        footerFixed: Band;
    };
};

// â”€â”€ Catalog types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface TokenEntry { path: string; label: string; }

interface ItemColumnEntry {
    key: string;
    label: string;
    align: 'left' | 'center' | 'right';
    format: 'text' | 'number' | 'rupiah';
    default: boolean;
}

interface TemplateProps { id: number; name: string; layout: unknown; }

interface Props extends SharedProps {
    template: TemplateProps;
    tokenCatalog: TokenEntry[];
    sampleData: Record<string, string>;
    itemColumnCatalog: ItemColumnEntry[];
    sampleItems: Array<Record<string, string>>;
    customFonts: CustomFontEntry[];
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function makeDefaultTable(id: number, catalog: ItemColumnEntry[], x: number, y: number): TableEl {
    const defaults = catalog.filter((c) => c.default);
    const widths: Record<string, number> = {
        no: 36, description: 290, quantity: 72, unit: 80, unit_price: 130, amount: 130,
        cogs_amount: 130, is_tax_deposit: 100,
    };
    const colWidths = defaults.map((c) => widths[c.key] ?? 100);

    const headRow: TableRow = {
        cells: defaults.map((c) => ({ content: c.label, align: c.align, bold: true })),
    };
    const detailRow: TableRow = {
        repeat: 'items',
        cells: defaults.map((c) => ({ content: `{{item.${c.key}}}`, align: c.align })),
    };

    return {
        id, type: 'table', x, y,
        width: colWidths.reduce((a, b) => a + b, 0) || 714,
        colWidths,
        rows: [headRow, detailRow],
        border: { width: 1, color: '#e2e8f0' },
    };
}

const TABLE_HEADER_H = 28;
const TABLE_ROW_H = 24;
const TABLE_PLACEHOLDER_ROWS = 3;

function rowVisualH(row: TableRow, sampleCount = TABLE_PLACEHOLDER_ROWS): number {
    const baseH = row.height ?? (row.kind === 'body' ? TABLE_ROW_H : TABLE_HEADER_H);
    return row.repeat === 'items' ? baseH * sampleCount : baseH;
}

function tableEditorHeight(el: TableEl): number {
    return el.rows.reduce((sum, r) => sum + rowVisualH(r, TABLE_PLACEHOLDER_ROWS), 0) + 2;
}

function tablePreviewHeight(el: TableEl, sampleItems: Array<Record<string, string>>): number {
    return el.rows.reduce((sum, r) => sum + rowVisualH(r, Math.max(1, sampleItems.length)), 0) + 2;
}

function makeGridCell(): GridCell {
    return { text: '', align: 'left', bold: false, color: '#0f172a' };
}

function makeDefaultGrid(id: number, x: number, y: number): GridEl {
    const cols = 3; const rows = 3; const width = 300;
    const colWidth = Math.floor(width / cols);
    return {
        id, type: 'grid', x, y, width, cols, rows,
        colWidths: Array.from({ length: cols }, () => colWidth),
        cells: Array.from({ length: rows }, () => Array.from({ length: cols }, makeGridCell)),
        border: { width: 1, color: '#cbd5e1' },
    };
}

const GRID_ROW_H = 24;
function gridEditorHeight(el: GridEl): number {
    return GRID_ROW_H * el.rows + el.border.width * (el.rows + 1);
}

function makeDefaultRect(id: number, x: number, y: number): RectEl {
    return { id, type: 'rect', x, y, width: 200, height: 40, fill: null, borderWidth: 1, borderColor: '#0f172a', borderRadius: 0 };
}

function makeDefaultLine(id: number, x: number, y: number): LineEl {
    return { id, type: 'line', x, y, length: 300, thickness: 1, color: '#0f172a', orientation: 'h' };
}

function lineElWidth(el: LineEl): number { return el.orientation === 'h' ? el.length : el.thickness; }
function lineElHeight(el: LineEl): number { return el.orientation === 'h' ? el.thickness : el.length; }

// â”€â”€ Legacy migration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function migrateToLegacyBanded(oldEls: El[]): BandedLayout['bands'] {
    const tableEl = oldEls.find((e): e is TableEl => e.type === 'table') ?? null;
    const bandEls = oldEls.filter((e) => e.type !== 'table') as BandEl[];
    return {
        header: { height: 200, repeat: false, elements: bandEls },
        content: { table: tableEl },
        footerFlow: { height: 80, elements: [] },
        footerFixed: { height: 40, elements: [] },
    };
}

// â”€â”€ TRB migration helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Detect if a stored table element uses the OLD column-based model. */
function isLegacyTableEl(el: unknown): boolean {
    if (!el || typeof el !== 'object') { return false; }
    const t = el as Record<string, unknown>;
    return Array.isArray(t.columns) && !Array.isArray(t.rows);
}

/**
 * Migrate OLD column-based TableEl â†’ new row-band TableEl.
 * Detection: old shape has `columns` array but no `rows` array.
 */
function migrateTableElToRowBand(old: Record<string, unknown>): TableEl {
    const columns = (old.columns as Array<{ key: string; label: string; width: number; align: 'left' | 'center' | 'right'; format: string }>) ?? [];
    const headerGroups = old.headerGroups as Array<{ label: string; span: number; align?: 'left' | 'center' | 'right' }> | undefined;
    const showFooterSum = (old.showFooterSum as boolean | undefined) ?? false;

    const colWidths = columns.map((c) => c.width ?? 100);
    const border = { width: 1, color: '#e2e8f0' };

    const rows: TableRow[] = [];

    // Head row from headerGroups (if present)
    if (headerGroups && headerGroups.length > 0) {
        const groupCells: TableCell[] = headerGroups.map((g) => ({
            content: g.label,
            colSpan: g.span ?? 1,
            align: g.align ?? 'center',
            bold: true,
        }));
        rows.push({ kind: 'head', cells: groupCells });
    }

    // Head row from column labels
    rows.push({
        kind: 'head',
        cells: columns.map((c) => ({
            content: c.label,
            align: c.align,
            bold: true,
        })),
    });

    // Detail row (repeat:items) â€” one cell per column with item.* token
    rows.push({
        kind: 'body',
        repeat: 'items',
        cells: columns.map((c) => ({
            content: `{{item.${c.key}}}`,
            align: c.align,
        })),
    });

    // Foot row if showFooterSum
    if (showFooterSum) {
        rows.push({
            kind: 'foot',
            cells: columns.map((c, i) => ({
                content: i === 0 ? 'Total' : (c.format === 'rupiah' || c.format === 'number') ? `{{item.sum.${c.key}}}` : '',
                align: c.align,
            })),
        });
    }

    return {
        id: (old.id as number) ?? 1,
        type: 'table',
        x: (old.x as number) ?? 40,
        y: (old.y as number) ?? 200,
        width: (old.width as number) ?? 714,
        colWidths,
        rows,
        border,
    };
}

const DEFAULT_BANDS: BandedLayout['bands'] = {
    header: {
        height: 180, repeat: false,
        elements: [{
            id: 1, type: 'text', x: 60, y: 40, content: 'Invoice {{invoice.number}}',
            fontSize: 20, bold: true, color: '#0f172a', fontFamily: 'Helvetica / Arial',
            italic: false, underline: false, strikethrough: false,
            align: 'left', lineHeight: 1.2, letterSpacing: 0, padding: 0, width: 300,
        }],
    },
    content: { table: null },
    footerFlow: { height: 120, elements: [] },
    footerFixed: { height: 50, elements: [] },
};

function bandLabel(band: BandName): string {
    if (band === 'header') return 'Header';
    if (band === 'content') return 'Konten';
    if (band === 'footerFlow') return 'Footer Flow';
    return 'Footer Tetap';
}

// â”€â”€ Margin Settings Panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type Margins = { top: number; right: number; bottom: number; left: number };

function MarginSettingsPanel({
    margins,
    onChangeMargins,
}: {
    margins: Margins;
    onChangeMargins: (m: Margins) => void;
}) {
    const set = (key: keyof Margins, v: number) =>
        onChangeMargins({ ...margins, [key]: Math.max(0, v) });

    return (
        <div className="rounded-xl border border-secondary-200 dark:border-dark-600 bg-white dark:bg-dark-700 overflow-hidden shadow-sm">
            <div className="px-3 py-2 bg-zinc-50 dark:bg-dark-800 border-b border-secondary-200 dark:border-dark-600">
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-dark-400 dark:text-dark-500">Margin Halaman</span>
            </div>
            <div className="p-3 space-y-2">
                {/* Visual margin diagram */}
                <div className="flex items-center justify-center py-1">
                    <div className="relative w-20 h-24 border-2 border-zinc-200 dark:border-dark-600 rounded-md bg-zinc-50 dark:bg-dark-800">
                        <div
                            className="absolute inset-0 border border-dashed border-primary-300 dark:border-primary-700/50 rounded-sm"
                            style={{
                                top: Math.round((margins.top / 40) * 8),
                                right: Math.round((margins.right / 40) * 8),
                                bottom: Math.round((margins.bottom / 40) * 8),
                                left: Math.round((margins.left / 40) * 8),
                            }}
                        />
                        <span className="absolute inset-0 flex items-center justify-center text-[8px] text-dark-300 dark:text-dark-600 font-medium">A4</span>
                    </div>
                </div>
                <Row label="Atas">
                    <NumField value={margins.top} onChange={(v) => set('top', v)} unit="px" />
                </Row>
                <Row label="Kanan">
                    <NumField value={margins.right} onChange={(v) => set('right', v)} unit="px" />
                </Row>
                <Row label="Bawah">
                    <NumField value={margins.bottom} onChange={(v) => set('bottom', v)} unit="px" />
                </Row>
                <Row label="Kiri">
                    <NumField value={margins.left} onChange={(v) => set('left', v)} unit="px" />
                </Row>
            </div>
        </div>
    );
}

// â”€â”€ Band Settings Panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function BandSettingsPanel({
    bands,
    onChangeBands,
}: {
    bands: BandedLayout['bands'];
    onChangeBands: (patch: Partial<BandedLayout['bands']>) => void;
}) {
    return (
        <div className="space-y-2">
            {/* Section title */}
            <span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-dark-400 dark:text-dark-500 px-0.5">
                Ukuran Band
            </span>

            {/* Header band card */}
            <div className="rounded-xl border border-secondary-200 dark:border-dark-600 bg-white dark:bg-dark-700 overflow-hidden shadow-sm">
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50/60 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/20">
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-dark-600 dark:text-dark-300 flex-1">Header</span>
                    <Badge variant="blue" size="sm">Tetap</Badge>
                </div>
                <div className="p-3 space-y-2">
                    <Row label="Tinggi">
                        <NumField
                            value={bands.header.height}
                            onChange={(v) => onChangeBands({ header: { ...bands.header, height: Math.max(20, v) } })}
                            unit="px"
                        />
                    </Row>
                    {/* Header repeat toggle â€” catalog Switch */}
                    <div className="flex items-center gap-2">
                        <span className="w-12 shrink-0 text-xs text-dark-500 dark:text-dark-400">Ulangi</span>
                        <Switch
                            checked={bands.header.repeat}
                            onCheckedChange={(checked) => onChangeBands({ header: { ...bands.header, repeat: checked } })}
                        />
                        <span className="text-xs text-dark-500 dark:text-dark-400 flex items-center gap-1">
                            <Repeat2 className="w-3 h-3" />
                            {bands.header.repeat ? 'Tiap halaman' : 'Hal. pertama saja'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Content band card */}
            <div className="rounded-xl border border-secondary-200 dark:border-dark-600 bg-white dark:bg-dark-700 overflow-hidden shadow-sm">
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50/60 dark:bg-emerald-900/10 border-b border-emerald-100 dark:border-emerald-900/20">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-dark-600 dark:text-dark-300 flex-1">Konten</span>
                    <Badge variant="emerald" size="sm">Dinamis â‡•</Badge>
                </div>
                <div className="px-3 py-2.5">
                    <p className="text-[11px] text-dark-400 dark:text-dark-500 leading-relaxed">Tinggi otomatis â€” mengikuti jumlah baris item invoice.</p>
                </div>
            </div>

            {/* Footer Flow band card */}
            <div className="rounded-xl border border-secondary-200 dark:border-dark-600 bg-white dark:bg-dark-700 overflow-hidden shadow-sm">
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50/60 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-900/20">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-dark-600 dark:text-dark-300 flex-1">Footer Flow</span>
                    <Badge variant="orange" size="sm">Setelah konten</Badge>
                </div>
                <div className="p-3">
                    <Row label="Tinggi">
                        <NumField
                            value={bands.footerFlow.height}
                            onChange={(v) => onChangeBands({ footerFlow: { ...bands.footerFlow, height: Math.max(20, v) } })}
                            unit="px"
                        />
                    </Row>
                </div>
            </div>

            {/* Footer Fixed band card */}
            <div className="rounded-xl border border-secondary-200 dark:border-dark-600 bg-white dark:bg-dark-700 overflow-hidden shadow-sm">
                <div className="flex items-center gap-2 px-3 py-2 bg-purple-50/60 dark:bg-purple-900/10 border-b border-purple-100 dark:border-purple-900/20">
                    <span className="inline-block w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-dark-600 dark:text-dark-300 flex-1">Footer Tetap</span>
                    <Badge variant="purple" size="sm">Tiap halaman</Badge>
                </div>
                <div className="p-3 space-y-2">
                    <Row label="Tinggi">
                        <NumField
                            value={bands.footerFixed.height}
                            onChange={(v) => onChangeBands({ footerFixed: { ...bands.footerFixed, height: Math.max(20, v) } })}
                            unit="px"
                        />
                    </Row>
                    <p className="text-[11px] text-dark-400 dark:text-dark-500 leading-relaxed">Dipaku di bagian bawah setiap halaman, di atas margin bawah.</p>
                </div>
            </div>
        </div>
    );
}

// â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function PdfTemplateEdit() {
    const { template, tokenCatalog, sampleData, itemColumnCatalog, sampleItems, customFonts } = usePage<Props>().props;

    // Inject @font-face for custom fonts
    React.useEffect(() => {
        if (!customFonts?.length) return;
        const id = 'custom-fonts-style';
        let style = document.getElementById(id) as HTMLStyleElement | null;
        if (!style) {
            style = document.createElement('style');
            style.id = id;
            document.head.appendChild(style);
        }
        style.textContent = customFonts
            .map((f) => `@font-face { font-family: "${f.name}"; src: url("${f.url}") format("truetype"); }`)
            .join('\n');
        return () => { style?.remove(); };
    }, [customFonts]);

    const resolve = (text: string | null | undefined): string =>
        (text ?? '').replace(/\{\{([\w.]+)\}\}/g, (match, path: string) =>
            Object.prototype.hasOwnProperty.call(sampleData, path) ? sampleData[path] : match,
        );

    // Compute initial bands + margins from layout (banded, legacy array, or default).
    // Also runs TRB migration: if content.table uses the old column-based model,
    // it is migrated to the new row-band model on first load.
    const { initialBands, initialMargins } = React.useMemo(() => {
        const layout = template.layout;
        if (layout && typeof layout === 'object' && !Array.isArray(layout) && 'bands' in (layout as object)) {
            const bl = layout as BandedLayout;
            let loadedBands = bl.bands;
            // TRB migration: old column-based table â†’ new row-band TableEl
            const rawTable = loadedBands.content.table;
            if (isLegacyTableEl(rawTable)) {
                loadedBands = {
                    ...loadedBands,
                    content: { table: migrateTableElToRowBand(rawTable as Record<string, unknown>) },
                };
            }
            return { initialBands: loadedBands, initialMargins: bl.paper?.margins ?? { ...DEFAULT_MARGINS } };
        }
        if (Array.isArray(layout) && layout.length > 0) {
            return { initialBands: migrateToLegacyBanded(layout as El[]), initialMargins: { ...DEFAULT_MARGINS } };
        }
        return { initialBands: DEFAULT_BANDS, initialMargins: { ...DEFAULT_MARGINS } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [bands, setBands] = React.useState<BandedLayout['bands']>(initialBands);
    const [margins, setMargins] = React.useState<{ top: number; right: number; bottom: number; left: number }>(initialMargins);
    const [guides, setGuides] = React.useState<Array<{ x: number; bandName: BandName }>>([]);
    const [activeBand, setActiveBand] = React.useState<BandName>('header');
    const [selectedId, setSelectedId] = React.useState<number | null>(null);
    const [selectedBand, setSelectedBand] = React.useState<BandName | null>(null);
    const [selectedCell, setSelectedCell] = React.useState<{ row: number; col: number } | null>(null);
    const [rangeEnd, setRangeEnd] = React.useState<{ row: number; col: number } | null>(null);
    const [anchorCell, setAnchorCell] = React.useState<{ row: number; col: number } | null>(null);
    const [editingCell, setEditingCell] = React.useState<{ row: number; col: number } | null>(null);
    const [saving, setSaving] = React.useState(false);
    const [editingId, setEditingId] = React.useState<number | null>(null);
    const [preview, setPreview] = React.useState(false);
    const [fieldMenu, setFieldMenu] = React.useState(false);
    const [zoom, setZoom] = React.useState(0.6);
    const [dragOver, setDragOver] = React.useState(false);
    const [overLayerId, setOverLayerId] = React.useState<number | null>(null);

    // Per-band refs for drag calculations
    const headerRef = React.useRef<HTMLDivElement>(null);
    const contentRef = React.useRef<HTMLDivElement>(null);
    const footerFlowRef = React.useRef<HTMLDivElement>(null);
    const footerFixedRef = React.useRef<HTMLDivElement>(null);
    const canvasRef = React.useRef<HTMLDivElement>(null);
    const textContentRef = React.useRef<HTMLTextAreaElement>(null);
    const fileRef = React.useRef<HTMLInputElement>(null);
    const pendingImg = React.useRef<{ x: number; y: number; band: BandName } | null>(null);
    const dragLayerId = React.useRef<number | null>(null);
    const zoomAnchor = React.useRef<{ cx: number; cy: number; clientX: number; clientY: number } | null>(null);
    const clipboard = React.useRef<BandEl | null>(null);
    const history = React.useRef<{ past: BandedLayout['bands'][]; future: BandedLayout['bands'][] }>({ past: [], future: [] });

    // nextId: computed once from initial bands
    const allInitialEls = [
        ...initialBands.header.elements,
        ...(initialBands.content.table ? [initialBands.content.table] : []),
        ...initialBands.footerFlow.elements,
        ...initialBands.footerFixed.elements,
    ];
    const nextId = React.useRef(Math.max(0, ...allInitialEls.map((e) => e.id)) + 1);

    // â”€â”€ Band element helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const getBandEls = React.useCallback((band: BandName): BandEl[] => {
        if (band === 'header') return bands.header.elements;
        if (band === 'footerFlow') return bands.footerFlow.elements;
        if (band === 'footerFixed') return bands.footerFixed.elements;
        return [];
    }, [bands]);

    const setBandEls = React.useCallback((band: BandName, els: BandEl[]) => {
        setBands((prev) => {
            if (band === 'header') return { ...prev, header: { ...prev.header, elements: els } };
            if (band === 'footerFlow') return { ...prev, footerFlow: { ...prev.footerFlow, elements: els } };
            if (band === 'footerFixed') return { ...prev, footerFixed: { ...prev.footerFixed, elements: els } };
            return prev;
        });
    }, []);

    // Find which band owns an element id
    const findElBand = React.useCallback((id: number): BandName | null => {
        if (bands.header.elements.some((e) => e.id === id)) return 'header';
        if (bands.content.table?.id === id) return 'content';
        if (bands.footerFlow.elements.some((e) => e.id === id)) return 'footerFlow';
        if (bands.footerFixed.elements.some((e) => e.id === id)) return 'footerFixed';
        return null;
    }, [bands]);

    const getBandRef = (band: BandName): React.RefObject<HTMLDivElement | null> => {
        if (band === 'header') return headerRef;
        if (band === 'content') return contentRef;
        if (band === 'footerFlow') return footerFlowRef;
        return footerFixedRef;
    };

    // Find element by id across all bands
    const findEl = React.useCallback((id: number): El | null => {
        const fromBand = [...bands.header.elements, ...bands.footerFlow.elements, ...bands.footerFixed.elements]
            .find((e) => e.id === id);
        if (fromBand) return fromBand;
        if (bands.content.table?.id === id) return bands.content.table;
        return null;
    }, [bands]);

    const selected = selectedId != null ? findEl(selectedId) : null;

    const selectedRange: { r1: number; c1: number; r2: number; c2: number } | null =
        anchorCell && rangeEnd
            ? {
                r1: Math.min(anchorCell.row, rangeEnd.row),
                c1: Math.min(anchorCell.col, rangeEnd.col),
                r2: Math.max(anchorCell.row, rangeEnd.row),
                c2: Math.max(anchorCell.col, rangeEnd.col),
            }
            : anchorCell
              ? { r1: anchorCell.row, c1: anchorCell.col, r2: anchorCell.row, c2: anchorCell.col }
              : null;

    // â”€â”€ Undo/redo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const snapshot = () =>
        setBands((prev) => {
            const h = history.current;
            h.past.push(prev);
            if (h.past.length > 100) h.past.shift();
            h.future = [];
            return prev;
        });

    const undo = () =>
        setBands((prev) => {
            const h = history.current;
            if (!h.past.length) return prev;
            h.future.push(prev);
            return h.past.pop()!;
        });

    const redo = () =>
        setBands((prev) => {
            const h = history.current;
            if (!h.future.length) return prev;
            h.past.push(prev);
            return h.future.pop()!;
        });

    // â”€â”€ Update helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const update = React.useCallback((id: number, patch: Partial<El>) => {
        const band = findElBand(id);
        if (!band) return;
        if (band === 'content') {
            setBands((prev) => ({
                ...prev,
                content: { table: prev.content.table ? { ...prev.content.table, ...patch } as TableEl : null },
            }));
            return;
        }
        setBandEls(band, getBandEls(band).map((e) => (e.id === id ? ({ ...e, ...patch } as BandEl) : e)));
    }, [findElBand, getBandEls, setBandEls]);

    const setContentTable = (patchOrNull: Partial<TableEl> | null) => {
        setBands((prev) => ({
            ...prev,
            content: {
                table: patchOrNull === null
                    ? null
                    : {
                        ...(prev.content.table ?? {
                            id: nextId.current++, type: 'table', x: 0, y: 0,
                            width: 714, columns: [], showFooterSum: false,
                        }),
                        ...patchOrNull,
                    } as TableEl,
            },
        }));
    };

    // â”€â”€ Drag in band â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const startDragInBand = (e: React.PointerEvent, el: BandEl | TableEl, bandRef: React.RefObject<HTMLDivElement | null>) => {
        e.stopPropagation();
        setSelectedId(el.id);
        const band = findElBand(el.id);
        if (band) setSelectedBand(band);
        const rect = bandRef.current!.getBoundingClientRect();
        const dx = (e.clientX - rect.left) / zoom - el.x - margins.left;
        const dy = (e.clientY - rect.top) / zoom - el.y;

        // T3.5: snap X points â€” margin edges + other elements' left/right/center
        const SNAP = 6;
        const snapXs: number[] = [margins.left, A4.w - margins.right];
        if (band && band !== 'content') {
            getBandEls(band).filter((o) => o.id !== el.id).forEach((o) => {
                const ow = (o as { width?: number }).width ?? 0;
                snapXs.push(o.x + margins.left, o.x + margins.left + ow, o.x + margins.left + ow / 2);
            });
        }
        const elW = (el as { width?: number }).width ?? 0;

        let moved = false;
        const move = (ev: PointerEvent) => {
            if (!moved) { moved = true; snapshot(); }
            let vx = (ev.clientX - rect.left) / zoom - dx;
            const vy = (ev.clientY - rect.top) / zoom - dy;
            let snapGuide: number | null = null;
            for (const sx of snapXs) {
                if (Math.abs(vx - sx) < SNAP) { vx = sx; snapGuide = sx; break; }
                if (elW > 0 && Math.abs(vx + elW - sx) < SNAP) { vx = sx - elW; snapGuide = sx; break; }
                if (elW > 0 && Math.abs(vx + elW / 2 - sx) < SNAP) { vx = sx - elW / 2; snapGuide = sx; break; }
            }
            update(el.id, { x: Math.max(0, Math.round(vx - margins.left)), y: Math.round(vy) });
            setGuides(snapGuide !== null && band ? [{ x: snapGuide, bandName: band }] : []);
        };
        const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            setGuides([]);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    const startTextResize = (e: React.PointerEvent, el: Text, axis: 'width' | 'height' | 'both', bandRef: React.RefObject<HTMLDivElement | null>) => {
        e.stopPropagation();
        const rect = bandRef.current!.getBoundingClientRect();
        const x0 = el.x; const h0 = el.height;
        let resized = false;
        const move = (ev: PointerEvent) => {
            if (!resized) { resized = true; snapshot(); }
            const patch: Partial<Text> = {};
            if (axis === 'width' || axis === 'both') patch.width = Math.max(40, Math.round((ev.clientX - rect.left) / zoom - x0 - margins.left));
            if ((axis === 'height' || axis === 'both') && h0 !== undefined) {
                patch.height = Math.max(20, Math.round((ev.clientY - rect.top) / zoom - el.y));
            }
            update(el.id, patch);
        };
        const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    const startTableResize = (e: React.PointerEvent, el: TableEl | GridEl, bandRef: React.RefObject<HTMLDivElement | null>) => {
        e.stopPropagation();
        const rect = bandRef.current!.getBoundingClientRect();
        const x0 = el.x;
        let resized = false;
        const move = (ev: PointerEvent) => {
            if (!resized) { resized = true; snapshot(); }
            update(el.id, { width: Math.max(100, Math.round((ev.clientX - rect.left) / zoom - x0 - margins.left)) });
        };
        const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    const startColResize = (e: React.PointerEvent, el: TableEl, colIdx: number) => {
        e.stopPropagation(); e.preventDefault();
        const x0 = e.clientX;
        const w0 = el.colWidths[colIdx];
        const minW = 20;
        let snapped = false;
        const onMove = (ev: PointerEvent) => {
            if (!snapped) { snapshot(); snapped = true; }
            const newW = Math.max(minW, Math.round(w0 + (ev.clientX - x0) / zoom));
            updateTrb((cur) => ({ ...cur, colWidths: cur.colWidths.map((w, i) => (i === colIdx ? newW : w)) }));
        };
        const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    const startRowResize = (e: React.PointerEvent, el: TableEl, rowIdx: number) => {
        e.stopPropagation(); e.preventDefault();
        const y0 = e.clientY;
        const row = el.rows[rowIdx];
        const defaultH = row.kind === 'body' ? TABLE_ROW_H : TABLE_HEADER_H;
        const isRepeat = row.repeat === 'items';
        const sampleCount = isRepeat ? TABLE_PLACEHOLDER_ROWS : 1;
        const h0 = (row.height ?? defaultH) * sampleCount;
        const minH = 12 * sampleCount;
        let snapped = false;
        const onMove = (ev: PointerEvent) => {
            if (!snapped) { snapshot(); snapped = true; }
            const newVisualH = Math.max(minH, Math.round(h0 + (ev.clientY - y0) / zoom));
            const newH = Math.round(newVisualH / sampleCount);
            updateTrb((cur) => ({ ...cur, rows: cur.rows.map((r, i) => (i === rowIdx ? { ...r, height: newH } : r)) }));
        };
        const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    // T4 â€” drag to resize band height
    const startBandResize = (e: React.PointerEvent, bandName: 'header' | 'footerFlow' | 'footerFixed') => {
        e.stopPropagation();
        const y0 = e.clientY;
        const h0 = bands[bandName].height;
        const sign = bandName === 'footerFixed' ? -1 : 1;
        let moved = false;
        const move = (ev: PointerEvent) => {
            if (!moved) { moved = true; snapshot(); }
            const newH = Math.max(20, Math.round(h0 + sign * (ev.clientY - y0) / zoom));
            setBands((prev) => ({ ...prev, [bandName]: { ...prev[bandName], height: newH } }));
        };
        const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    const startRectResize = (e: React.PointerEvent, el: RectEl, bandRef: React.RefObject<HTMLDivElement | null>) => {
        e.stopPropagation();
        const rect = bandRef.current!.getBoundingClientRect();
        const x0 = el.x; const y0 = el.y;
        let resized = false;
        const move = (ev: PointerEvent) => {
            if (!resized) { resized = true; snapshot(); }
            update(el.id, {
                width: Math.max(4, Math.round((ev.clientX - rect.left) / zoom - x0 - margins.left)),
                height: Math.max(4, Math.round((ev.clientY - rect.top) / zoom - y0)),
            });
        };
        const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    const startLineResize = (e: React.PointerEvent, el: LineEl, bandRef: React.RefObject<HTMLDivElement | null>) => {
        e.stopPropagation();
        const rect = bandRef.current!.getBoundingClientRect();
        const x0 = el.x; const y0 = el.y;
        let resized = false;
        const move = (ev: PointerEvent) => {
            if (!resized) { resized = true; snapshot(); }
            if (el.orientation === 'h') update(el.id, { length: Math.max(4, Math.round((ev.clientX - rect.left) / zoom - x0 - margins.left)) });
            else update(el.id, { length: Math.max(4, Math.round((ev.clientY - rect.top) / zoom - y0)) });
        };
        const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    const startImgResize = (e: React.PointerEvent, el: Img, corner: 'nw' | 'ne' | 'sw' | 'se', bandRef: React.RefObject<HTMLDivElement | null>) => {
        e.stopPropagation();
        setSelectedId(el.id);
        const rect = bandRef.current!.getBoundingClientRect();
        const w0 = el.width; const h0 = el.height ?? w0; const ratio = w0 / h0;
        const left0 = el.x + margins.left; const top0 = el.y;
        const right0 = el.x + w0 + margins.left; const bottom0 = el.y + h0;
        const west = corner === 'nw' || corner === 'sw';
        const north = corner === 'nw' || corner === 'ne';
        let resized = false;
        const move = (ev: PointerEvent) => {
            if (!resized) { resized = true; snapshot(); }
            const px = (ev.clientX - rect.left) / zoom;
            const py = (ev.clientY - rect.top) / zoom;
            let newW = Math.max(20, west ? right0 - px : px - left0);
            let newH = Math.max(20, north ? bottom0 - py : py - top0);
            if (el.lockAspect) { newH = newW / ratio; }
            const newX = west ? right0 - newW : left0;
            const newY = north ? bottom0 - newH : top0;
            update(el.id, { x: Math.round(newX - margins.left), y: Math.round(newY), width: Math.round(newW), height: Math.round(newH) });
        };
        const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    // â”€â”€ Add element helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const addText = (x = 80, y = 40, content = 'Teks baru') => {
        if (activeBand === 'content') return;
        snapshot();
        const id = nextId.current++;
        const el: BandEl = {
            id, type: 'text', x, y, content,
            fontSize: 14, bold: false, color: '#0f172a',
            fontFamily: 'Helvetica / Arial',
            italic: false, underline: false, strikethrough: false,
            align: 'left', lineHeight: 1.2, letterSpacing: 0, padding: 0, width: 200,
        };
        setBandEls(activeBand, [...getBandEls(activeBand), el]);
        setSelectedId(id);
        setSelectedBand(activeBand);
    };

    const addImage = (file: File, x = 80, y = 80, targetBand: BandName = activeBand) => {
        if (targetBand === 'content') return;
        const reader = new FileReader();
        reader.onload = () => {
            const src = reader.result as string;
            const probe = new Image();
            probe.onload = () => {
                snapshot();
                const id = nextId.current++;
                const width = 160;
                const height = Math.round(width * (probe.naturalHeight / probe.naturalWidth));
                const el: BandEl = { id, type: 'image', x, y, src, width, height, lockAspect: true };
                setBandEls(targetBand, [...getBandEls(targetBand), el]);
                setSelectedId(id);
                setSelectedBand(targetBand);
            };
            probe.src = src;
        };
        reader.readAsDataURL(file);
    };

    const addTable = () => {
        if (bands.content.table) return;
        snapshot();
        const id = nextId.current++;
        const el = makeDefaultTable(id, itemColumnCatalog, 0, 0);
        setBands((prev) => ({ ...prev, content: { table: el } }));
        setSelectedId(id);
        setSelectedBand('content');
        setActiveBand('content');
    };

    const addGrid = (x = 80, y = 40) => {
        if (activeBand === 'content') return;
        snapshot();
        const id = nextId.current++;
        const el = makeDefaultGrid(id, x, y);
        setBandEls(activeBand, [...getBandEls(activeBand), el]);
        setSelectedId(id);
        setSelectedBand(activeBand);
        setSelectedCell(null);
    };

    const addRect = (x = 80, y = 40) => {
        if (activeBand === 'content') return;
        snapshot();
        const id = nextId.current++;
        const el = makeDefaultRect(id, x, y);
        setBandEls(activeBand, [...getBandEls(activeBand), el]);
        setSelectedId(id);
        setSelectedBand(activeBand);
    };

    const addLine = (x = 80, y = 40) => {
        if (activeBand === 'content') return;
        snapshot();
        const id = nextId.current++;
        const el = makeDefaultLine(id, x, y);
        setBandEls(activeBand, [...getBandEls(activeBand), el]);
        setSelectedId(id);
        setSelectedBand(activeBand);
    };

    const setImgSize = (el: Img, dim: 'width' | 'height', v: number) => {
        if (el.lockAspect && el.height) {
            const r = el.width / el.height;
            if (dim === 'width') update(el.id, { width: v, height: Math.max(1, Math.round(v / r)) });
            else update(el.id, { width: Math.max(1, Math.round(v * r)), height: v });
        } else {
            update(el.id, dim === 'width' ? { width: v } : { height: v });
        }
    };

    const resetImage = (el: Img) => {
        const probe = new Image();
        probe.onload = () => { snapshot(); update(el.id, { width: probe.naturalWidth, height: probe.naturalHeight }); };
        probe.src = el.src;
    };

    // â”€â”€ TRB helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const updateTrb = (fn: (el: TableEl) => TableEl) => {
        setBands((prev) => {
            if (!prev.content.table) return prev;
            return { ...prev, content: { table: fn(prev.content.table) } };
        });
    };

    const updateTrbRow = (rowIdx: number, patch: Partial<TableRow>) => {
        snapshot();
        updateTrb((el) => ({ ...el, rows: el.rows.map((r, i) => (i === rowIdx ? { ...r, ...patch } : r)) }));
    };

    const updateTrbCell = (rowIdx: number, colIdx: number, patch: Partial<TableCell>) => {
        snapshot();
        updateTrb((el) => ({
            ...el,
            rows: el.rows.map((r, ri) =>
                ri === rowIdx
                    ? { ...r, cells: r.cells.map((c, ci) => (ci === colIdx ? { ...c, ...patch } : c)) }
                    : r,
            ),
        }));
    };

    const addTrbRow = () => {
        snapshot();
        updateTrb((el) => {
            const newCells: TableCell[] = el.colWidths.map(() => ({ content: '', align: 'left' as const }));
            const newRow: TableRow = { cells: newCells };
            const rows = [...el.rows];
            const insertIdx = selectedCell != null ? selectedCell.row + 1 : rows.length;
            rows.splice(insertIdx, 0, newRow);
            return { ...el, rows };
        });
    };

    const removeTrbRow = (rowIdx: number) => {
        snapshot();
        updateTrb((el) => {
            if (el.rows.length <= 1) return el;
            return { ...el, rows: el.rows.filter((_, i) => i !== rowIdx) };
        });
        if (selectedCell?.row === rowIdx) { setSelectedCell(null); setAnchorCell(null); setRangeEnd(null); }
    };

    const moveTrbRow = (rowIdx: number, dir: -1 | 1) => {
        snapshot();
        updateTrb((el) => {
            const rows = [...el.rows];
            const target = rowIdx + dir;
            if (target < 0 || target >= rows.length) return el;
            [rows[rowIdx], rows[target]] = [rows[target], rows[rowIdx]];
            return { ...el, rows };
        });
    };

    const addTrbCol = () => {
        snapshot();
        updateTrb((el) => ({
            ...el,
            width: el.width + 80,
            colWidths: [...el.colWidths, 80],
            rows: el.rows.map((r) => ({ ...r, cells: [...r.cells, { content: '', align: 'left' as const }] })),
        }));
    };

    const removeTrbCol = (colIdx: number) => {
        snapshot();
        updateTrb((el) => {
            if (el.colWidths.length <= 1) return el;
            const removed = el.colWidths[colIdx] ?? 0;
            return {
                ...el,
                width: el.width - removed,
                colWidths: el.colWidths.filter((_, i) => i !== colIdx),
                rows: el.rows.map((r) => ({ ...r, cells: r.cells.filter((_, ci) => ci !== colIdx) })),
            };
        });
    };

    const mergeTrbRange = (r1: number, c1: number, r2: number, c2: number) => {
        snapshot();
        updateTrb((el) => ({
            ...el,
            rows: el.rows.map((row, ri) => ({
                ...row,
                cells: row.cells.map((cell, ci) => {
                    if (ri === r1 && ci === c1) return { ...cell, colSpan: c2 - c1 + 1, rowSpan: r2 - r1 + 1, merged: false };
                    if (ri >= r1 && ri <= r2 && ci >= c1 && ci <= c2) return { ...cell, content: '', colSpan: 1, rowSpan: 1, merged: true };
                    return cell;
                }),
            })),
        }));
        setSelectedCell({ row: r1, col: c1 });
        setAnchorCell({ row: r1, col: c1 });
        setRangeEnd(null);
    };

    const unmergeTrbCell = (row: number, col: number) => {
        snapshot();
        updateTrb((el) => {
            const keeper = el.rows[row]?.cells[col];
            if (!keeper) return el;
            const cs = keeper.colSpan ?? 1;
            const rs = keeper.rowSpan ?? 1;
            return {
                ...el,
                rows: el.rows.map((r, ri) => ({
                    ...r,
                    cells: r.cells.map((cell, ci) => {
                        if (ri === row && ci === col) return { ...cell, colSpan: 1, rowSpan: 1, merged: false };
                        if (ri >= row && ri < row + rs && ci >= col && ci < col + cs) return { ...cell, merged: false, colSpan: 1, rowSpan: 1 };
                        return cell;
                    }),
                })),
            };
        });
    };

    const updateGridCell = (gridId: number, row: number, col: number, patch: Partial<GridCell>) => {
        const band = findElBand(gridId);
        if (!band || band === 'content') return;
        setBandEls(band, getBandEls(band).map((e) => {
            if (e.id !== gridId || e.type !== 'grid') return e;
            const cells = e.cells.map((r, ri) => r.map((c, ci) => (ri === row && ci === col ? { ...c, ...patch } : c)));
            return { ...e, cells };
        }));
    };

    const updateGrid = (gridId: number, patch: Partial<GridEl>) => {
        const band = findElBand(gridId);
        if (!band || band === 'content') return;
        setBandEls(band, getBandEls(band).map((e) => (e.id === gridId && e.type === 'grid' ? { ...e, ...patch } as GridEl : e)));
    };

    const mergeRange = (gridId: number, r1: number, c1: number, r2: number, c2: number) => {
        snapshot();
        const band = findElBand(gridId);
        if (!band || band === 'content') return;
        setBandEls(band, getBandEls(band).map((e) => {
            if (e.id !== gridId || e.type !== 'grid') return e;
            const cells = e.cells.map((row, ri) =>
                row.map((cell, ci) => {
                    if (ri === r1 && ci === c1) return { ...cell, colSpan: c2 - c1 + 1, rowSpan: r2 - r1 + 1, merged: false };
                    if (ri >= r1 && ri <= r2 && ci >= c1 && ci <= c2) return { ...cell, text: '', colSpan: 1, rowSpan: 1, merged: true };
                    return cell;
                })
            );
            return { ...e, cells };
        }));
        setAnchorCell({ row: r1, col: c1 });
        setRangeEnd({ row: r1, col: c1 });
        setSelectedCell({ row: r1, col: c1 });
    };

    const unmergeCell = (gridId: number, row: number, col: number) => {
        snapshot();
        const band = findElBand(gridId);
        if (!band || band === 'content') return;
        setBandEls(band, getBandEls(band).map((e) => {
            if (e.id !== gridId || e.type !== 'grid') return e;
            const keeper = e.cells[row]?.[col];
            if (!keeper) return e;
            const cs = keeper.colSpan ?? 1; const rs = keeper.rowSpan ?? 1;
            const cells = e.cells.map((rowCells, ri) =>
                rowCells.map((cell, ci) => {
                    if (ri === row && ci === col) return { ...cell, colSpan: 1, rowSpan: 1, merged: false };
                    if (ri >= row && ri < row + rs && ci >= col && ci < col + cs) return { ...cell, merged: false, colSpan: 1, rowSpan: 1 };
                    return cell;
                })
            );
            return { ...e, cells };
        }));
    };

    const addGridRow = (gridId: number) => {
        snapshot();
        const band = findElBand(gridId);
        if (!band || band === 'content') return;
        setBandEls(band, getBandEls(band).map((e) => {
            if (e.id !== gridId || e.type !== 'grid') return e;
            return { ...e, rows: e.rows + 1, cells: [...e.cells, Array.from({ length: e.cols }, makeGridCell)] };
        }));
    };

    const removeGridRow = (gridId: number) => {
        snapshot();
        const band = findElBand(gridId);
        if (!band || band === 'content') return;
        setBandEls(band, getBandEls(band).map((e) => {
            if (e.id !== gridId || e.type !== 'grid' || e.rows <= 1) return e;
            return { ...e, rows: e.rows - 1, cells: e.cells.slice(0, -1) };
        }));
    };

    const addGridCol = (gridId: number) => {
        snapshot();
        const band = findElBand(gridId);
        if (!band || band === 'content') return;
        setBandEls(band, getBandEls(band).map((e) => {
            if (e.id !== gridId || e.type !== 'grid') return e;
            return { ...e, cols: e.cols + 1, colWidths: [...e.colWidths, Math.floor(e.width / (e.cols + 1))], cells: e.cells.map((row) => [...row, makeGridCell()]) };
        }));
    };

    const removeGridCol = (gridId: number) => {
        snapshot();
        const band = findElBand(gridId);
        if (!band || band === 'content') return;
        setBandEls(band, getBandEls(band).map((e) => {
            if (e.id !== gridId || e.type !== 'grid' || e.cols <= 1) return e;
            return { ...e, cols: e.cols - 1, colWidths: e.colWidths.slice(0, -1), cells: e.cells.map((row) => row.slice(0, -1)) };
        }));
    };

    // â”€â”€ Remove / duplicate / move layer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const remove = (id: number) => {
        snapshot();
        const band = findElBand(id);
        if (!band) return;
        if (band === 'content') {
            setBands((prev) => ({ ...prev, content: { table: null } }));
        } else {
            setBandEls(band, getBandEls(band).filter((e) => e.id !== id));
        }
        setSelectedId(null);
        setSelectedBand(null);
        setSelectedCell(null);
        setEditingCell(null);
    };

    const duplicate = (src: BandEl) => {
        snapshot();
        const srcBand = findElBand(src.id);
        if (!srcBand || srcBand === 'content') return;
        const id = nextId.current++;
        const copy = { ...src, id, x: src.x + 20, y: src.y + 20 } as BandEl;
        setBandEls(srcBand, [...getBandEls(srcBand), copy]);
        setSelectedId(id);
        setSelectedBand(srcBand);
        clipboard.current = copy;
    };

    const moveLayer = (draggedId: number, targetId: number, band: BandName) => {
        if (draggedId === targetId) return;
        snapshot();
        const els = getBandEls(band);
        const display = [...els].reverse();
        const from = display.findIndex((e) => e.id === draggedId);
        const to = display.findIndex((e) => e.id === targetId);
        if (from < 0 || to < 0) return;
        const [moved] = display.splice(from, 1);
        display.splice(to, 0, moved);
        setBandEls(band, display.reverse());
    };

    const insertToken = (path: string) => {
        if (!selected || selected.type !== 'text') return;
        snapshot();
        const token = `{{${path}}}`;
        const ta = textContentRef.current;
        if (ta && document.activeElement === ta) {
            const s = ta.selectionStart ?? selected.content.length;
            const en = ta.selectionEnd ?? s;
            update(selected.id, { content: selected.content.slice(0, s) + token + selected.content.slice(en) });
        } else {
            update(selected.id, { content: selected.content + token });
        }
    };

    // â”€â”€ Save â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const save = () => {
        setSaving(true);
        const layout: BandedLayout = {
            paper: { margins },
            bands,
        };
        router.post(
            companyUrl(`/settings/pdf-templates/${template.id}/save`),
            { layout },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => toast.success('Template tersimpan'),
                onError: () => toast.error('Gagal menyimpan'),
                onFinish: () => setSaving(false),
            },
        );
    };

    const openPdf = () => window.open(companyUrl(`/settings/pdf-templates/${template.id}/pdf`), '_blank');

    // B5: open PDF in a new tab with a fixed item count for pagination preview.
    const openPdfWithItems = (n: number) =>
        window.open(companyUrl(`/settings/pdf-templates/${template.id}/pdf?items=${n}`), '_blank');

    // â”€â”€ Drop on band â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const dropOnBand = (e: React.DragEvent, band: BandName, bandRef: React.RefObject<HTMLDivElement | null>) => {
        e.preventDefault();
        setDragOver(false);
        if (band === 'content') return;
        const rect = bandRef.current!.getBoundingClientRect();
        const x = Math.max(0, Math.round((e.clientX - rect.left) / zoom));
        const y = Math.max(0, Math.round((e.clientY - rect.top) / zoom));
        const file = e.dataTransfer.files?.[0];
        if (file?.type.startsWith('image/')) { addImage(file, x, y, band); return; }
        const kind = e.dataTransfer.getData('kind');
        const prevActive = activeBand;
        setActiveBand(band);
        if (kind === 'text') addText(x, y);
        else if (kind === 'image') { pendingImg.current = { x, y, band }; fileRef.current?.click(); }
        else if (kind === 'table') addTable();
        else if (kind === 'grid') addGrid(x, y);
        else if (kind === 'rect') addRect(x, y);
        else if (kind === 'line') addLine(x, y);
        else setActiveBand(prevActive);
    };

    // â”€â”€ Clipboard helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const imgToPngBlob = (src: string) =>
        new Promise<Blob>((res, rej) => {
            const img = new Image();
            img.onload = () => {
                const c = document.createElement('canvas');
                c.width = img.naturalWidth; c.height = img.naturalHeight;
                c.getContext('2d')!.drawImage(img, 0, 0);
                c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob null'))), 'image/png');
            };
            img.onerror = rej; img.src = src;
        });

    const copyToOS = async (el: BandEl) => {
        try {
            if (el.type === 'text') await navigator.clipboard.writeText(el.content);
            else if (el.type === 'image') {
                const png = await imgToPngBlob(el.src);
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
            }
        } catch { /* clipboard may fail */ }
    };

    // â”€â”€ Keyboard shortcuts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    React.useEffect(() => {
        const inField = (t: EventTarget | null) =>
            t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
        const onKey = (e: KeyboardEvent) => {
            if (inField(e.target)) return;
            const mod = e.ctrlKey || e.metaKey;
            if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
            if (mod && e.key.toLowerCase() === 'c' && selected) {
                clipboard.current = selected as BandEl;
                copyToOS(selected as BandEl);
            }
            if (mod && e.key.toLowerCase() === 'd' && selected) {
                e.preventDefault();
                duplicate(selected as BandEl);
            }
            if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
                e.preventDefault();
                remove(selected.id);
            }
            if (e.key.startsWith('Arrow') && selected && selectedBand !== 'content') {
                e.preventDefault();
                const d = e.shiftKey ? 10 : 1;
                const s = selected as BandEl;
                if (e.key === 'ArrowLeft') update(s.id, { x: Math.max(0, s.x - d) });
                if (e.key === 'ArrowRight') update(s.id, { x: s.x + d });
                if (e.key === 'ArrowUp') update(s.id, { y: Math.max(0, s.y - d) });
                if (e.key === 'ArrowDown') update(s.id, { y: s.y + d });
            }
        };
        const onPaste = (e: ClipboardEvent) => {
            if (inField(e.target)) return;
            const imageItem = Array.from(e.clipboardData?.items ?? []).find((it) => it.type.startsWith('image/'));
            const file = imageItem?.getAsFile();
            const text = e.clipboardData?.getData('text');
            if (file) { e.preventDefault(); addImage(file, 100, 40); }
            else if (text) { e.preventDefault(); addText(100, 40, text); }
            else if (clipboard.current) { e.preventDefault(); duplicate(clipboard.current); }
        };
        window.addEventListener('keydown', onKey);
        window.addEventListener('paste', onPaste);
        return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('paste', onPaste); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected, activeBand, bands]);

    // â”€â”€ Zoom wheel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    React.useEffect(() => {
        const node = canvasRef.current;
        if (!node) return;
        const onWheel = (e: WheelEvent) => {
            if (!e.ctrlKey && !e.metaKey) return;
            e.preventDefault();
            const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
            const newZoom = Math.min(3, Math.max(0.2, +(zoom * factor).toFixed(3)));
            if (newZoom === zoom) return;
            zoomAnchor.current = { cx: 0, cy: 0, clientX: e.clientX, clientY: e.clientY };
            setZoom(newZoom);
        };
        node.addEventListener('wheel', onWheel, { passive: false });
        return () => node.removeEventListener('wheel', onWheel);
    }, [zoom]);

    // â”€â”€ Fit-to-width on mount â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Fire once: wait until the canvas container has a real width (rAF loop),
    // then set zoom so the A4 page fits with 24px padding on each side.
    const fitDoneRef = React.useRef(false);
    React.useEffect(() => {
        if (fitDoneRef.current) return;
        const node = canvasRef.current;
        if (!node) return;
        let rafId: number;
        const tryFit = () => {
            const w = node.clientWidth;
            if (w > 0) {
                const fitted = Math.min(Math.max((w - 48) / A4.w, 0.25), 1);
                setZoom(+fitted.toFixed(3));
                fitDoneRef.current = true;
            } else {
                rafId = requestAnimationFrame(tryFit);
            }
        };
        rafId = requestAnimationFrame(tryFit);
        return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Fix image height if missing
    React.useEffect(() => {
        const allImgs = [
            ...bands.header.elements,
            ...bands.footerFlow.elements,
            ...bands.footerFixed.elements,
        ].filter((e): e is Img => e.type === 'image' && e.height == null);
        allImgs.forEach((el) => {
            const probe = new Image();
            probe.onload = () => {
                update(el.id, { height: Math.round(el.width * (probe.naturalHeight / probe.naturalWidth)), lockAspect: (el as Img).lockAspect ?? true });
            };
            probe.src = el.src;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bands]);

    // â”€â”€ Band canvas render helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const renderBandElements = (bandName: BandName, bandRef: React.RefObject<HTMLDivElement | null>, elements: BandEl[]) => {
        return elements.map((el) => {
            const isSel = selectedId === el.id;
            const isEditing = editingId === el.id;

            if (el.type === 'grid') {
                const height = gridEditorHeight(el);
                return (
                    <div
                        key={el.id}
                        onPointerDown={(e) => {
                            if (editingCell) return;
                            startDragInBand(e, el, bandRef);
                            setSelectedCell(null);
                        }}
                        className={`absolute cursor-move ${isSel && !preview ? 'outline-2 outline-primary-500' : ''}`}
                        style={{ left: el.x + margins.left, top: el.y, width: el.width, height, touchAction: 'none' }}
                    >
                        <GridCanvas
                            el={el}
                            preview={preview}
                            resolve={resolve}
                            selectedCell={isSel ? selectedCell : null}
                            editingCell={isSel ? editingCell : null}
                            onCellPointerDown={(r, c, e) => {
                                e.stopPropagation();
                                setSelectedId(el.id);
                                setSelectedBand(bandName);
                                if (e.shiftKey && anchorCell && selectedId === el.id) {
                                    setRangeEnd({ row: r, col: c });
                                    // keep selectedCell = anchorCell so inspector stays visible
                                } else {
                                    setAnchorCell({ row: r, col: c });
                                    setRangeEnd({ row: r, col: c });
                                    setSelectedCell({ row: r, col: c });
                                }
                            }}
                            onCellDoubleClick={(r, c) => {
                                if (preview) return;
                                setSelectedId(el.id);
                                setSelectedBand(bandName);
                                setSelectedCell({ row: r, col: c });
                                setEditingCell({ row: r, col: c });
                            }}
                            onCellCommit={(r, c, text) => {
                                if (text !== el.cells[r]?.[c]?.text) { snapshot(); updateGridCell(el.id, r, c, { text }); }
                                setEditingCell(null);
                            }}
                            onCellEscape={() => setEditingCell(null)}
                            selectedRange={isSel ? selectedRange : null}
                            rangeAnchor={isSel ? anchorCell : null}
                        />
                        {isSel && !preview && (
                            <span
                                onPointerDown={(e) => startTableResize(e, el, bandRef)}
                                className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize flex items-center justify-center"
                            >
                                <span className="w-1 h-6 rounded-sm bg-primary-500 opacity-70" />
                            </span>
                        )}
                    </div>
                );
            }

            if (el.type === 'rect') {
                return (
                    <div
                        key={el.id}
                        onPointerDown={(e) => startDragInBand(e, el, bandRef)}
                        className={`absolute cursor-move ${isSel && !preview ? 'outline-2 outline-primary-500' : ''}`}
                        style={{
                            left: el.x + margins.left, top: el.y, touchAction: 'none',
                            width: el.width, height: el.height,
                            backgroundColor: el.fill ?? undefined,
                            border: el.borderWidth > 0 ? `${el.borderWidth}px solid ${el.borderColor}` : undefined,
                            borderRadius: el.borderRadius > 0 ? `${el.borderRadius}px` : undefined,
                            boxSizing: 'border-box',
                        }}
                    >
                        {isSel && !preview && (
                            <span
                                onPointerDown={(e) => startRectResize(e, el, bandRef)}
                                className="absolute right-0 bottom-0 translate-x-full translate-y-full z-10 h-2.5 w-2.5 rounded-sm border border-primary-500 bg-white cursor-nwse-resize"
                            />
                        )}
                    </div>
                );
            }

            if (el.type === 'line') {
                const lw = lineElWidth(el); const lh = lineElHeight(el);
                return (
                    <div
                        key={el.id}
                        onPointerDown={(e) => startDragInBand(e, el, bandRef)}
                        className={`absolute cursor-move ${isSel && !preview ? 'outline-2 outline-primary-500' : ''}`}
                        style={{ left: el.x + margins.left, top: el.y, touchAction: 'none', width: lw, height: lh, backgroundColor: el.color, flexShrink: 0 }}
                    >
                        {isSel && !preview && (
                            <span
                                onPointerDown={(e) => startLineResize(e, el, bandRef)}
                                className={`absolute z-10 h-2.5 w-2.5 rounded-sm border border-primary-500 bg-white ${
                                    el.orientation === 'h'
                                        ? 'right-0 top-1/2 -translate-y-1/2 translate-x-full cursor-ew-resize'
                                        : 'bottom-0 left-1/2 -translate-x-1/2 translate-y-full cursor-ns-resize'
                                }`}
                            />
                        )}
                    </div>
                );
            }

            if (el.type === 'text') {
                const hasBox = el.width !== undefined;
                const boxStyle: React.CSSProperties = hasBox ? {
                    width: el.width,
                    ...(el.height !== undefined ? { height: el.height } : {}),
                    padding: el.padding ?? 0,
                    border: (el.borderWidth && el.borderWidth > 0) ? `${el.borderWidth}px solid ${el.borderColor ?? '#000000'}` : undefined,
                    backgroundColor: el.fill ?? undefined,
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: el.valign === 'bottom' ? 'flex-end' : el.valign === 'middle' ? 'center' : 'flex-start',
                } : {};
                return (
                    <div
                        key={el.id}
                        onPointerDown={(e) => {
                            if (isEditing) { e.stopPropagation(); return; }
                            startDragInBand(e, el, bandRef);
                        }}
                        className={`absolute select-none ${isEditing ? 'cursor-text' : 'cursor-move'} ${isSel && !preview ? 'outline-2 outline-primary-500' : ''}`}
                        style={{ left: el.x + margins.left, top: el.y, touchAction: 'none', ...boxStyle }}
                    >
                        {preview ? (
                            <span style={{
                                fontSize: el.fontSize, fontWeight: el.bold ? 700 : 400,
                                color: el.color, fontFamily: fontCssStack(el.fontFamily, customFonts),
                                fontStyle: el.italic ? 'italic' : 'normal',
                                textDecoration: [el.underline ? 'underline' : '', el.strikethrough ? 'line-through' : ''].filter(Boolean).join(' ') || 'none',
                                backgroundColor: el.highlight ?? undefined,
                                textAlign: el.align ?? 'left',
                                lineHeight: el.lineHeight ?? 1.2,
                                letterSpacing: el.letterSpacing ? `${el.letterSpacing}px` : undefined,
                                ...(hasBox ? { whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: 'block', width: '100%' } : { whiteSpace: 'nowrap' }),
                            }}>
                                {resolve(el.content)}
                            </span>
                        ) : (
                            <EditableText
                                el={el}
                                editing={isEditing}
                                customFonts={customFonts}
                                onStartEdit={() => setEditingId(el.id)}
                                onCommit={(v) => {
                                    if (v !== el.content) { snapshot(); update(el.id, { content: v }); }
                                    setEditingId(null);
                                }}
                            />
                        )}
                        {isSel && !preview && hasBox && (
                            <>
                                <span
                                    onPointerDown={(e) => startTextResize(e, el, 'width', bandRef)}
                                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full z-10 h-5 w-2 cursor-ew-resize flex items-center justify-center"
                                >
                                    <span className="w-1 h-4 rounded-sm bg-primary-500 opacity-70" />
                                </span>
                                {el.height !== undefined && (
                                    <span
                                        onPointerDown={(e) => startTextResize(e, el, 'both', bandRef)}
                                        className="absolute right-0 bottom-0 translate-x-full translate-y-full z-10 h-2.5 w-2.5 rounded-sm border border-primary-500 bg-white cursor-nwse-resize"
                                    />
                                )}
                            </>
                        )}
                    </div>
                );
            }

            // image
            if (el.type === 'image') {
                return (
                    <div
                        key={el.id}
                        onPointerDown={(e) => {
                            if (isEditing) { e.stopPropagation(); return; }
                            startDragInBand(e, el, bandRef);
                        }}
                        className={`absolute select-none cursor-move ${isSel && !preview ? 'outline-2 outline-primary-500' : ''}`}
                        style={{ left: el.x + margins.left, top: el.y, touchAction: 'none', width: el.width, height: el.height }}
                    >
                        <div style={{
                            width: '100%', height: '100%',
                            opacity: el.opacity !== undefined ? el.opacity / 100 : undefined,
                            border: (el.borderWidth && el.borderWidth > 0) ? `${el.borderWidth}px solid ${el.borderColor ?? '#000000'}` : undefined,
                            borderRadius: el.borderRadius ? `${el.borderRadius}px` : undefined,
                            overflow: 'hidden', boxSizing: 'border-box',
                        }}>
                            <img src={el.src} alt="" draggable={false} style={{ width: '100%', height: '100%', maxWidth: 'none' }} className="pointer-events-none block" />
                        </div>
                        {isSel && !preview && (['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
                            <span
                                key={corner}
                                onPointerDown={(e) => startImgResize(e, el, corner, bandRef)}
                                className={`absolute z-10 h-2.5 w-2.5 rounded-sm border border-primary-500 bg-white ${
                                    corner === 'nw' ? 'left-0 top-0 -translate-x-full -translate-y-full cursor-nwse-resize'
                                    : corner === 'ne' ? 'right-0 top-0 translate-x-full -translate-y-full cursor-nesw-resize'
                                    : corner === 'sw' ? 'left-0 bottom-0 -translate-x-full translate-y-full cursor-nesw-resize'
                                    : 'right-0 bottom-0 translate-x-full translate-y-full cursor-nwse-resize'
                                }`}
                            />
                        ))}
                    </div>
                );
            }

            return null;
        });
    };

    // â”€â”€ Band subtitles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const bandSubtitle: Record<BandName, string> = {
        header: bands.header.repeat ? 'Tiap halaman' : 'Halaman pertama',
        content: 'Dinamis â‡•',
        footerFlow: 'Setelah konten',
        footerFixed: 'Tiap halaman',
    };

    // â”€â”€ Layer groups for left panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const layerGroups: { band: BandName; els: (BandEl | TableEl)[] }[] = [
        { band: 'header', els: [...bands.header.elements].reverse() },
        { band: 'content', els: bands.content.table ? [bands.content.table] : [] },
        { band: 'footerFlow', els: [...bands.footerFlow.elements].reverse() },
        { band: 'footerFixed', els: [...bands.footerFixed.elements].reverse() },
    ];

    const totalElCount = bands.header.elements.length
        + (bands.content.table ? 1 : 0)
        + bands.footerFlow.elements.length
        + bands.footerFixed.elements.length;

    const tableEl = bands.content.table;

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            {/* â”€â”€ Top header bar â”€â”€ */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-secondary-200 dark:border-dark-600 bg-white dark:bg-dark-900 shrink-0">
                {/* Left: back + title */}
                <Button variant="ghost" size="sm" onClick={() => router.visit(companyUrl('/settings/pdf-templates'))} className="gap-1.5 text-dark-500 dark:text-dark-400 hover:text-dark-900 dark:hover:text-dark-50 shrink-0">
                    <ArrowLeft className="w-4 h-4" />
                    Kembali
                </Button>
                <div className="w-px h-5 bg-secondary-200 dark:bg-dark-600 shrink-0" />
                <span className="text-sm font-semibold text-dark-900 dark:text-dark-100 truncate min-w-0 flex-1">{template.name}</span>
                <span className="text-[11px] font-medium text-dark-400 dark:text-dark-500 shrink-0 hidden md:inline">Banded</span>

                {/* Right: document actions */}
                <div className="flex items-center gap-0.5 shrink-0 ml-2">
                    {/* Undo / Redo */}
                    <Button variant="ghost" size="icon" onClick={() => undo()} title="Undo (Ctrl+Z)" className="w-7 h-7">
                        <Undo2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => redo()} title="Redo (Ctrl+Shift+Z)" className="w-7 h-7">
                        <Redo2 className="w-3.5 h-3.5" />
                    </Button>

                    <div className="w-px h-5 bg-secondary-200 dark:bg-dark-600 mx-1 shrink-0" />

                    {/* Zoom controls */}
                    <Button variant="ghost" size="icon" onClick={() => setZoom((z) => Math.max(0.2, +(z - 0.1).toFixed(2)))} className="w-7 h-7" title="Perkecil">
                        <ZoomOut className="w-3.5 h-3.5" />
                    </Button>
                    <button
                        onClick={() => {
                            const node = canvasRef.current;
                            if (!node) return;
                            const w = node.clientWidth;
                            if (w > 0) setZoom(+Math.min(Math.max((w - 48) / A4.w, 0.25), 1).toFixed(3));
                        }}
                        className="text-[11px] tabular-nums font-medium text-dark-500 dark:text-dark-400 w-10 text-center select-none hover:text-dark-900 dark:hover:text-dark-50 transition-colors duration-150"
                        title="Klik untuk fit lebar"
                    >
                        {Math.round(zoom * 100)}%
                    </button>
                    <Button variant="ghost" size="icon" onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))} className="w-7 h-7" title="Perbesar">
                        <ZoomIn className="w-3.5 h-3.5" />
                    </Button>

                    <div className="w-px h-5 bg-secondary-200 dark:bg-dark-600 mx-1 shrink-0" />

                    {/* Preview toggle */}
                    <Button
                        variant={preview ? 'primary' : 'ghost'}
                        size="sm"
                        className="gap-1 text-xs"
                        onClick={() => { setPreview((p) => !p); setEditingId(null); }}
                    >
                        {preview ? <Pencil className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline">{preview ? 'Edit' : 'Preview'}</span>
                    </Button>

                    <div className="w-px h-5 bg-secondary-200 dark:bg-dark-600 mx-1 shrink-0" />

                    {/* Pratinjau N-item dropdown â€” catalog DropdownMenu */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1 text-xs text-dark-600 dark:text-dark-300"
                                title="Pratinjau PDF dengan N item"
                            >
                                <FileDown className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Pratinjau</span>
                                <ChevronDown className="w-3 h-3 opacity-60" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[148px]">
                            <DropdownMenuLabel>Jumlah item</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {([3, 10, 25, 60] as const).map((n) => (
                                <DropdownMenuItem
                                    key={n}
                                    onClick={() => openPdfWithItems(n)}
                                    className="flex items-center justify-between gap-3"
                                >
                                    <span className="font-medium">{n} item</span>
                                    <span className="text-[10px] text-dark-400 dark:text-dark-500 tabular-nums">
                                        {n <= 5 ? '1 hal.' : n <= 20 ? '~2 hal.' : n <= 40 ? '~3 hal.' : '~5 hal.'}
                                    </span>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* PDF â€” quick export */}
                    <Button variant="ghost" size="sm" onClick={openPdf} className="gap-1 text-xs text-dark-600 dark:text-dark-300" title="Cetak PDF (data contoh)">
                        <Eye className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">PDF</span>
                    </Button>

                    <div className="w-px h-5 bg-secondary-200 dark:bg-dark-600 mx-1 shrink-0" />

                    {/* Save â€” primary CTA */}
                    <Button variant="primary" size="sm" onClick={save} disabled={saving} className="gap-1.5 text-xs font-semibold">
                        <Save className="w-3.5 h-3.5" />
                        {saving ? 'Menyimpanâ€¦' : 'Simpan'}
                    </Button>
                </div>
            </div>

            {/* 3-column editor */}
            <div className="flex flex-1 overflow-hidden">

                {/* â”€â”€ KIRI: Layers â”€â”€ */}
                <aside className="w-52 shrink-0 border-r border-secondary-200 dark:border-dark-600 flex flex-col bg-white dark:bg-dark-900">
                    <PanelHeader title="Layers" meta={totalElCount ? String(totalElCount) : undefined} />
                    <div className="flex-1 overflow-auto p-2 space-y-0.5">
                        {totalElCount === 0 && (
                            <div className="px-3 py-6 text-center">
                                <Layers className="w-6 h-6 mx-auto mb-2 text-dark-300 dark:text-dark-600" />
                                <p className="text-xs text-dark-400 dark:text-dark-500 leading-relaxed">Belum ada elemen.<br />Seret dari toolbar.</p>
                            </div>
                        )}
                        {layerGroups.map(({ band, els }) => (
                            els.length > 0 && (
                                <div key={band} className="pb-1">
                                    {/* Band group header */}
                                    <div className="flex items-center gap-1.5 px-2 py-1.5 mt-1">
                                        <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                                            band === 'header' ? 'bg-blue-400' :
                                            band === 'content' ? 'bg-emerald-400' :
                                            band === 'footerFlow' ? 'bg-amber-400' : 'bg-purple-400'
                                        }`} />
                                        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-dark-400 dark:text-dark-500">
                                            {bandLabel(band)}
                                        </span>
                                    </div>
                                    {/* Layer rows */}
                                    <div className="space-y-0.5 pl-1">
                                        {els.map((el) => {
                                            const active = selectedId === el.id;
                                            const isOver = overLayerId === el.id;
                                            return (
                                                <div
                                                    key={el.id}
                                                    draggable={band !== 'content'}
                                                    onClick={() => { setSelectedId(el.id); setSelectedBand(band); setActiveBand(band); }}
                                                    onDragStart={(ev) => {
                                                        dragLayerId.current = el.id;
                                                        ev.dataTransfer.effectAllowed = 'move';
                                                        ev.stopPropagation();
                                                    }}
                                                    onDragOver={(ev) => {
                                                        ev.preventDefault();
                                                        if (dragLayerId.current != null && overLayerId !== el.id) setOverLayerId(el.id);
                                                    }}
                                                    onDrop={(ev) => {
                                                        ev.preventDefault(); ev.stopPropagation();
                                                        if (dragLayerId.current != null) moveLayer(dragLayerId.current, el.id, band);
                                                        dragLayerId.current = null; setOverLayerId(null);
                                                    }}
                                                    onDragEnd={() => { dragLayerId.current = null; setOverLayerId(null); }}
                                                    className={`group flex items-center gap-1.5 rounded-lg pl-1.5 pr-1 py-1.5 transition-colors duration-150 ${
                                                        active
                                                            ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-200'
                                                            : 'text-dark-700 dark:text-dark-300 hover:bg-zinc-50 dark:hover:bg-dark-700'
                                                    } ${isOver ? 'ring-1 ring-primary-400/60 ring-inset' : ''}`}
                                                >
                                                    <GripVertical className="w-3 h-3 shrink-0 text-dark-300 dark:text-dark-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    <span className={`grid place-items-center h-5 w-5 rounded-md shrink-0 transition-colors ${
                                                        active
                                                            ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300'
                                                            : 'bg-zinc-100 dark:bg-dark-700 text-dark-400 dark:text-dark-500 group-hover:bg-zinc-200 dark:group-hover:bg-dark-600'
                                                    }`}>
                                                        {el.type === 'text' ? <Type className="w-3 h-3" />
                                                            : el.type === 'image' ? <ImageIcon className="w-3 h-3" />
                                                            : el.type === 'grid' ? <LayoutGrid className="w-3 h-3" />
                                                            : el.type === 'rect' ? <RectIcon className="w-3 h-3" />
                                                            : el.type === 'line' ? <LineIcon className="w-3 h-3" />
                                                            : <Table2 className="w-3 h-3" />}
                                                    </span>
                                                    <span className={`flex-1 truncate text-xs font-medium ${active ? 'text-primary-700 dark:text-primary-200' : 'text-dark-700 dark:text-dark-300'}`}>
                                                        {el.type === 'text' ? (el.content.length > 18 ? el.content.slice(0, 18) + 'â€¦' : el.content || '(kosong)')
                                                            : el.type === 'image' ? 'Gambar'
                                                            : el.type === 'grid' ? `Grid ${(el as GridEl).rows}Ã—${(el as GridEl).cols}`
                                                            : el.type === 'rect' ? 'Kotak'
                                                            : el.type === 'line' ? 'Garis'
                                                            : 'Tabel Item'}
                                                    </span>
                                                    <button
                                                        onClick={(ev) => { ev.stopPropagation(); remove(el.id); }}
                                                        className="grid place-items-center h-5 w-5 rounded-md text-dark-300 dark:text-dark-600 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-all duration-150"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )
                        ))}
                    </div>
                </aside>

                {/* â”€â”€ TENGAH: Kanvas â”€â”€ */}
                <div className="relative flex-1 overflow-hidden">
                    <div ref={canvasRef} className="absolute inset-0 overflow-auto" style={{ backgroundColor: '#1a1a1d' }}>
                        <div className="min-h-full flex items-start justify-center py-10 px-10">
                            {/* Outer sizing wrapper â€” exact A4 footprint at current zoom */}
                            <div style={{ width: A4.w * zoom, height: A4.h * zoom, flexShrink: 0 }}>
                                {/* â”€â”€ A4 PAPER SHEET â€” true portrait 793Ã—1123px â”€â”€ */}
                                <div
                                    className={`relative bg-white shadow-xl ${dragOver ? 'ring-2 ring-primary-400' : ''}`}
                                    style={{
                                        width: A4.w,
                                        height: A4.h,
                                        transform: `scale(${zoom})`,
                                        transformOrigin: 'top left',
                                        overflow: 'hidden',
                                    }}
                                >
                                    {/* â”€â”€ MARGIN GUIDE â€” dashed rect showing printable area â”€â”€ */}
                                    <div
                                        aria-hidden
                                        className="absolute pointer-events-none z-[100]"
                                        style={{
                                            top: margins.top,
                                            left: margins.left,
                                            width: A4.w - margins.left - margins.right,
                                            bottom: margins.bottom,
                                            border: '1.5px dashed rgba(99,102,241,0.30)',
                                        }}
                                    />

                                    {/* â”€â”€ FLOWING BANDS: Header â†’ Content â†’ FooterFlow â”€â”€ */}
                                    {/* These stack top-to-bottom inside the top margin area */}

                                    {/* â”€â”€ HEADER BAND â”€â”€ */}
                                    <div
                                        ref={headerRef}
                                        className={`relative transition-shadow duration-150 ${
                                            activeBand === 'header'
                                                ? 'ring-2 ring-inset ring-blue-400/50 bg-blue-50/20 dark:bg-blue-900/5'
                                                : ''
                                        }`}
                                        style={{
                                            width: A4.w,
                                            height: bands.header.height,
                                            overflow: 'visible',
                                            borderBottom: activeBand === 'header'
                                                ? '2px solid rgba(96,165,250,0.5)'
                                                : '1px solid rgba(226,232,240,0.8)',
                                        }}
                                        onPointerDown={() => { setActiveBand('header'); setSelectedId(null); setSelectedBand(null); }}
                                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragOver(true); }}
                                        onDragLeave={() => setDragOver(false)}
                                        onDrop={(e) => dropOnBand(e, 'header', headerRef)}
                                    >
                                        {/* Band label â€” top-left corner tab */}
                                        <div className="absolute top-1 left-1 flex items-center gap-1 pointer-events-none z-10">
                                            <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-300 dark:text-dark-600">HEADER</span>
                                            <Badge variant="blue" size="sm" className="text-[9px] leading-none py-0.5 px-1.5">{bandSubtitle.header}</Badge>
                                        </div>
                                        {renderBandElements('header', headerRef, bands.header.elements)}
                                        {/* T3.5 snap guides */}
                                        {guides.filter((g) => g.bandName === 'header').map((g, i) => (
                                            <div key={i} className="absolute top-0 bottom-0 pointer-events-none z-40" style={{ left: g.x, width: 1, backgroundColor: 'rgba(59,130,246,0.8)' }} />
                                        ))}
                                        {/* T4 band resize handle */}
                                        {!preview && (
                                            <div onPointerDown={(e) => startBandResize(e, 'header')}
                                                className="absolute bottom-0 left-0 right-0 z-30 h-[6px] cursor-ns-resize group flex items-end">
                                                <div className="w-full h-[2px] bg-transparent group-hover:bg-blue-400/60 transition-colors" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Band separator */}
                                    <div className="flex items-center w-full" style={{ height: 16 }}>
                                        <div className="flex-1 border-t border-dashed border-slate-200/70 dark:border-dark-700/70" />
                                        <span className="mx-2 shrink-0 text-[8px] font-medium tracking-widest uppercase text-slate-300 dark:text-dark-600 select-none">Konten</span>
                                        <div className="flex-1 border-t border-dashed border-slate-200/70 dark:border-dark-700/70" />
                                    </div>

                                    {/* â”€â”€ CONTENT BAND â”€â”€ */}
                                    <div
                                        ref={contentRef}
                                        className={`relative transition-shadow duration-150 ${
                                            activeBand === 'content'
                                                ? 'ring-2 ring-inset ring-emerald-400/50 bg-emerald-50/20 dark:bg-emerald-900/5'
                                                : ''
                                        }`}
                                        style={{
                                            width: A4.w,
                                            minHeight: 80,
                                            overflow: 'visible',
                                            borderBottom: activeBand === 'content'
                                                ? '2px solid rgba(52,211,153,0.5)'
                                                : '1px solid rgba(226,232,240,0.8)',
                                        }}
                                        onPointerDown={() => { setActiveBand('content'); if (!tableEl) { setSelectedId(null); setSelectedBand(null); } }}
                                    >
                                        {/* Band label */}
                                        <div className="absolute top-1 left-1 flex items-center gap-1 pointer-events-none z-10">
                                            <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-300 dark:text-dark-600">KONTEN</span>
                                            <Badge variant="emerald" size="sm" className="text-[9px] leading-none py-0.5 px-1.5">{bandSubtitle.content}</Badge>
                                        </div>
                                        {tableEl ? (() => {
                                            const isSel = selectedId === tableEl.id;
                                            const height = preview ? tablePreviewHeight(tableEl, sampleItems) : tableEditorHeight(tableEl);
                                            const rows = preview ? sampleItems : null;

                                            // Column resize handle x positions (all borders except rightmost)
                                            const colXs: number[] = [];
                                            let cx = 0;
                                            tableEl.colWidths.forEach((w, i) => {
                                                cx += w;
                                                if (i < tableEl.colWidths.length - 1) colXs.push(cx);
                                            });

                                            // Row resize handle y positions (bottom of each row)
                                            const rowYs: number[] = [];
                                            let ry = 0;
                                            tableEl.rows.forEach((row, i) => {
                                                ry += rowVisualH(row, TABLE_PLACEHOLDER_ROWS);
                                                rowYs.push({ y: ry, rowIdx: i });
                                            });

                                            return (
                                                <div
                                                    onPointerDown={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedId(tableEl.id);
                                                        setSelectedBand('content');
                                                        setActiveBand('content');
                                                    }}
                                                    className={`absolute ${isSel && !preview ? 'outline outline-2 outline-primary-500' : ''}`}
                                                    style={{ left: tableEl.x + margins.left, top: 22, width: tableEl.width, height, touchAction: 'none' }}
                                                >
                                                    <TablePreview
                                                        el={tableEl}
                                                        rows={rows}
                                                        selectedCell={isSel ? selectedCell : null}
                                                        tableSelRange={isSel ? selectedRange : null}
                                                        onCellPointerDown={isSel && !preview ? (ri, ci, e) => {
                                                            e.stopPropagation();
                                                            if (e.shiftKey && anchorCell) {
                                                                setRangeEnd({ row: ri, col: ci });
                                                            } else {
                                                                setAnchorCell({ row: ri, col: ci });
                                                                setRangeEnd(null);
                                                                setSelectedCell({ row: ri, col: ci });
                                                            }
                                                        } : undefined}
                                                    />
                                                    {/* Column resize handles */}
                                                    {isSel && !preview && colXs.map((x, i) => (
                                                        <span
                                                            key={i}
                                                            onPointerDown={(e) => startColResize(e, tableEl, i)}
                                                            className="absolute top-0 bottom-0 z-20 flex items-center justify-center group"
                                                            style={{ left: x - 4, width: 8, cursor: 'col-resize' }}
                                                        >
                                                            <span className="w-px h-full bg-transparent group-hover:bg-primary-400/80 transition-colors" />
                                                        </span>
                                                    ))}
                                                    {/* Row resize handles */}
                                                    {isSel && !preview && rowYs.map(({ y, rowIdx }) => (
                                                        <span
                                                            key={rowIdx}
                                                            onPointerDown={(e) => startRowResize(e, tableEl, rowIdx)}
                                                            className="absolute left-0 right-0 z-20 group"
                                                            style={{ top: y - 4, height: 8, cursor: 'row-resize' }}
                                                        >
                                                            <span className="absolute inset-x-0 top-1/2 h-px bg-transparent group-hover:bg-primary-400/80 transition-colors" />
                                                        </span>
                                                    ))}
                                                    {/* Right-edge table width resize */}
                                                    {isSel && !preview && (
                                                        <span
                                                            onPointerDown={(e) => startTableResize(e, tableEl, contentRef)}
                                                            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize flex items-center justify-center"
                                                        >
                                                            <span className="w-1 h-6 rounded-sm bg-primary-500 opacity-70" />
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })() : (
                                            <div className="flex items-center justify-center" style={{ paddingTop: 30, paddingBottom: 20, minHeight: 80 }}>
                                                <button
                                                    onClick={() => { setActiveBand('content'); addTable(); }}
                                                    className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed border-slate-200 dark:border-dark-600 text-sm text-slate-400 dark:text-dark-500 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-150"
                                                >
                                                    <Table2 className="w-4 h-4" />
                                                    + Tabel Item
                                                </button>
                                            </div>
                                        )}
                                        {/* Spacer below table */}
                                        {tableEl && <div style={{ height: tableEditorHeight(tableEl) + 22 + 16 }} />}
                                    </div>

                                    {/* Band separator */}
                                    <div className="flex items-center w-full" style={{ height: 16 }}>
                                        <div className="flex-1 border-t border-dashed border-slate-200/70 dark:border-dark-700/70" />
                                        <span className="mx-2 shrink-0 text-[8px] font-medium tracking-widest uppercase text-slate-300 dark:text-dark-600 select-none">Footer Flow</span>
                                        <div className="flex-1 border-t border-dashed border-slate-200/70 dark:border-dark-700/70" />
                                    </div>

                                    {/* â”€â”€ FOOTER FLOW BAND â”€â”€ */}
                                    <div
                                        ref={footerFlowRef}
                                        className={`relative transition-shadow duration-150 ${
                                            activeBand === 'footerFlow'
                                                ? 'ring-2 ring-inset ring-amber-400/50 bg-amber-50/20 dark:bg-amber-900/5'
                                                : ''
                                        }`}
                                        style={{
                                            width: A4.w,
                                            height: bands.footerFlow.height,
                                            overflow: 'visible',
                                            borderBottom: activeBand === 'footerFlow'
                                                ? '2px solid rgba(251,191,36,0.5)'
                                                : '1px solid rgba(226,232,240,0.8)',
                                        }}
                                        onPointerDown={() => { setActiveBand('footerFlow'); setSelectedId(null); setSelectedBand(null); }}
                                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragOver(true); }}
                                        onDragLeave={() => setDragOver(false)}
                                        onDrop={(e) => dropOnBand(e, 'footerFlow', footerFlowRef)}
                                    >
                                        {/* Band label */}
                                        <div className="absolute top-1 left-1 flex items-center gap-1 pointer-events-none z-10">
                                            <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-300 dark:text-dark-600">FOOTER FLOW</span>
                                            <Badge variant="orange" size="sm" className="text-[9px] leading-none py-0.5 px-1.5">{bandSubtitle.footerFlow}</Badge>
                                        </div>
                                        {renderBandElements('footerFlow', footerFlowRef, bands.footerFlow.elements)}
                                        {guides.filter((g) => g.bandName === 'footerFlow').map((g, i) => (
                                            <div key={i} className="absolute top-0 bottom-0 pointer-events-none z-40" style={{ left: g.x, width: 1, backgroundColor: 'rgba(59,130,246,0.8)' }} />
                                        ))}
                                        {!preview && (
                                            <div onPointerDown={(e) => startBandResize(e, 'footerFlow')}
                                                className="absolute bottom-0 left-0 right-0 z-30 h-[6px] cursor-ns-resize group flex items-end">
                                                <div className="w-full h-[2px] bg-transparent group-hover:bg-amber-400/60 transition-colors" />
                                            </div>
                                        )}
                                    </div>

                                    {/* â”€â”€ FOOTER FIXED BAND â€” pinned to bottom of A4 page â”€â”€ */}
                                    {/* position: absolute so it always sits just above the bottom margin, */}
                                    {/* regardless of how tall the flowing bands above are.             */}
                                    <div
                                        ref={footerFixedRef}
                                        className={`absolute transition-shadow duration-150 ${
                                            activeBand === 'footerFixed'
                                                ? 'ring-2 ring-inset ring-purple-400/50 bg-purple-50/20 dark:bg-purple-900/5'
                                                : ''
                                        }`}
                                        style={{
                                            left: 0,
                                            right: 0,
                                            bottom: margins.bottom,
                                            height: bands.footerFixed.height,
                                            overflow: 'visible',
                                            borderTop: activeBand === 'footerFixed'
                                                ? '2px solid rgba(192,132,252,0.5)'
                                                : '1px dashed rgba(200,200,220,0.6)',
                                            zIndex: 20,
                                            backgroundColor: activeBand === 'footerFixed'
                                                ? undefined
                                                : 'rgba(250,250,255,0.6)',
                                        }}
                                        onPointerDown={() => { setActiveBand('footerFixed'); setSelectedId(null); setSelectedBand(null); }}
                                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragOver(true); }}
                                        onDragLeave={() => setDragOver(false)}
                                        onDrop={(e) => dropOnBand(e, 'footerFixed', footerFixedRef)}
                                    >
                                        {/* Band label â€” shown at top-left of the fixed footer */}
                                        <div className="absolute top-1 left-1 flex items-center gap-1 pointer-events-none z-10">
                                            <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-300 dark:text-dark-600">FOOTER TETAP</span>
                                            <Badge variant="purple" size="sm" className="text-[9px] leading-none py-0.5 px-1.5">{bandSubtitle.footerFixed}</Badge>
                                        </div>
                                        {renderBandElements('footerFixed', footerFixedRef, bands.footerFixed.elements)}
                                        {guides.filter((g) => g.bandName === 'footerFixed').map((g, i) => (
                                            <div key={i} className="absolute top-0 bottom-0 pointer-events-none z-40" style={{ left: g.x, width: 1, backgroundColor: 'rgba(59,130,246,0.8)' }} />
                                        ))}
                                        {!preview && (
                                            <div onPointerDown={(e) => startBandResize(e, 'footerFixed')}
                                                className="absolute top-0 left-0 right-0 z-30 h-[6px] cursor-ns-resize group flex items-start">
                                                <div className="w-full h-[2px] bg-transparent group-hover:bg-purple-400/60 transition-colors" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                        {/* â”€â”€ Active-band indicator â€” canvas overlay (top-left) â”€â”€ */}
                    <div className="absolute top-3 left-3 z-20 pointer-events-none">
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-dark-900/80 dark:bg-dark-800/90 backdrop-blur-sm border border-white/10 shadow-lg">
                            <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                                activeBand === 'header' ? 'bg-blue-400' :
                                activeBand === 'content' ? 'bg-emerald-400' :
                                activeBand === 'footerFlow' ? 'bg-amber-400' : 'bg-purple-400'
                            }`} />
                            <span className="text-[10px] font-semibold text-white/80 tracking-wide">{bandLabel(activeBand)}</span>
                        </div>
                    </div>

                    {/* â”€â”€ FLOATING ELEMENT-INSERT TOOLBAR â”€â”€ */}
                    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-0.5 p-1.5 rounded-xl bg-white dark:bg-dark-700 border border-secondary-200 dark:border-dark-600 shadow-lg">
                        <div draggable onDragStart={(e) => { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('kind', 'text'); }}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-dark-600 dark:text-dark-300 hover:text-dark-900 dark:hover:text-dark-50" onClick={() => addText()} disabled={activeBand === 'content'} title="Teks â€” klik tambah / seret ke band">
                                <Type className="w-4 h-4" />
                            </Button>
                        </div>
                        <div draggable onDragStart={(e) => { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('kind', 'image'); }}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-dark-600 dark:text-dark-300 hover:text-dark-900 dark:hover:text-dark-50" onClick={() => fileRef.current?.click()} disabled={activeBand === 'content'} title="Gambar">
                                <ImageIcon className="w-4 h-4" />
                            </Button>
                        </div>
                        <div draggable onDragStart={(e) => { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('kind', 'grid'); }}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-dark-600 dark:text-dark-300 hover:text-dark-900 dark:hover:text-dark-50" onClick={() => addGrid()} disabled={activeBand === 'content'} title="Grid statis">
                                <LayoutGrid className="w-4 h-4" />
                            </Button>
                        </div>
                        <div draggable onDragStart={(e) => { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('kind', 'rect'); }}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-dark-600 dark:text-dark-300 hover:text-dark-900 dark:hover:text-dark-50" onClick={() => addRect()} disabled={activeBand === 'content'} title="Kotak">
                                <RectIcon className="w-4 h-4" />
                            </Button>
                        </div>
                        <div draggable onDragStart={(e) => { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('kind', 'line'); }}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-dark-600 dark:text-dark-300 hover:text-dark-900 dark:hover:text-dark-50" onClick={() => addLine()} disabled={activeBand === 'content'} title="Garis">
                                <LineIcon className="w-4 h-4" />
                            </Button>
                        </div>
                        <div className="w-px h-6 bg-secondary-200 dark:bg-dark-600 mx-1" />
                        <div draggable onDragStart={(e) => { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('kind', 'table'); }}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-dark-600 dark:text-dark-300 hover:text-dark-900 dark:hover:text-dark-50" onClick={() => addTable()} disabled={!!bands.content.table} title={bands.content.table ? 'Tabel sudah ada' : 'Tabel item (band Konten)'}>
                                <Table2 className="w-4 h-4" />
                            </Button>
                        </div>
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
                                addImage(file, p?.x, p?.y, p?.band ?? activeBand);
                            }
                            e.target.value = '';
                        }}
                    />
                </div>

                {/* â”€â”€ KANAN: Inspector â”€â”€ */}
                <aside className="w-72 shrink-0 border-l border-secondary-200 dark:border-dark-600 flex flex-col bg-white dark:bg-dark-900">
                    <PanelHeader
                        title={
                            selected
                                ? selected.type === 'text' ? 'Teks'
                                    : selected.type === 'image' ? 'Gambar'
                                    : selected.type === 'grid' ? 'Grid'
                                    : selected.type === 'rect' ? 'Kotak'
                                    : selected.type === 'line' ? 'Garis'
                                    : 'Tabel Item'
                                : 'Properti'
                        }
                        meta={selected ? undefined : 'Halaman'}
                    />

                    {!selected ? (
                        <div className="flex-1 overflow-auto px-3 py-3 space-y-3">
                            <p className="text-[11px] text-dark-400 dark:text-dark-500 leading-relaxed">
                                Klik elemen di kanvas untuk memilihnya. Atur margin halaman dan tinggi band di bawah.
                            </p>
                            <MarginSettingsPanel
                                margins={margins}
                                onChangeMargins={(m) => setMargins(m)}
                            />
                            <BandSettingsPanel
                                bands={bands}
                                onChangeBands={(patch) => { snapshot(); setBands((prev) => ({ ...prev, ...patch })); }}
                            />
                        </div>
                    ) : (
                        <div
                            className="flex-1 overflow-auto px-3"
                            onFocusCapture={(e) => {
                                const t = e.target as HTMLElement;
                                if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') snapshot();
                            }}
                        >
                            {selected.type === 'text' && (
                                <TextInspector
                                    el={selected as Text}
                                    contentRef={textContentRef}
                                    tokenCatalog={tokenCatalog}
                                    sampleData={sampleData}
                                    fieldMenu={fieldMenu}
                                    setFieldMenu={setFieldMenu}
                                    onInsertToken={insertToken}
                                    onUpdate={(patch) => update(selected.id, patch)}
                                    onSnapshot={snapshot}
                                    customFonts={customFonts}
                                />
                            )}

                            {selected.type === 'image' && (
                                <>
                                    <Section title="Ukuran">
                                        <Row label="Lebar">
                                            <NumField value={selected.width} onChange={(v) => setImgSize(selected as Img, 'width', v)} />
                                        </Row>
                                        <Row label="Tinggi">
                                            <NumField value={Math.round((selected as Img).height ?? 0)} onChange={(v) => setImgSize(selected as Img, 'height', v)} />
                                        </Row>
                                        <Row label="Rasio">
                                            <button
                                                onClick={() => { snapshot(); update(selected.id, { lockAspect: !(selected as Img).lockAspect }); }}
                                                className={`flex items-center gap-2 h-8 w-full rounded-lg border px-2.5 text-sm transition-colors ${
                                                    (selected as Img).lockAspect
                                                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                                                        : 'border-secondary-200 dark:border-dark-600 text-dark-500 dark:text-dark-400 hover:bg-zinc-50 dark:hover:bg-dark-700'
                                                }`}
                                            >
                                                {(selected as Img).lockAspect ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                                {(selected as Img).lockAspect ? 'Terkunci' : 'Bebas'}
                                            </button>
                                        </Row>
                                        <Button variant="zinc" size="sm" className="w-full" onClick={() => resetImage(selected as Img)}>
                                            <RotateCcw className="w-4 h-4" /> Reset ke ukuran asli
                                        </Button>
                                        <Button variant="zinc" size="sm" className="w-full" onClick={() => fileRef.current?.click()}>
                                            <ImageIcon className="w-4 h-4" /> Ganti gambar
                                        </Button>
                                    </Section>
                                    <Section title="Tampilan">
                                        <Row label="Opasitas">
                                            <Slider
                                                value={(selected as Img).opacity ?? 100}
                                                onChange={(v) => update(selected.id, { opacity: v })}
                                                min={0}
                                                max={100}
                                                step={1}
                                                suffix="%"
                                            />
                                        </Row>
                                        <Row label="Radius">
                                            <NumField value={(selected as Img).borderRadius ?? 0} onChange={(v) => update(selected.id, { borderRadius: Math.max(0, v) })} unit="px" />
                                        </Row>
                                        <Row label="Border">
                                            <NumField value={(selected as Img).borderWidth ?? 0} onChange={(v) => update(selected.id, { borderWidth: Math.max(0, v) })} unit="px" />
                                        </Row>
                                        {((selected as Img).borderWidth ?? 0) > 0 && (
                                            <Row label="Warna border">
                                                <ColorInput value={(selected as Img).borderColor ?? '#000000'} onChange={(v) => update(selected.id, { borderColor: v })} />
                                            </Row>
                                        )}
                                    </Section>
                                </>
                            )}

                            {selected.type === 'table' && (
                                <TableInspector
                                    el={selected as TableEl}
                                    selectedCell={selectedCell}
                                    selectedRange={selectedRange}
                                    onUpdateTrb={(patch) => { snapshot(); setContentTable(patch); }}
                                    onUpdateRow={updateTrbRow}
                                    onUpdateCell={updateTrbCell}
                                    onAddRow={addTrbRow}
                                    onRemoveRow={removeTrbRow}
                                    onMoveRow={moveTrbRow}
                                    onAddCol={addTrbCol}
                                    onRemoveCol={removeTrbCol}
                                    onMerge={mergeTrbRange}
                                    onUnmerge={unmergeTrbCell}
                                />
                            )}

                            {selected.type === 'grid' && (
                                <GridInspector
                                    el={selected as GridEl}
                                    selectedCell={selectedCell}
                                    selectedRange={selectedRange}
                                    onAddRow={() => addGridRow(selected.id)}
                                    onRemoveRow={() => removeGridRow(selected.id)}
                                    onAddCol={() => addGridCol(selected.id)}
                                    onRemoveCol={() => removeGridCol(selected.id)}
                                    onUpdateGrid={(patch) => { snapshot(); updateGrid(selected.id, patch); }}
                                    onUpdateCell={(r, c, patch) => { snapshot(); updateGridCell(selected.id, r, c, patch); }}
                                    onMerge={(r1, c1, r2, c2) => mergeRange(selected.id, r1, c1, r2, c2)}
                                    onUnmerge={(row, col) => unmergeCell(selected.id, row, col)}
                                />
                            )}

                            {selected.type === 'rect' && (
                                <RectInspector
                                    el={selected as RectEl}
                                    onUpdate={(patch) => { snapshot(); update(selected.id, patch); }}
                                />
                            )}

                            {selected.type === 'line' && (
                                <LineInspector
                                    el={selected as LineEl}
                                    onUpdate={(patch) => { snapshot(); update(selected.id, patch); }}
                                />
                            )}

                            {/* Posisi (shared) */}
                            <Section title="Posisi">
                                <Row label="X">
                                    <NumField value={Math.round(selected.x)} onChange={(v) => update(selected.id, { x: v })} />
                                </Row>
                                <Row label="Y">
                                    <NumField value={Math.round(selected.y)} onChange={(v) => update(selected.id, { y: v })} />
                                </Row>
                                {(selected.type === 'table' || selected.type === 'grid') && (
                                    <Row label="Lebar">
                                        <NumField value={(selected as TableEl | GridEl).width} onChange={(v) => update(selected.id, { width: Math.max(100, v) })} />
                                    </Row>
                                )}
                                {selected.type === 'rect' && (
                                    <>
                                        <Row label="Lebar"><NumField value={(selected as RectEl).width} onChange={(v) => update(selected.id, { width: Math.max(4, v) })} /></Row>
                                        <Row label="Tinggi"><NumField value={(selected as RectEl).height} onChange={(v) => update(selected.id, { height: Math.max(4, v) })} /></Row>
                                    </>
                                )}
                                {selected.type === 'line' && (
                                    <Row label="Panjang"><NumField value={(selected as LineEl).length} onChange={(v) => update(selected.id, { length: Math.max(4, v) })} /></Row>
                                )}
                            </Section>

                            <Section title="">
                                {selected.type !== 'table' && (
                                    <Button variant="zinc" size="sm" className="w-full" onClick={() => duplicate(selected as BandEl)}>
                                        <Copy className="w-4 h-4" /> Gandakan <span className="text-xs opacity-60">Ctrl+D</span>
                                    </Button>
                                )}
                                <Button variant="red" size="sm" className="w-full" onClick={() => remove(selected.id)}>
                                    <Trash2 className="w-4 h-4" /> Hapus elemen
                                </Button>
                            </Section>
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}

// â”€â”€ Text Inspector â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TextInspector({
    el,
    contentRef,
    tokenCatalog,
    sampleData,
    fieldMenu,
    setFieldMenu,
    onInsertToken,
    onUpdate,
    onSnapshot,
    customFonts,
}: {
    el: Text;
    contentRef: React.RefObject<HTMLTextAreaElement | null>;
    tokenCatalog: { path: string; label: string }[];
    sampleData: Record<string, string>;
    fieldMenu: boolean;
    setFieldMenu: (v: boolean | ((o: boolean) => boolean)) => void;
    onInsertToken: (path: string) => void;
    onUpdate: (patch: Partial<Text>) => void;
    onSnapshot: () => void;
    customFonts: CustomFontEntry[];
}) {
    const hasBox = el.width !== undefined;

    // â”€â”€ Upload font state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const [uploadOpen, setUploadOpen] = React.useState(false);
    const [uploadName, setUploadName] = React.useState('');
    const [uploadFile, setUploadFile] = React.useState<File | null>(null);
    const [uploading, setUploading] = React.useState(false);
    const uploadFileRef = React.useRef<HTMLInputElement>(null);

    const handleFontUpload = () => {
        if (!uploadName.trim() || !uploadFile) {
            return;
        }
        setUploading(true);
        const formData = new FormData();
        formData.append('name', uploadName.trim());
        formData.append('file', uploadFile);
        router.post(companyUrl('/settings/pdf-templates/custom-fonts'), formData, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                toast.success(`Font "${uploadName}" berhasil diunggah.`);
                setUploadOpen(false);
                setUploadName('');
                setUploadFile(null);
                if (uploadFileRef.current) {
                    uploadFileRef.current.value = '';
                }
            },
            onError: (errors) => {
                const msg = Object.values(errors)[0] ?? 'Gagal mengunggah font.';
                toast.error(String(msg));
            },
            onFinish: () => setUploading(false),
        });
    };

    const toggleBtn = (active: boolean, onClick: () => void, title: string, children: React.ReactNode) => (
        <button
            onClick={() => { onSnapshot(); onClick(); }}
            title={title}
            className={`grid place-items-center h-8 w-8 rounded-lg border transition-colors ${
                active
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-300'
                    : 'border-secondary-200 dark:border-dark-600 text-dark-500 dark:text-dark-400 hover:bg-zinc-50 dark:hover:bg-dark-700'
            }`}
        >
            {children}
        </button>
    );

    return (
        <>
            {/* â”€â”€ Konten â”€â”€ */}
            <Section title="Konten">
                <Textarea
                    ref={contentRef}
                    value={el.content}
                    onChange={(e) => onUpdate({ content: e.target.value })}
                    rows={2}
                    className="font-mono text-xs leading-relaxed"
                />
                <div className="relative">
                    <Button variant="zinc" size="sm" className="w-full" onClick={() => setFieldMenu((o) => !o)}>
                        <Plus className="w-4 h-4" /> Sisipkan field
                    </Button>
                    {fieldMenu && (
                        <div className="absolute z-20 left-0 right-0 mt-1 max-h-56 overflow-auto rounded-lg border border-secondary-200 dark:border-dark-600 bg-white dark:bg-dark-700 shadow-lg p-1">
                            {tokenCatalog.map((t) => (
                                <button
                                    key={t.path}
                                    onClick={() => { onInsertToken(t.path); setFieldMenu(false); }}
                                    className="w-full text-left px-2 py-1.5 rounded-md hover:bg-zinc-50 dark:hover:bg-dark-600"
                                >
                                    <div className="text-xs font-mono text-primary-600 dark:text-primary-400">{`{{${t.path}}}`}</div>
                                    <div className="text-[11px] text-dark-400 dark:text-dark-500 truncate">
                                        {sampleData[t.path] ?? t.label}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <p className="text-[11px] text-dark-400 dark:text-dark-500">
                    Token diganti data asli saat <strong>Preview</strong> / cetak.
                </p>
            </Section>

            {/* â”€â”€ Font â”€â”€ */}
            <Section title="Font">
                {/* Font family â€” curated + custom fonts via catalog Combobox */}
                <Row label="Jenis">
                    <Combobox
                        value={el.fontFamily ?? 'Helvetica / Arial'}
                        onChange={(v) => { if (v) onUpdate({ fontFamily: v as FontLabel }); }}
                        options={[
                            { value: '__builtin__', label: 'Bawaan', disabled: true },
                            ...FONT_MAP.map((f) => ({ value: f.label, label: f.label })),
                            ...(customFonts.length > 0
                                ? [
                                    { value: '__custom__', label: 'Font kustom', disabled: true },
                                    ...customFonts.map((f) => ({ value: f.name, label: f.name })),
                                ]
                                : []),
                        ]}
                        placeholder="Pilih fontâ€¦"
                        searchPlaceholder="Cari fontâ€¦"
                        clearable={false}
                    />
                </Row>

                {/* Upload font control */}
                <div className="space-y-1.5">
                    <button
                        onClick={() => setUploadOpen((o) => !o)}
                        className="flex items-center gap-1.5 text-[11px] text-primary-600 dark:text-primary-400 hover:underline"
                    >
                        <Upload className="w-3 h-3" />
                        {uploadOpen ? 'Batal unggah' : '+ Unggah font (.ttf)'}
                    </button>

                    {uploadOpen && (
                        <div className="space-y-2 rounded-lg border border-secondary-200 dark:border-dark-600 bg-zinc-50 dark:bg-dark-700 p-2.5">
                            <div>
                                <Input
                                    label="Nama font *"
                                    placeholder="mis. Poppins"
                                    value={uploadName}
                                    onChange={(e) => setUploadName(e.target.value)}
                                    className="h-7 text-xs"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] text-dark-500 dark:text-dark-400 mb-1">File .ttf *</label>
                                <input
                                    ref={uploadFileRef}
                                    type="file"
                                    accept=".ttf"
                                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                                    className="block w-full text-xs text-dark-700 dark:text-dark-300 file:mr-2 file:rounded file:border-0 file:bg-primary-50 file:px-2 file:py-0.5 file:text-[11px] file:font-medium file:text-primary-700 dark:file:bg-primary-900/30 dark:file:text-primary-300 cursor-pointer"
                                />
                            </div>
                            <Button
                                variant="primary"
                                size="sm"
                                className="w-full"
                                disabled={!uploadName.trim() || !uploadFile || uploading}
                                onClick={handleFontUpload}
                            >
                                <Upload className="w-3.5 h-3.5" />
                                {uploading ? 'Mengunggahâ€¦' : 'Unggah font'}
                            </Button>
                        </div>
                    )}

                    {/* Installed custom fonts list with delete */}
                    {customFonts.length > 0 && (
                        <div className="space-y-1 mt-1">
                            {customFonts.map((f) => (
                                <div
                                    key={f.id}
                                    className="flex items-center gap-1.5 rounded-md px-2 py-1 bg-zinc-50 dark:bg-dark-700 border border-secondary-200 dark:border-dark-600"
                                >
                                    <span
                                        className="flex-1 truncate text-[11px] text-dark-700 dark:text-dark-300"
                                        style={{ fontFamily: `"${f.name}"` }}
                                    >
                                        {f.name}
                                    </span>
                                    <button
                                        onClick={() =>
                                            router.delete(companyUrl(`/settings/pdf-templates/custom-fonts/${f.id}`), {
                                                preserveScroll: true,
                                                onSuccess: () => toast.success(`Font "${f.name}" dihapus.`),
                                            })
                                        }
                                        className="grid place-items-center h-5 w-5 rounded text-dark-400 hover:text-red-500 dark:hover:text-red-400 transition"
                                        title="Hapus font"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                {/* Size + color */}
                <Row label="Ukuran">
                    <NumField value={el.fontSize} onChange={(v) => onUpdate({ fontSize: Math.max(4, v) })} unit="px" />
                </Row>
                <Row label="Warna teks">
                    <ColorInput value={el.color} onChange={(v) => onUpdate({ color: v })} />
                </Row>
                {/* Style toggles: B I U S */}
                <Row label="Gaya">
                    <div className="flex gap-1">
                        {toggleBtn(el.bold, () => onUpdate({ bold: !el.bold }), 'Tebal (Bold)', <BoldIcon className="w-4 h-4" />)}
                        {toggleBtn(el.italic ?? false, () => onUpdate({ italic: !el.italic }), 'Miring (Italic)', <Italic className="w-4 h-4" />)}
                        {toggleBtn(el.underline ?? false, () => onUpdate({ underline: !el.underline }), 'Garis bawah', <Underline className="w-4 h-4" />)}
                        {toggleBtn(el.strikethrough ?? false, () => onUpdate({ strikethrough: !el.strikethrough }), 'Garis tengah', <Strikethrough className="w-4 h-4" />)}
                    </div>
                </Row>
                {/* Highlight */}
                <Row label="Sorot">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={!!el.highlight}
                            onChange={(e) => onUpdate({ highlight: e.target.checked ? '#fef08a' : null })}
                            className="accent-primary-600"
                        />
                        {el.highlight && (
                            <ColorInput value={el.highlight} onChange={(v) => onUpdate({ highlight: v })} />
                        )}
                        {!el.highlight && (
                            <span className="text-xs text-dark-400 dark:text-dark-500">Tidak aktif</span>
                        )}
                    </div>
                </Row>
            </Section>

            {/* â”€â”€ Paragraf â”€â”€ */}
            <Section title="Paragraf">
                {/* H-align */}
                <Row label="Rata H">
                    <div className="flex gap-1">
                        {([
                            { value: 'left',    icon: <AlignLeft className="w-3.5 h-3.5" />,    title: 'Kiri' },
                            { value: 'center',  icon: <AlignCenter className="w-3.5 h-3.5" />,  title: 'Tengah' },
                            { value: 'right',   icon: <AlignRight className="w-3.5 h-3.5" />,   title: 'Kanan' },
                            { value: 'justify', icon: <AlignJustify className="w-3.5 h-3.5" />, title: 'Rata penuh' },
                        ] as const).map(({ value, icon, title }) => (
                            <button
                                key={value}
                                onClick={() => onUpdate({ align: value })}
                                title={title}
                                className={`flex-1 grid place-items-center h-8 rounded-lg border transition-colors ${
                                    (el.align ?? 'left') === value
                                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-300'
                                        : 'border-secondary-200 dark:border-dark-600 text-dark-500 dark:text-dark-400 hover:bg-zinc-50 dark:hover:bg-dark-700'
                                }`}
                            >
                                {icon}
                            </button>
                        ))}
                    </div>
                </Row>
                {/* V-align (only meaningful when height is set) */}
                <Row label="Rata V">
                    <div className="flex gap-1">
                        {([
                            { value: 'top',    icon: <AlignStartVertical className="w-3.5 h-3.5" />,  title: 'Atas' },
                            { value: 'middle', icon: <AlignCenterVertical className="w-3.5 h-3.5" />, title: 'Tengah' },
                            { value: 'bottom', icon: <AlignEndVertical className="w-3.5 h-3.5" />,   title: 'Bawah' },
                        ] as const).map(({ value, icon, title }) => (
                            <button
                                key={value}
                                onClick={() => onUpdate({ valign: value })}
                                title={title}
                                className={`flex-1 grid place-items-center h-8 rounded-lg border transition-colors ${
                                    (el.valign ?? 'top') === value
                                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-300'
                                        : 'border-secondary-200 dark:border-dark-600 text-dark-500 dark:text-dark-400 hover:bg-zinc-50 dark:hover:bg-dark-700'
                                }`}
                            >
                                {icon}
                            </button>
                        ))}
                    </div>
                </Row>
                <Row label="Line-height">
                    <NumField value={el.lineHeight ?? 1.2} onChange={(v) => onUpdate({ lineHeight: Math.max(0.5, v) })} unit="Ã—" />
                </Row>
                <Row label="Spasi huruf">
                    <NumField value={el.letterSpacing ?? 0} onChange={(v) => onUpdate({ letterSpacing: v })} unit="px" />
                </Row>
            </Section>

            {/* â”€â”€ Kotak â”€â”€ */}
            <Section title="Kotak">
                <Row label="Lebar">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={hasBox}
                            onChange={(e) => {
                                onSnapshot();
                                onUpdate(e.target.checked ? { width: 200 } : { width: undefined, height: undefined });
                            }}
                            className="accent-primary-600 shrink-0"
                            title="Aktifkan mode kotak teks"
                        />
                        {hasBox ? (
                            <NumField value={el.width!} onChange={(v) => onUpdate({ width: Math.max(20, v) })} unit="px" />
                        ) : (
                            <span className="text-xs text-dark-400 dark:text-dark-500">Otomatis (lebar mengikuti teks)</span>
                        )}
                    </div>
                </Row>
                {hasBox && (
                    <>
                        <Row label="Tinggi">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={el.height !== undefined}
                                    onChange={(e) => {
                                        onSnapshot();
                                        onUpdate({ height: e.target.checked ? 40 : undefined });
                                    }}
                                    className="accent-primary-600 shrink-0"
                                />
                                {el.height !== undefined ? (
                                    <NumField value={el.height} onChange={(v) => onUpdate({ height: Math.max(10, v) })} unit="px" />
                                ) : (
                                    <span className="text-xs text-dark-400 dark:text-dark-500">Otomatis</span>
                                )}
                            </div>
                        </Row>
                        <Row label="Padding">
                            <NumField value={el.padding ?? 0} onChange={(v) => onUpdate({ padding: Math.max(0, v) })} unit="px" />
                        </Row>
                        <Row label="Border">
                            <NumField
                                value={el.borderWidth ?? 0}
                                onChange={(v) => onUpdate({ borderWidth: Math.max(0, v) })}
                                unit="px"
                            />
                        </Row>
                        {(el.borderWidth ?? 0) > 0 && (
                            <Row label="Warna border">
                                <ColorInput value={el.borderColor ?? '#000000'} onChange={(v) => onUpdate({ borderColor: v })} />
                            </Row>
                        )}
                        <Row label="Isi kotak">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={!!el.fill}
                                    onChange={(e) => onUpdate({ fill: e.target.checked ? '#ffffff' : null })}
                                    className="accent-primary-600"
                                />
                                {el.fill && (
                                    <ColorInput value={el.fill} onChange={(v) => onUpdate({ fill: v })} />
                                )}
                                {!el.fill && (
                                    <span className="text-xs text-dark-400 dark:text-dark-500">Transparan</span>
                                )}
                            </div>
                        </Row>
                    </>
                )}
            </Section>
        </>
    );
}

// â”€â”€ Grid canvas render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface GridCanvasProps {
    el: GridEl;
    preview: boolean;
    resolve: (text: string) => string;
    selectedCell: { row: number; col: number } | null;
    editingCell: { row: number; col: number } | null;
    selectedRange: { r1: number; c1: number; r2: number; c2: number } | null;
    rangeAnchor: { row: number; col: number } | null;
    onCellPointerDown: (row: number, col: number, e: React.PointerEvent) => void;
    onCellDoubleClick: (row: number, col: number) => void;
    onCellCommit: (row: number, col: number, text: string) => void;
    onCellEscape: (row: number, col: number) => void;
}

function GridCanvas({
    el, preview, resolve,
    selectedCell, editingCell,
    selectedRange, rangeAnchor,
    onCellPointerDown, onCellDoubleClick, onCellCommit, onCellEscape,
}: GridCanvasProps) {
    const bw = el.border.width;
    const bc = el.border.color;

    return (
        <table
            style={{
                width: el.width,
                borderCollapse: 'collapse',
                tableLayout: 'fixed',
                fontFamily: 'Helvetica, Arial, sans-serif',
                fontSize: 10,
                userSelect: 'none',
            }}
        >
            <tbody>
                {el.cells.map((rowCells, ri) => (
                    <tr key={ri}>
                        {rowCells.map((cell, ci) => {
                            if (cell.merged) return null;

                            const isSel = selectedCell?.row === ri && selectedCell?.col === ci;
                            const isEditing = editingCell?.row === ri && editingCell?.col === ci;
                            const displayText = preview ? resolve(cell.text) : cell.text;

                            const inRange = selectedRange
                                ? (ri >= selectedRange.r1 && ri <= selectedRange.r2 && ci >= selectedRange.c1 && ci <= selectedRange.c2)
                                : false;
                            const isAnchor = rangeAnchor?.row === ri && rangeAnchor?.col === ci;

                            return (
                                <td
                                    key={ci}
                                    colSpan={cell.colSpan ?? 1}
                                    rowSpan={cell.rowSpan ?? 1}
                                    onPointerDown={(e) => onCellPointerDown(ri, ci, e)}
                                    onDoubleClick={() => onCellDoubleClick(ri, ci)}
                                    style={{
                                        width: el.colWidths[ci] ?? 'auto',
                                        height: GRID_ROW_H,
                                        border: `${bw}px solid ${bc}`,
                                        padding: '2px 4px',
                                        textAlign: cell.align,
                                        fontWeight: cell.bold ? 700 : 400,
                                        color: cell.color,
                                        backgroundColor: inRange
                                            ? '#eff6ff'
                                            : (cell.fill ?? 'transparent'),
                                        outline: isAnchor ? '2px solid #3b82f6' : inRange ? '1px solid #93c5fd' : 'none',
                                        outlineOffset: -2,
                                        verticalAlign: 'middle',
                                        overflow: 'hidden',
                                        cursor: isEditing ? 'text' : 'default',
                                        position: 'relative',
                                    }}
                                >
                                    {isEditing ? (
                                        <GridCellEditor
                                            initial={cell.text}
                                            onCommit={(v) => onCellCommit(ri, ci, v)}
                                            onEscape={() => onCellEscape(ri, ci)}
                                            style={{
                                                fontWeight: cell.bold ? 700 : 400,
                                                color: cell.color,
                                                textAlign: cell.align,
                                            }}
                                        />
                                    ) : (
                                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', display: 'block' }}>
                                            {displayText}
                                        </span>
                                    )}
                                </td>
                            );
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

/** Inline editor for a single grid cell â€” contentEditable span. */
function GridCellEditor({
    initial, onCommit, onEscape, style,
}: {
    initial: string;
    onCommit: (v: string) => void;
    onEscape: () => void;
    style?: React.CSSProperties;
}) {
    const ref = React.useRef<HTMLSpanElement>(null);

    React.useEffect(() => {
        if (!ref.current) return;
        ref.current.textContent = initial;
        ref.current.focus();
        // Select all text
        const range = document.createRange();
        range.selectNodeContents(ref.current);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <span
            ref={ref}
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => onCommit(e.currentTarget.textContent ?? '')}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); }
                else if (e.key === 'Escape') {
                    e.currentTarget.textContent = initial;
                    e.currentTarget.blur();
                    onEscape();
                }
                e.stopPropagation(); // don't bubble to canvas Delete handler
            }}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
                display: 'block',
                outline: 'none',
                whiteSpace: 'nowrap',
                width: '100%',
                ...style,
            }}
        />
    );
}

// â”€â”€ Grid Inspector â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function GridInspector({
    el,
    selectedCell,
    selectedRange,
    onAddRow, onRemoveRow, onAddCol, onRemoveCol,
    onUpdateGrid, onUpdateCell,
    onMerge, onUnmerge,
}: {
    el: GridEl;
    selectedCell: { row: number; col: number } | null;
    selectedRange: { r1: number; c1: number; r2: number; c2: number } | null;
    onAddRow: () => void;
    onRemoveRow: () => void;
    onAddCol: () => void;
    onRemoveCol: () => void;
    onUpdateGrid: (patch: Partial<GridEl>) => void;
    onUpdateCell: (row: number, col: number, patch: Partial<GridCell>) => void;
    onMerge: (r1: number, c1: number, r2: number, c2: number) => void;
    onUnmerge: (row: number, col: number) => void;
}) {
    const cell = selectedCell != null ? el.cells[selectedCell.row]?.[selectedCell.col] : null;

    return (
        <>
            {/* â”€â”€ Grid structure â”€â”€ */}
            <Section title="Struktur Grid">
                {/* Rows */}
                <div className="flex items-center gap-2">
                    <span className="w-12 shrink-0 text-xs text-dark-500 dark:text-dark-400">Baris</span>
                    <div className="flex items-center gap-1 flex-1">
                        <button
                            onClick={onRemoveRow}
                            disabled={el.rows <= 1}
                            className="grid place-items-center h-7 w-7 rounded-lg border border-secondary-200 dark:border-dark-600 text-dark-500 dark:text-dark-400 hover:bg-zinc-50 dark:hover:bg-dark-700 disabled:opacity-30 transition"
                            title="Hapus baris terakhir"
                        >
                            <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="flex-1 text-center text-sm tabular-nums font-medium text-dark-900 dark:text-dark-50">{el.rows}</span>
                        <button
                            onClick={onAddRow}
                            className="grid place-items-center h-7 w-7 rounded-lg border border-secondary-200 dark:border-dark-600 text-dark-500 dark:text-dark-400 hover:bg-zinc-50 dark:hover:bg-dark-700 transition"
                            title="Tambah baris"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
                {/* Cols */}
                <div className="flex items-center gap-2">
                    <span className="w-12 shrink-0 text-xs text-dark-500 dark:text-dark-400">Kolom</span>
                    <div className="flex items-center gap-1 flex-1">
                        <button
                            onClick={onRemoveCol}
                            disabled={el.cols <= 1}
                            className="grid place-items-center h-7 w-7 rounded-lg border border-secondary-200 dark:border-dark-600 text-dark-500 dark:text-dark-400 hover:bg-zinc-50 dark:hover:bg-dark-700 disabled:opacity-30 transition"
                            title="Hapus kolom terakhir"
                        >
                            <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="flex-1 text-center text-sm tabular-nums font-medium text-dark-900 dark:text-dark-50">{el.cols}</span>
                        <button
                            onClick={onAddCol}
                            className="grid place-items-center h-7 w-7 rounded-lg border border-secondary-200 dark:border-dark-600 text-dark-500 dark:text-dark-400 hover:bg-zinc-50 dark:hover:bg-dark-700 transition"
                            title="Tambah kolom"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </Section>

            {/* â”€â”€ Border â”€â”€ */}
            <Section title="Garis Border">
                <Row label="Tebal">
                    <NumField
                        value={el.border.width}
                        onChange={(v) => onUpdateGrid({ border: { ...el.border, width: Math.max(0, v) } })}
                        unit="px"
                    />
                </Row>
                <Row label="Warna">
                    <ColorInput
                        value={el.border.color}
                        onChange={(v) => onUpdateGrid({ border: { ...el.border, color: v } })}
                    />
                </Row>
            </Section>

            {/* â”€â”€ Cell properties (shown when cell is selected) â”€â”€ */}
            {cell != null && selectedCell != null && !(selectedRange && (selectedRange.r1 !== selectedRange.r2 || selectedRange.c1 !== selectedRange.c2)) ? (
                <Section title={`Sel [${selectedCell.row + 1}, ${selectedCell.col + 1}]`}>
                    {/* Alignment */}
                    <Row label="Rata">
                        <div className="flex gap-1">
                            {([
                                { value: 'left', icon: <AlignLeft className="w-3.5 h-3.5" />, title: 'Kiri' },
                                { value: 'center', icon: <AlignCenter className="w-3.5 h-3.5" />, title: 'Tengah' },
                                { value: 'right', icon: <AlignRight className="w-3.5 h-3.5" />, title: 'Kanan' },
                            ] as const).map(({ value, icon, title }) => (
                                <button
                                    key={value}
                                    onClick={() => onUpdateCell(selectedCell.row, selectedCell.col, { align: value })}
                                    title={title}
                                    className={`flex-1 grid place-items-center h-7 rounded-lg border transition-colors ${
                                        cell.align === value
                                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-300'
                                            : 'border-secondary-200 dark:border-dark-600 text-dark-500 dark:text-dark-400 hover:bg-zinc-50 dark:hover:bg-dark-700'
                                    }`}
                                >
                                    {icon}
                                </button>
                            ))}
                        </div>
                    </Row>
                    {/* Bold */}
                    <Row label="Tebal">
                        <button
                            onClick={() => onUpdateCell(selectedCell.row, selectedCell.col, { bold: !cell.bold })}
                            className={`grid place-items-center h-8 w-8 rounded-lg border transition-colors ${
                                cell.bold
                                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-300'
                                    : 'border-secondary-200 dark:border-dark-600 text-dark-500 dark:text-dark-400 hover:bg-zinc-50 dark:hover:bg-dark-700'
                            }`}
                            title="Bold"
                        >
                            <BoldIcon className="w-4 h-4" />
                        </button>
                    </Row>
                    {/* Text color */}
                    <Row label="Warna">
                        <ColorInput
                            value={cell.color}
                            onChange={(v) => onUpdateCell(selectedCell.row, selectedCell.col, { color: v })}
                        />
                    </Row>
                    {/* Fill color */}
                    <Row label="Isi">
                        <ColorInput
                            value={cell.fill ?? '#ffffff'}
                            onChange={(v) => onUpdateCell(selectedCell.row, selectedCell.col, { fill: v })}
                        />
                    </Row>
                    {/* Merge/unmerge */}
                    {((cell.colSpan ?? 1) > 1 || (cell.rowSpan ?? 1) > 1) && (
                        <Button variant="zinc" size="sm" className="w-full mt-1"
                            onClick={() => onUnmerge(selectedCell.row, selectedCell.col)}>
                            Pisahkan sel
                        </Button>
                    )}
                </Section>
            ) : (
                <Section title="Sel">
                    {selectedRange && (selectedRange.r1 !== selectedRange.r2 || selectedRange.c1 !== selectedRange.c2) ? (
                        <>
                            <p className="text-[11px] text-dark-400 dark:text-dark-500 text-center py-1">
                                {`${selectedRange.r2 - selectedRange.r1 + 1} baris Ã— ${selectedRange.c2 - selectedRange.c1 + 1} kolom dipilih`}
                            </p>
                            <Button variant="primary" size="sm" className="w-full"
                                onClick={() => onMerge(selectedRange.r1, selectedRange.c1, selectedRange.r2, selectedRange.c2)}>
                                Gabungkan sel
                            </Button>
                        </>
                    ) : (
                        <p className="text-[11px] text-dark-400 dark:text-dark-500 text-center py-1">
                            Klik sel di kanvas untuk mengatur propertinya.
                        </p>
                    )}
                </Section>
            )}
        </>
    );
}

// â”€â”€ Table canvas render (TRB row-band model) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TablePreview({
    el, rows, selectedCell, tableSelRange, onCellPointerDown,
}: {
    el: TableEl;
    rows: Array<Record<string, string>> | null;
    selectedCell?: { row: number; col: number } | null;
    tableSelRange?: { r1: number; c1: number; r2: number; c2: number } | null;
    onCellPointerDown?: (ri: number, ci: number, e: React.PointerEvent) => void;
}) {
    const sampleRows = rows ?? Array.from({ length: TABLE_PLACEHOLDER_ROWS }, (_, i) => ({
        'item.no': String(i + 1),
        'item.description': `Item Contoh ${i + 1}`,
        'item.quantity': '2',
        'item.unit': 'pcs',
        'item.unit_price': i === 0 ? 'Rp 1.500.000' : i === 1 ? 'Rp 2.000.000' : 'Rp 500.000',
        'item.amount': i === 0 ? 'Rp 3.000.000' : i === 1 ? 'Rp 2.000.000' : 'Rp 1.500.000',
        'item.cogs_amount': 'Rp 500.000',
        'item.is_tax_deposit': 'Tidak',
    }));

    const resolveCell = (content: string | null | undefined, itemRow?: Record<string, string>): string =>
        (content ?? '').replace(/\{\{([\w.]+)\}\}/g, (_, key) => {
            if (itemRow && key.startsWith('item.')) { return itemRow[key] ?? key; }
            return `{{${key}}}`;
        });

    const renderCell = (cell: TableCell, tableRowIdx: number, colIdx: number, rowH: number, itemRow?: Record<string, string>) => {
        if (cell.merged) return null;
        const isSel = selectedCell?.row === tableRowIdx && selectedCell?.col === colIdx;
        const inRange = tableSelRange != null
            && tableRowIdx >= tableSelRange.r1 && tableRowIdx <= tableSelRange.r2
            && colIdx >= tableSelRange.c1 && colIdx <= tableSelRange.c2;
        const textAlign = cell.align === 'right' ? 'right' : cell.align === 'center' ? 'center' : 'left';

        // Rowspan cells: compute total height = sum of all spanned row heights.
        const rowSpan = cell.rowSpan ?? 1;
        let cellH = rowH;
        if (rowSpan > 1) {
            cellH = 0;
            for (let s = 0; s < rowSpan; s++) {
                const sr = el.rows[tableRowIdx + s];
                const srH = sr ? (sr.height ?? (sr.repeat === 'items' ? TABLE_ROW_H : TABLE_HEADER_H)) : TABLE_ROW_H;
                cellH += srH;
            }
        }

        return (
            <td
                key={`${tableRowIdx}-${colIdx}`}
                colSpan={cell.colSpan ?? 1}
                rowSpan={rowSpan}
                onPointerDown={onCellPointerDown ? (e) => { e.stopPropagation(); onCellPointerDown(tableRowIdx, colIdx, e); } : undefined}
                style={{
                    height: cellH,
                    textAlign,
                    fontWeight: cell.bold ? 700 : 400,
                    color: cell.color ?? undefined,
                    backgroundColor: isSel
                        ? 'rgba(59,130,246,0.15)'
                        : inRange
                        ? 'rgba(59,130,246,0.07)'
                        : (cell.fill ?? undefined),
                    fontSize: cell.fontSize ?? undefined,
                    border: isSel ? '1.5px solid rgba(59,130,246,0.7)' : '1px solid #e2e8f0',
                    verticalAlign: 'middle',
                    overflow: 'hidden',
                    padding: '2px 8px',
                    cursor: onCellPointerDown ? 'pointer' : undefined,
                    userSelect: 'none',
                }}
            >
                {resolveCell(cell.content, itemRow)}
            </td>
        );
    };

    // Auto-detect sections â€” mirrors blade renderer: pre-repeatâ†’thead, repeatâ†’tbody, post-repeatâ†’tfoot.
    const firstRepeatIdx = el.rows.findIndex((r) => r.repeat === 'items');
    const headRowsWithIdx = el.rows.map((r, i) => ({ r, i })).filter(({ i }) => firstRepeatIdx !== -1 && i < firstRepeatIdx);
    const bodyRowsWithIdx = el.rows.map((r, i) => ({ r, i })).filter(({ r }) => r.repeat === 'items');
    const footRowsWithIdx = el.rows.map((r, i) => ({ r, i })).filter(({ r, i }) => firstRepeatIdx !== -1 && i > firstRepeatIdx && r.repeat !== 'items');

    return (
        <div
            className="w-full h-full overflow-hidden rounded border border-blue-200 dark:border-blue-900/40 bg-white dark:bg-dark-800 text-[10px]"
            style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}
        >
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                    {el.colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
                </colgroup>
                <thead>
                    {headRowsWithIdx.map(({ r: row, i: ri }, pos) => {
                        const rowH = row.height ?? TABLE_HEADER_H;
                        if (row.cells.every((c) => c.merged)) return <tr key={ri} style={{ height: rowH }} />;
                        return (
                            <tr key={ri} style={{ background: pos === headRowsWithIdx.length - 1 ? '#f1f5f9' : '#e2e8f0' }}>
                                {row.cells.map((cell, ci) => renderCell(cell, ri, ci, rowH))}
                            </tr>
                        );
                    })}
                </thead>
                <tbody>
                    {bodyRowsWithIdx.map(({ r: row, i: ri }) => {
                        const rowH = row.height ?? TABLE_ROW_H;
                        if (row.cells.every((c) => c.merged)) return <tr key={ri} style={{ height: rowH }} />;
                        return row.repeat === 'items'
                            ? sampleRows.map((sampleItem, si) => (
                                <tr key={`${ri}-${si}`} style={{ background: si % 2 === 1 ? '#f8fafc' : undefined }}>
                                    {row.cells.map((cell, ci) => renderCell(cell, ri, ci, rowH, sampleItem))}
                                </tr>
                            ))
                            : (
                                <tr key={ri}>
                                    {row.cells.map((cell, ci) => renderCell(cell, ri, ci, rowH))}
                                </tr>
                            );
                    })}
                </tbody>
                {footRowsWithIdx.length > 0 && (
                    <tfoot>
                        {footRowsWithIdx.map(({ r: row, i: ri }) => {
                            const rowH = row.height ?? TABLE_HEADER_H;
                            if (row.cells.every((c) => c.merged)) return <tr key={ri} style={{ height: rowH }} />;
                            return (
                                <tr key={ri} style={{ background: '#f1f5f9', fontWeight: 700 }}>
                                    {row.cells.map((cell, ci) => renderCell(cell, ri, ci, rowH))}
                                </tr>
                            );
                        })}
                    </tfoot>
                )}
            </table>
        </div>
    );
}

// â”€â”€ Table Inspector â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TableInspector({
    el, selectedCell, selectedRange,
    onUpdateTrb, onUpdateRow, onUpdateCell,
    onAddRow, onRemoveRow, onMoveRow,
    onAddCol, onRemoveCol,
    onMerge, onUnmerge,
}: {
    el: TableEl;
    selectedCell: { row: number; col: number } | null;
    selectedRange: { r1: number; c1: number; r2: number; c2: number } | null;
    onUpdateTrb: (patch: Partial<TableEl>) => void;
    onUpdateRow: (rowIdx: number, patch: Partial<TableRow>) => void;
    onUpdateCell: (rowIdx: number, colIdx: number, patch: Partial<TableCell>) => void;
    onAddRow: () => void;
    onRemoveRow: (rowIdx: number) => void;
    onMoveRow: (rowIdx: number, dir: -1 | 1) => void;
    onAddCol: () => void;
    onRemoveCol: (colIdx: number) => void;
    onMerge: (r1: number, c1: number, r2: number, c2: number) => void;
    onUnmerge: (row: number, col: number) => void;
}) {
    const cell = selectedCell != null ? el.rows[selectedCell.row]?.cells[selectedCell.col] : null;
    const selectedRow = selectedCell != null ? el.rows[selectedCell.row] : null;

    // Position-based section label (mirrors blade auto-detect)
    const firstRepeatRowIdx = el.rows.findIndex((r) => r.repeat === 'items');
    const rowSection = (ri: number): { label: string; variant: 'blue' | 'zinc' | 'purple' } => {
        if (firstRepeatRowIdx === -1 || ri < firstRepeatRowIdx) return { label: 'Header', variant: 'blue' };
        if (el.rows[ri]?.repeat === 'items') return { label: 'Isi', variant: 'zinc' };
        return { label: 'Footer', variant: 'purple' };
    };

    const itemTokens = [
        { key: 'item.no', label: 'No.' },
        { key: 'item.description', label: 'Deskripsi' },
        { key: 'item.quantity', label: 'Qty' },
        { key: 'item.unit', label: 'Satuan' },
        { key: 'item.unit_price', label: 'Harga' },
        { key: 'item.amount', label: 'Jumlah' },
        { key: 'item.cogs_amount', label: 'COGS' },
        { key: 'item.is_tax_deposit', label: 'Pajak' },
    ];

    return (
        <>
            {/* â”€â”€ Rows list â”€â”€ */}
            <Section title="Baris">
                <div className="space-y-1">
                    {el.rows.map((row, ri) => (
                        <div
                            key={ri}
                            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border transition-colors text-[11px] ${
                                selectedCell?.row === ri
                                    ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
                                    : 'border-secondary-200 dark:border-dark-600'
                            }`}
                        >
                            <span className="w-4 shrink-0 text-center text-dark-400 dark:text-dark-500 tabular-nums">{ri + 1}</span>
                            <Badge variant={rowSection(ri).variant} size="sm" className="shrink-0 text-[9px] py-0.5 px-1.5">
                                {rowSection(ri).label}
                            </Badge>
                            {row.repeat === 'items' && (
                                <Badge variant="emerald" size="sm" className="shrink-0 text-[9px] py-0.5 px-1.5">
                                    <Repeat2 className="w-2.5 h-2.5 mr-0.5 inline-block" />repeat
                                </Badge>
                            )}
                            <span className="flex-1" />
                            <button onClick={() => onMoveRow(ri, -1)} disabled={ri === 0}
                                className="grid place-items-center h-5 w-5 rounded border border-secondary-200 dark:border-dark-600 text-dark-400 disabled:opacity-30 hover:bg-zinc-50 dark:hover:bg-dark-700 transition">
                                <ChevronUp className="w-3 h-3" />
                            </button>
                            <button onClick={() => onMoveRow(ri, 1)} disabled={ri === el.rows.length - 1}
                                className="grid place-items-center h-5 w-5 rounded border border-secondary-200 dark:border-dark-600 text-dark-400 disabled:opacity-30 hover:bg-zinc-50 dark:hover:bg-dark-700 transition">
                                <ChevronDown className="w-3 h-3" />
                            </button>
                            <button onClick={() => onRemoveRow(ri)} disabled={el.rows.length <= 1}
                                className="grid place-items-center h-5 w-5 rounded border border-secondary-200 dark:border-dark-600 text-red-400 disabled:opacity-30 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Repeat toggle for selected row */}
                {selectedRow != null && selectedCell != null && (
                    <div className="pt-2 border-t border-secondary-200 dark:border-dark-600 mt-2">
                        <Row label="Repeat items">
                            <Switch
                                checked={selectedRow.repeat === 'items'}
                                onCheckedChange={(v) => onUpdateRow(selectedCell.row, { repeat: v ? 'items' : undefined })}
                            />
                        </Row>
                    </div>
                )}

                {/* Add row button */}
                <div className="pt-1">
                    <button onClick={onAddRow}
                        className="w-full flex items-center justify-center gap-1 h-6 rounded-lg border border-dashed border-secondary-200 dark:border-dark-600 text-[10px] text-dark-400 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                        <Plus className="w-2.5 h-2.5" />Tambah Baris
                    </button>
                </div>
            </Section>

            {/* â”€â”€ Columns â”€â”€ */}
            <Section title="Kolom">
                <div className="flex items-center gap-2">
                    <span className="flex-1 text-[11px] text-dark-500 dark:text-dark-400">{el.colWidths.length} kolom</span>
                    <div className="flex gap-1">
                        <button
                            onClick={() => selectedCell != null && onRemoveCol(selectedCell.col)}
                            disabled={el.colWidths.length <= 1 || selectedCell == null}
                            title="Hapus kolom dipilih"
                            className="grid place-items-center h-7 w-7 rounded-lg border border-secondary-200 dark:border-dark-600 text-dark-500 disabled:opacity-30 hover:bg-zinc-50 dark:hover:bg-dark-700 transition">
                            <Minus className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={onAddCol} title="Tambah kolom"
                            className="grid place-items-center h-7 w-7 rounded-lg border border-secondary-200 dark:border-dark-600 text-dark-500 hover:bg-zinc-50 dark:hover:bg-dark-700 transition">
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </Section>

            {/* â”€â”€ Cell properties â”€â”€ */}
            {cell != null && selectedCell != null && !(selectedRange && (selectedRange.r1 !== selectedRange.r2 || selectedRange.c1 !== selectedRange.c2)) ? (
                <Section title={`Sel B${selectedCell.row + 1}Â·K${selectedCell.col + 1}`}>
                    {/* Content + field insert */}
                    <div className="flex gap-1 items-start">
                        <div className="flex-1">
                            <Textarea
                                value={cell.content}
                                onChange={(e) => onUpdateCell(selectedCell.row, selectedCell.col, { content: e.target.value })}
                                className="min-h-[44px] text-[11px] resize-none"
                            />
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button title="Sisipkan field item"
                                    className="h-7 px-1.5 rounded-lg border border-secondary-200 dark:border-dark-600 text-dark-400 hover:bg-zinc-50 dark:hover:bg-dark-700 transition shrink-0">
                                    <Table2 className="w-3.5 h-3.5" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuLabel className="text-[10px]">Field Item</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {itemTokens.map(({ key, label }) => (
                                    <DropdownMenuItem key={key} className="text-[11px]"
                                        onSelect={() => onUpdateCell(selectedCell.row, selectedCell.col, { content: `{{${key}}}` })}>
                                        {label}
                                        <span className="ml-auto text-dark-400 text-[9px] font-mono">{'{{' + key + '}}'}</span>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    {/* Align */}
                    <Row label="Rata">
                        <div className="flex gap-1">
                            {([
                                { value: 'left', icon: <AlignLeft className="w-3.5 h-3.5" />, title: 'Kiri' },
                                { value: 'center', icon: <AlignCenter className="w-3.5 h-3.5" />, title: 'Tengah' },
                                { value: 'right', icon: <AlignRight className="w-3.5 h-3.5" />, title: 'Kanan' },
                            ] as const).map(({ value, icon, title }) => (
                                <button key={value} onClick={() => onUpdateCell(selectedCell.row, selectedCell.col, { align: value })} title={title}
                                    className={`flex-1 grid place-items-center h-7 rounded-lg border transition-colors ${
                                        cell.align === value
                                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-300'
                                            : 'border-secondary-200 dark:border-dark-600 text-dark-500 dark:text-dark-400 hover:bg-zinc-50 dark:hover:bg-dark-700'
                                    }`}>{icon}</button>
                            ))}
                        </div>
                    </Row>
                    {/* Bold */}
                    <Row label="Tebal">
                        <button
                            onClick={() => onUpdateCell(selectedCell.row, selectedCell.col, { bold: !cell.bold })}
                            title="Bold"
                            className={`grid place-items-center h-8 w-8 rounded-lg border transition-colors ${
                                cell.bold
                                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-300'
                                    : 'border-secondary-200 dark:border-dark-600 text-dark-500 dark:text-dark-400 hover:bg-zinc-50 dark:hover:bg-dark-700'
                            }`}
                        ><BoldIcon className="w-4 h-4" /></button>
                    </Row>
                    {/* Font size */}
                    <Row label="Ukuran">
                        <NumField value={cell.fontSize ?? 11} onChange={(v) => onUpdateCell(selectedCell.row, selectedCell.col, { fontSize: v })} unit="px" />
                    </Row>
                    {/* Text color */}
                    <Row label="Warna">
                        <ColorInput value={cell.color ?? '#000000'} onChange={(v) => onUpdateCell(selectedCell.row, selectedCell.col, { color: v })} />
                    </Row>
                    {/* Fill */}
                    <Row label="Isi bg">
                        <ColorInput value={cell.fill ?? '#ffffff'} onChange={(v) => onUpdateCell(selectedCell.row, selectedCell.col, { fill: v })} />
                    </Row>
                    {/* Unmerge */}
                    {((cell.colSpan ?? 1) > 1 || (cell.rowSpan ?? 1) > 1) && (
                        <Button variant="zinc" size="sm" className="w-full mt-1"
                            onClick={() => onUnmerge(selectedCell.row, selectedCell.col)}>
                            Pisahkan sel
                        </Button>
                    )}
                </Section>
            ) : (
                <Section title="Sel">
                    {selectedRange && (selectedRange.r1 !== selectedRange.r2 || selectedRange.c1 !== selectedRange.c2) ? (
                        <>
                            <p className="text-[11px] text-dark-400 dark:text-dark-500 text-center py-1">
                                {`${selectedRange.r2 - selectedRange.r1 + 1} baris Ã— ${selectedRange.c2 - selectedRange.c1 + 1} kolom`}
                            </p>
                            <Button variant="primary" size="sm" className="w-full"
                                onClick={() => onMerge(selectedRange.r1, selectedRange.c1, selectedRange.r2, selectedRange.c2)}>
                                Gabungkan sel
                            </Button>
                        </>
                    ) : (
                        <p className="text-[11px] text-dark-400 dark:text-dark-500 text-center py-1">
                            Klik sel di kanvas untuk mengaturnya.
                        </p>
                    )}
                </Section>
            )}

            {/* â”€â”€ Border â”€â”€ */}
            <Section title="Garis Border">
                <Row label="Tebal">
                    <NumField value={el.border.width} onChange={(v) => onUpdateTrb({ border: { ...el.border, width: v } })} unit="px" />
                </Row>
                <Row label="Warna">
                    <ColorInput value={el.border.color} onChange={(v) => onUpdateTrb({ border: { ...el.border, color: v } })} />
                </Row>
            </Section>
        </>
    );
}

// â”€â”€ Rect Inspector â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function RectInspector({
    el,
    onUpdate,
}: {
    el: RectEl;
    onUpdate: (patch: Partial<RectEl>) => void;
}) {
    return (
        <>
            <Section title="Ukuran">
                <Row label="Lebar">
                    <NumField value={el.width} onChange={(v) => onUpdate({ width: Math.max(4, v) })} />
                </Row>
                <Row label="Tinggi">
                    <NumField value={el.height} onChange={(v) => onUpdate({ height: Math.max(4, v) })} />
                </Row>
            </Section>
            <Section title="Tampilan">
                <Row label="Isi">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={!!el.fill}
                            onChange={(e) => onUpdate({ fill: e.target.checked ? '#ffffff' : null })}
                            className="accent-primary-600"
                        />
                        {el.fill ? (
                            <ColorInput value={el.fill} onChange={(v) => onUpdate({ fill: v })} />
                        ) : (
                            <span className="text-xs text-dark-400 dark:text-dark-500">Transparan</span>
                        )}
                    </div>
                </Row>
                <Row label="Border">
                    <NumField value={el.borderWidth} onChange={(v) => onUpdate({ borderWidth: Math.max(0, v) })} unit="px" />
                </Row>
                {el.borderWidth > 0 && (
                    <Row label="Warna border">
                        <ColorInput value={el.borderColor} onChange={(v) => onUpdate({ borderColor: v })} />
                    </Row>
                )}
                <Row label="Radius">
                    <NumField value={el.borderRadius} onChange={(v) => onUpdate({ borderRadius: Math.max(0, v) })} unit="px" />
                </Row>
            </Section>
        </>
    );
}

// â”€â”€ Line Inspector â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function LineInspector({
    el,
    onUpdate,
}: {
    el: LineEl;
    onUpdate: (patch: Partial<LineEl>) => void;
}) {
    return (
        <>
            <Section title="Orientasi">
                <div className="flex gap-1">
                    {([
                        { value: 'h' as const, label: 'Horizontal' },
                        { value: 'v' as const, label: 'Vertikal' },
                    ]).map(({ value, label }) => (
                        <button
                            key={value}
                            onClick={() => onUpdate({ orientation: value })}
                            className={`flex-1 h-8 rounded-lg border text-xs font-medium transition-colors ${
                                el.orientation === value
                                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                                    : 'border-secondary-200 dark:border-dark-600 text-dark-500 dark:text-dark-400 hover:bg-zinc-50 dark:hover:bg-dark-700'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </Section>
            <Section title="Tampilan">
                <Row label="Panjang">
                    <NumField value={el.length} onChange={(v) => onUpdate({ length: Math.max(4, v) })} unit="px" />
                </Row>
                <Row label="Tebal">
                    <NumField value={el.thickness} onChange={(v) => onUpdate({ thickness: Math.max(1, v) })} unit="px" />
                </Row>
                <Row label="Warna">
                    <ColorInput value={el.color} onChange={(v) => onUpdate({ color: v })} />
                </Row>
            </Section>
        </>
    );
}

// â”€â”€ Shared primitives â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function PanelHeader({ title, meta }: { title: string; meta?: string }) {
    return (
        <div className="flex items-center justify-between px-3 h-9 shrink-0 border-b border-secondary-200 dark:border-dark-600 bg-zinc-50 dark:bg-dark-800">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-dark-400 dark:text-dark-500">{title}</span>
            {meta && (
                <span className="text-[10px] tabular-nums font-medium text-dark-500 dark:text-dark-400 bg-zinc-100 dark:bg-dark-700 border border-secondary-200 dark:border-dark-600 rounded-full px-1.5 py-0.5">{meta}</span>
            )}
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="py-3 first:pt-3 space-y-2.5 border-b border-secondary-200 dark:border-dark-600 last:border-b-0">
            {title && (
                <h4 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-dark-400 dark:text-dark-500">
                    {title}
                </h4>
            )}
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
    // Free typing but digits only (with optional leading minus), no native spinner.
    // Local text state lets the user clear/edit freely while focused; it re-syncs
    // from the prop when not focused (e.g. after a drag updates X/Y).
    const [text, setText] = React.useState(String(value));
    const focused = React.useRef(false);
    React.useEffect(() => {
        if (!focused.current) setText(String(value));
    }, [value]);

    return (
        <div className="relative">
            <Input
                type="text"
                inputMode="numeric"
                value={text}
                onFocus={() => { focused.current = true; }}
                onBlur={() => { focused.current = false; setText(String(value)); }}
                onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^\d-]/g, '');
                    setText(cleaned);
                    const n = parseInt(cleaned, 10);
                    if (!Number.isNaN(n)) onChange(n);
                }}
                className="h-8 pr-8 tabular-nums"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] text-dark-400 dark:text-dark-500">
                {unit}
            </span>
        </div>
    );
}

function EditableText({
    el, editing, customFonts, onStartEdit, onCommit,
}: { el: Text; editing: boolean; customFonts: CustomFontEntry[]; onStartEdit: () => void; onCommit: (v: string) => void }) {
    const ref = React.useRef<HTMLSpanElement>(null);
    const hasBox = el.width !== undefined;

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

    const textStyle: React.CSSProperties = {
        fontSize: el.fontSize,
        fontWeight: el.bold ? 700 : 400,
        color: el.color,
        fontFamily: fontCssStack(el.fontFamily, customFonts),
        fontStyle: el.italic ? 'italic' : 'normal',
        textDecoration: [
            el.underline ? 'underline' : '',
            el.strikethrough ? 'line-through' : '',
        ].filter(Boolean).join(' ') || 'none',
        backgroundColor: el.highlight ?? undefined,
        textAlign: el.align ?? 'left',
        lineHeight: el.lineHeight ?? 1.2,
        letterSpacing: el.letterSpacing ? `${el.letterSpacing}px` : undefined,
        ...(hasBox
            ? { whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: 'block', width: '100%' }
            : { whiteSpace: 'nowrap' }),
        ...(editing ? { outline: 'none', cursor: 'text' } : {}),
    };

    return (
        <span
            ref={ref}
            contentEditable={editing}
            suppressContentEditableWarning
            onDoubleClick={onStartEdit}
            onBlur={(e) => onCommit(e.currentTarget.textContent ?? '')}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !hasBox) { e.preventDefault(); e.currentTarget.blur(); }
                else if (e.key === 'Escape') { e.currentTarget.textContent = el.content; e.currentTarget.blur(); }
            }}
            style={textStyle}
        >
            {editing ? null : el.content}
        </span>
    );
}

PdfTemplateEdit.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;

