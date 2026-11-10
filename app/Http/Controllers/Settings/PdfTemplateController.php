<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\CustomFont;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\PdfTemplate;
use App\Services\ItemColumns;
use App\Services\TemplateTokens;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

class PdfTemplateController extends Controller
{
    public function index(): InertiaResponse
    {
        $templates = PdfTemplate::query()
            ->orderByDesc('is_default')
            ->orderBy('name')
            ->get()
            ->map(fn (PdfTemplate $t) => [
                'id' => $t->id,
                'name' => $t->name,
                'description' => $t->description,
                'is_default' => $t->is_default,
                'updated_at' => $t->updated_at?->toISOString(),
            ]);

        return Inertia::render('settings/pdf-templates/index', [
            'templates' => $templates,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:500'],
        ]);

        $template = PdfTemplate::query()->create([
            'name' => $request->input('name'),
            'description' => $request->input('description'),
            'layout' => [],
            'is_default' => false,
        ]);

        return redirect()->route('settings.pdf-templates.edit', $template)
            ->with('success', __('Template berhasil dibuat.'));
    }

    public function update(Request $request, PdfTemplate $pdfTemplate): RedirectResponse
    {
        $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_default' => ['nullable', 'boolean'],
        ]);

        $pdfTemplate->update([
            'name' => $request->input('name'),
            'description' => $request->input('description'),
        ]);

        if ($request->boolean('is_default')) {
            $pdfTemplate->setAsDefault();
        }

        return redirect()->back()->with('success', __('Template berhasil diperbarui.'));
    }

    public function destroy(PdfTemplate $pdfTemplate): RedirectResponse
    {
        $adalahDefault = (bool) $pdfTemplate->is_default;

        $pdfTemplate->delete();

        // Menghapus template default dulu menyisakan keadaan "tidak ada default
        // sama sekali" — invarian "hanya satu default" tidak dilanggar, tetapi
        // keadaan itu juga tidak pernah dibahas dan membuat unduhan invoice
        // kehilangan acuan. Promosikan template tertua yang tersisa.
        if ($adalahDefault) {
            PdfTemplate::query()->orderBy('id')->first()?->update(['is_default' => true]);
        }

        return redirect()->route('settings.pdf-templates.index')
            ->with('success', __('Template berhasil dihapus.'));
    }

    public function duplicate(PdfTemplate $pdfTemplate): RedirectResponse
    {
        $copy = PdfTemplate::query()->create([
            'name' => $pdfTemplate->name.' (Salinan)',
            'description' => $pdfTemplate->description,
            'layout' => $pdfTemplate->layout ?? [],
            'is_default' => false,
        ]);

        return redirect()->route('settings.pdf-templates.edit', $copy)
            ->with('success', __('Template berhasil diduplikat.'));
    }

    public function setDefault(PdfTemplate $pdfTemplate): RedirectResponse
    {
        $pdfTemplate->setAsDefault();

        return redirect()->back()->with('success', __('Template bawaan berhasil diubah.'));
    }

    /**
     * Editor page — passes token catalog + resolved sample data to the frontend.
     */
    public function edit(PdfTemplate $pdfTemplate): InertiaResponse
    {
        // Isi kanvas (nilai token, baris item, terbilang, tanggal) adalah ISI DOKUMEN → selalu Bahasa
        // Indonesia (K2). Katalog palet/inspector di bawah adalah UI → ikut bahasa pengguna.
        [$sampleData, $sampleItems] = withDocumentLocale(function (): array {
            $invoice = $this->resolvePreviewInvoice();

            return [
                TemplateTokens::buildMap($invoice),
                // Build resolved sample rows for the table element Preview mode.
                ItemColumns::resolveItems(ItemColumns::defaultColumns(), $invoice->items),
            ];
        });

        // Sprint 5b: global custom font library for the editor font picker.
        $customFonts = CustomFont::query()
            ->orderBy('name')
            ->get()
            ->map(fn (CustomFont $f) => [
                'id' => $f->id,
                'name' => $f->name,
                'url' => $f->browserUrl(),
            ])
            ->all();

        return Inertia::render('settings/pdf-templates/edit', [
            'template' => [
                'id' => $pdfTemplate->id,
                'name' => $pdfTemplate->name,
                'layout' => $pdfTemplate->layout ?? [],
            ],
            'tokenCatalog' => TemplateTokens::catalogForFrontend(),
            'sampleData' => $sampleData,
            'itemColumnCatalog' => ItemColumns::catalogForFrontend(),
            'sampleItems' => $sampleItems,
            'customFonts' => $customFonts,
        ]);
    }

    public function save(Request $request, PdfTemplate $pdfTemplate): RedirectResponse
    {
        $layout = $request->input('layout');

        // Banded layout: { paper: {...}, bands: { header, content, footerFlow, footerFixed } }
        if (is_array($layout) && array_key_exists('bands', $layout)) {
            $request->validate([
                'layout' => ['present', 'array'],
                'layout.paper' => ['required', 'array'],
                'layout.paper.margins' => ['required', 'array'],
                'layout.paper.margins.top' => ['required', 'numeric', 'min:0'],
                'layout.paper.margins.right' => ['required', 'numeric', 'min:0'],
                'layout.paper.margins.bottom' => ['required', 'numeric', 'min:0'],
                'layout.paper.margins.left' => ['required', 'numeric', 'min:0'],
                'layout.bands' => ['required', 'array'],
                'layout.bands.header' => ['required', 'array'],
                'layout.bands.content' => ['required', 'array'],
                'layout.bands.footerFlow' => ['required', 'array'],
                'layout.bands.footerFixed' => ['required', 'array'],
            ]);
        } else {
            // Legacy flat-array layout — lenient, accept as-is.
            $request->validate([
                'layout' => ['present', 'array'],
            ]);
        }

        $pdfTemplate->update([
            'layout' => $layout,
        ]);

        return back()->with('success', __('Layout tersimpan.'));
    }

    /**
     * Render template as PDF, resolving tokens against a real Invoice.
     *
     * Route: GET /settings/pdf-templates/{template}/pdf/{invoice?}
     * - Invoice param provided → use that invoice.
     * - No param → latest invoice in DB.
     * - DB empty → in-memory sample (never crashes).
     *
     * B3: branches on banded vs legacy layout.
     *   Banded  → resolves band elements + table, passes $banded=true + band vars.
     *   Legacy  → maps flat elements array (unchanged behaviour).
     */
    public function pdf(Request $request, PdfTemplate $pdfTemplate, ?Invoice $invoice = null): HttpResponse
    {
        $invoice = $invoice ?? $this->resolvePreviewInvoice();

        // Sprint 5b: pass custom fonts so the blade can emit @font-face for DomPDF.
        $customFonts = CustomFont::query()
            ->orderBy('name')
            ->get()
            ->map(fn (CustomFont $f) => [
                'name' => $f->name,
                'path' => $f->diskPath(),
            ])
            ->all();

        $layout = $pdfTemplate->layout ?? [];

        // ── B3: Banded layout path ────────────────────────────────────────────
        if (is_array($layout) && array_key_exists('bands', $layout)) {
            // B5: optional ?items=N for preview-with-N sample rows (clamp 1–200).
            $itemCount = $request->has('items')
                ? max(1, min(200, (int) $request->query('items')))
                : null;

            return $this->pdfBanded($layout, $invoice, $customFonts, $itemCount);
        }

        // ── Legacy flat-array path (unchanged) ───────────────────────────────
        $elements = collect($layout)
            ->map(function (array $el) use ($invoice): array {
                if ($el['type'] === 'text') {
                    return [
                        ...$el,
                        'content' => TemplateTokens::resolveText((string) ($el['content'] ?? ''), $invoice),
                    ];
                }

                if ($el['type'] === 'table') {
                    $columns = $el['columns'] ?? ItemColumns::defaultColumns();
                    $rows = ItemColumns::resolveItems($columns, $invoice->items);

                    return [
                        ...$el,
                        'columns' => $columns,
                        'rows' => $rows,
                    ];
                }

                if ($el['type'] === 'grid') {
                    // Resolve {{tokens}} in every cell's text — single resolve path.
                    $cells = collect($el['cells'] ?? [])->map(
                        fn (array $row) => array_map(
                            fn (array $cell) => [
                                ...$cell,
                                'text' => TemplateTokens::resolveText((string) ($cell['text'] ?? ''), $invoice),
                            ],
                            $row
                        )
                    )->all();

                    return [
                        ...$el,
                        'cells' => $cells,
                    ];
                }

                // image — pass through unchanged
                return $el;
            })
            ->all();

        return Pdf::loadView('pdf.template-builder', [
            'elements' => $elements,
            'customFonts' => $customFonts,
        ])
            ->setPaper('A4', 'portrait')
            ->stream('template.pdf');
    }

    /**
     * Render a banded layout to PDF (B3/B5).
     *
     * Resolves:
     *  - header.elements  → tokens in text content + grid cell text
     *  - content.table    → columns + rows via ItemColumns
     *  - footerFlow.elements → same as header
     *  footerFixed + header.repeat are passed through for B4.
     *
     * B5: when $itemCount is set, the content table is rendered with $itemCount
     * generated in-memory sample rows instead of the real invoice's items.
     * Header/footer tokens still resolve from $invoice (real or sample).
     *
     * @param  array<string, mixed>  $layout
     * @param  array<int, array{name: string, path: string}>  $customFonts
     */
    private function pdfBanded(array $layout, Invoice $invoice, array $customFonts, ?int $itemCount = null): HttpResponse
    {
        $bands = $layout['bands'] ?? [];
        $paper = $layout['paper'] ?? [];
        $margins = $paper['margins'] ?? ['top' => 40, 'right' => 40, 'bottom' => 40, 'left' => 40];

        // Resolve a band's elements array (text tokens + grid cell tokens; images pass through).
        $resolveElements = function (array $elements) use ($invoice): array {
            return array_map(function (array $el) use ($invoice): array {
                if (($el['type'] ?? '') === 'text') {
                    return [
                        ...$el,
                        'content' => TemplateTokens::resolveText((string) ($el['content'] ?? ''), $invoice),
                    ];
                }

                if (($el['type'] ?? '') === 'grid') {
                    $cells = collect($el['cells'] ?? [])->map(
                        fn (array $row) => array_map(
                            fn (array $cell) => [
                                ...$cell,
                                'text' => TemplateTokens::resolveText((string) ($cell['text'] ?? ''), $invoice),
                            ],
                            $row
                        )
                    )->all();

                    return [...$el, 'cells' => $cells];
                }

                return $el; // image, rect, line — pass through
            }, $elements);
        };

        // Header band
        $headerBand = $bands['header'] ?? [];
        $headerHeight = (int) ($headerBand['height'] ?? 180);
        $headerElements = $resolveElements($headerBand['elements'] ?? []);
        $headerRepeat = (bool) ($headerBand['repeat'] ?? false);

        // Content band — items table (null if not set)
        $contentBand = $bands['content'] ?? [];
        $tableEl = $contentBand['table'] ?? null;
        $trbItems = null; // InvoiceItem collection for TRB row-band renderer

        if ($tableEl !== null) {
            // B5: when $itemCount is set, generate that many in-memory sample rows.
            if ($itemCount !== null) {
                $items = $this->makeSampleItems($itemCount);
            } else {
                $items = $invoice->items;
            }

            // TRB detection: new row-band model has a 'rows' array instead of 'columns'.
            $isTrb = isset($tableEl['rows']) && is_array($tableEl['rows']);

            if ($isTrb) {
                // Pass the InvoiceItem collection through to the blade renderer.
                // The $renderRowBandTable closure resolves {{item.*}} tokens per-row.
                $trbItems = $items;
            } else {
                // Legacy column-based path — resolve all items to a flat array of strings.
                $columns = $tableEl['columns'] ?? ItemColumns::defaultColumns();
                $rows = ItemColumns::resolveItems($columns, $items);
                $tableEl = [
                    ...$tableEl,
                    'columns' => $columns,
                    'rows' => $rows,
                ];
            }
        }

        // Footer-flow band
        $footerFlowBand = $bands['footerFlow'] ?? [];
        $footerFlowHeight = (int) ($footerFlowBand['height'] ?? 120);
        $footerFlowElements = $resolveElements($footerFlowBand['elements'] ?? []);

        // Footer-fixed band (B4 — resolve tokens + render as position:fixed)
        $footerFixedRaw = $bands['footerFixed'] ?? [];
        $footerFixedHeight = (int) ($footerFixedRaw['height'] ?? 0);
        $footerFixedBand = [
            'height' => $footerFixedHeight,
            'elements' => $resolveElements($footerFixedRaw['elements'] ?? []),
        ];

        return Pdf::loadView('pdf.template-builder', [
            // Banded path signal
            'banded' => true,
            // Paper
            'paper' => ['margins' => $margins],
            // Header band
            'headerBand' => [
                'height' => $headerHeight,
                'repeat' => $headerRepeat,
                'elements' => $headerElements,
            ],
            // Content / items table
            'tableEl' => $tableEl,
            // TRB: InvoiceItem collection for row-band renderer (null for legacy path)
            'trbItems' => $trbItems,
            // Footer-flow band
            'footerFlowBand' => [
                'height' => $footerFlowHeight,
                'elements' => $footerFlowElements,
            ],
            // Footer-fixed (B4 — rendered as position:fixed bottom, every page)
            'footerFixedBand' => $footerFixedBand,
            // Custom fonts
            'customFonts' => $customFonts,
            // Legacy $elements must be present so the blade @else path doesn't error
            'elements' => [],
        ])
            ->setPaper('A4', 'portrait')
            ->stream('template.pdf');
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Generate N in-memory InvoiceItem instances for the "preview with N items" feature (B5).
     *
     * Items are representative enough to render all standard columns:
     *   No · Deskripsi · Qty · Satuan · Harga Satuan · Jumlah
     *
     * @return Collection<int, InvoiceItem>
     */
    private function makeSampleItems(int $count): Collection
    {
        $services = [
            'Konsultasi IT',
            'Pengembangan Fitur',
            'Desain UI/UX',
            'Hosting & Domain',
            'Pemeliharaan Bulanan',
            'Pelatihan Pengguna',
            'Audit Sistem',
            'Integrasi API',
            'Backup & Recovery',
            'Laporan Bulanan',
        ];

        $units = ['jam', 'paket', 'bulan', 'unit', 'ls', 'hari'];

        return collect(range(1, $count))->map(function (int $i) use ($services, $units): InvoiceItem {
            $unitPrice = ($i % 5 + 1) * 250000;
            $qty = ($i % 3 + 1);
            $amount = $unitPrice * $qty;

            return new InvoiceItem([
                'invoice_id' => 0,
                'service_name' => ($services[($i - 1) % count($services)]).' '.($i > count($services) ? '#'.ceil($i / count($services)) : ''),
                'quantity' => number_format($qty, 3, '.', ''),
                'unit' => $units[($i - 1) % count($units)],
                'unit_price' => $unitPrice,
                'amount' => $amount,
                'cogs_amount' => (int) ($amount * 0.4),
                'is_tax_deposit' => $i % 10 === 0,
            ]);
        });
    }

    /**
     * Auto-pick the latest invoice (with client eager-loaded) for preview/PDF.
     * Falls back to an in-memory sample when the DB has no invoices yet.
     */
    private function resolvePreviewInvoice(): Invoice
    {
        $invoice = Invoice::with(['client', 'payments', 'items'])
            ->latest()
            ->first();

        return $invoice ?? TemplateTokens::sampleInvoice();
    }
}
