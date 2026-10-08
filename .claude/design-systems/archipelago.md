# Archipelago Design System

This document is the single visual language for this application. Apply it to every page you build or redesign — match these tokens, layouts, and component patterns exactly. **Never invent a new color, spacing value, radius, or layout when one already exists here**; cross-app consistency matters more than local cleverness. Exact values (hex, px) are canonical; values marked † are inferred.

## Essence

A disciplined, professional financial interface built for clarity under pressure — every element earns its place. Speak in clean whites and deep darks anchored by a confident primary blue: institutional trust without coldness. Treat the two modes as one system — light is crisp and airy like a freshly printed ledger; dark is deep and focused like a lit workstation at night. **Let content type drive layout**: lists become tables, summaries become card grids, details become full-width slide-overs.

## Color

**Anchor the interface to one confident primary blue, and let gray do everything else.** Blue is a signal, not decoration — reserve it for active states, primary CTAs, and focus rings so it stays meaningful. Keep passive UI pure gray.

Use these blues for primary actions and active states:
- `primary-600` (`#2563eb`) — primary CTA buttons; active nav text (light)
- `primary-500` (`#3b82f6`) — active nav background (dark); income chart fill
- `primary-50` (`#eff6ff`) — active nav background (light); subtle tinted fills
- `primary-100`–`primary-400` (`#dbeafe`, `#bfdbfe`, `#93c5fd`, `#60a5fa`) — hover fills, icon-container backgrounds, accent borders, muted icons, in ascending strength
- `primary-700`/`primary-800` (`#1d4ed8`†, `#1e40af`†) — button hover and pressed states

**In light mode, build on white and separate with borders, not shadows.** Page background is `#f9fafb`; sidebar, header, cards, and modals are all pure white (`#ffffff`). Input wrappers are white with a gray ring.

**In dark mode, climb a 10-stop zinc scale where each surface layer owns exactly one stop.** Never hardcode a dark hex — always use the `dark-*` class:
- `dark-950` (`#09090a`) — body / main content
- `dark-900` (`#0f0f11`) — sidebar, secondary surfaces
- `dark-800` (`#141414`) — input field backgrounds
- `dark-700` (`#1a1a1d`) — cards, modals, slide-overs, dropdowns
- `dark-600` (`#3f3f46`) — borders, item hover background, disabled background
- `dark-500` (`#71717a`) — dividers
- `dark-400` (`#a1a1aa`) — icons, placeholders, muted labels
- `dark-300` (`#e4e4e7`) — primary body text
- `dark-200` (`#f4f4f5`) — headings, prominent text
- `dark-50` (`#fafafa`) — highest-contrast text on dark surfaces

These values live in `resources/css/app.css` as `--color-dark-*`; that file is canonical if the two ever disagree.

**Compose new components with these dark-mode class conventions:**
```
// Input / Select trigger
dark:bg-dark-800 dark:text-dark-300 dark:ring-dark-600 dark:placeholder-dark-400

// Dropdown panel / floating container
dark:bg-dark-700 dark:ring-white/10

// Dropdown item (normal)
dark:text-dark-300 dark:hover:bg-dark-600

// Border / separator
dark:border-dark-600

// Icon inside an input
dark:text-dark-400

// Disabled input
dark:bg-dark-600 dark:text-dark-500

// Label text
dark:text-dark-300
```

**Set text in a three-level hierarchy.** Body and table data use gray-900 (`#111827`) in light / `dark-200` (`#f4f4f5`) in dark. Labels, captions, and table headers drop to gray-600 / `dark-400`. Placeholders and hints are the quietest: gray-500† / `dark-500`. **Render every page `<h1>` as a clipped gradient** — `from-gray-900 via-blue-800 to-indigo-800` in light, `from-white via-blue-200 to-indigo-200` in dark. Sidebar section labels (`DATA MASTER`, `KEUANGAN`, …) are uppercase, small, gray, and non-interactive.

**Encode status with semantic badge colors** (solid background + tinted-50 text): Terkirim/sent → blue-600; Jatuh Tempo/overdue → red-600; Lunas/paid & Aktif/active → green-600; Sebagian/partial → yellow-600†; Draft → zinc-600 on white.

**Charts speak their own dialect:** income/Pemasukan in green-500 (`#22c55e`†), expense/Pengeluaran in red-500 (`#ef4444`†), grid lines at white/10%† in dark.

**Borders stay subtle:** cards use zinc-200 (`#e4e4e7`) in light / `white/8%` in dark; dropdowns use gray-100 / `white/8%`; the slide-over backdrop is `gray-400/75%` light / `black/30%` dark.

## Typography

**Set headings in Plus Jakarta Sans and everything else in Inter.** Headings and display text use `--font-heading` (Plus Jakarta Sans) at weights 600/700/800; body and UI use `--font-sans` (Inter) at 400/500/600/700. Reach for system mono† (400) only when monospace is genuinely needed. The heading font is applied globally by `app.css` (`h1, h2, h3, h4, h5, h6 { font-family: var(--font-heading); }`), so never set `font-heading` by hand on heading elements.

Match size and weight to the role:
- Page title `<h1>` — 36px / 700, with the clipped gradient (see Color)
- Widget title — 20px† / 700 — chart titles, card section headers
- Modal & panel title — 18px / 600 — slide-over headers, modal subtitles
- Body — 16px / 400 — button labels, general prose
- Label — 14px / 600 — form field labels, table column headers
- Small / nav — 14px / 400–500 — table data, nav item text
- Nav section — 11px† / 600, uppercase — sidebar group labels
- Badge / micro — 12px / 700 — status badges, frequency tags

Treat a few cases specially:
- Currency values: `font-bold text-2xl` inside stat cards; `font-semibold` inside tables.
- Negative values (e.g. Laba Kotor when negative): apply `text-red-500` to the value itself, never the whole card.
- Subtitles sit directly under the h1 in 16px regular, muted gray.

## Spacing & Layout

**Build every spacing value on a 4px base:** `space-1` 4px (icon–text gap), `space-2` 8px (badge padding, inline gaps), `space-3` 12px (card sub-element padding), `space-4` 16px (modal padding, field gaps), `space-6` 24px (section separation, stats-grid gap), `space-8` 32px (major layout separation).

**Use these page-level spacing and text-size conventions:**
- Root page container — `space-y-6`
- Filter section — `space-y-4`
- Stats grid gap — `gap-4`
- Filter grid gap — `gap-3`
- Section title — `text-xl font-semibold`
- Label / info text — `text-sm`
- Small / helper text — `text-xs`

Hold to these layout dimensions:
- Sidebar: 224px fixed, collapsible via a chevron toggle
- Header: ~64px tall†; page content padding ~24px on both axes†
- Stats grid: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4`
- Card grids (e.g. recurring): three columns on desktop, `gap-4`†
- Table search input: `w-64` (256px)
- Form modal: `max-w-xl` (576px) for full two-column forms
- Detail slide-over: full viewport height, ~80% viewport width†

## Elevation

**Use a binary radius system — no middle ground.** Apply `rounded-xl` (12px) to every container: cards, modals, slide-overs, dropdowns, icon containers. Apply `rounded-md` (6px) to every component: buttons, inputs, badges, frequency tags. The remaining stops are rare — `rounded-sm` (4px) for checkboxes and small tags†, and `rounded-lg` (8px) only for the active nav-item highlight.

**Lift surfaces sparingly:** cards rest on `shadow-sm` and rise to `shadow-md` on hover (`hover:shadow-md transition-shadow`); modals and slide-overs use a strong `shadow-xl`; the sidebar and header carry no shadow — separate them with a border only.

## Page Layout Patterns

The application uses distinct layout strategies depending on content type. Pick the one that fits the content, and build it as described.

**List pages (e.g. Invoices).** Build top to bottom. Start with a `PageHeader`: gradient h1 plus a muted subtitle on the left, primary action button on the right. Below it, lay out the stats row as `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4` and render each metric with `StatsCard` (1px colored top accent bar, uppercase tracked label, icon top-right, large value, one line of sub-text, hover tooltip). Next show a status pipeline bar — proportional `h-2 rounded-full` horizontal segments sized to each status count, clickable to filter — followed by underline-style status tabs with a per-status badge count. Then wrap the filter toolbar, table, and pagination in a single `Card`: toolbar in the header (`border-b`), table in the body, pagination in the footer (`border-t`, rendered only when `last_page > 1`). The toolbar holds a `Combobox` for client, a date-mode pill toggle, a `DatePicker` (`month` or `range`), a search `Input`, and a reset button carrying a `Badge` count. Make every table row fully clickable (`cursor-pointer`, `onClick → openDrawer`) and stop propagation on the actions cell. Render the client column as `Avatar` + `AvatarFallback` initials + name + type; the amount column as the value plus an inline progress bar for `partially_paid`; and the action column as a `DropdownMenu` behind a `MoreHorizontal` trigger (Lihat Detail / Edit / Cetak PDF / Hapus).

**Card-grid pages (e.g. Recurring Invoices).** Use this for collections of similar items. Give the header a gradient h1 + subtitle alongside summary badges (e.g. "14 aktif", "Rp 253,9jt"), then a pill/segment tab bar (Template | Bulanan | Analitik). Lay items out in a three-column desktop grid where each card is `rounded-xl`, bordered, on white / `dark-700`, showing client name, amount, date meta, and action buttons. Place a status badge top-right (e.g. a green "aktif" pill) and express date info as colored pills (orange for the next due date).

**Master-detail split (e.g. Bank Accounts).** Split the screen into two panes. The left pane is a scrollable account list (icon, name, bank name, balance) with a "Tambah Baru" affordance and a summary box (Total Saldo, Pemasukan, Pengeluaran, Arus Bersih); highlight the active account with a blue accent†. The right pane shows the selected account in full: name plus Pengeluaran/Pemasukan actions, period summary stats, two side-by-side charts (line + donut), then a transaction table.

**Slide-over detail (e.g. Invoice Detail).** Detail views are not centered modals — open a full-height right-side slide-over over a dimmed backdrop. Lead with three stat boxes (Tanggal Invoice / Jatuh Tempo / Laba Kotor), embed the line-items table in the body, then a payment/total block and a "Catat Pembayaran" action. Include a meta sidebar within the panel for Informasi Bisnis, Faktur (linked files), and a Timeline.

**Form modals (e.g. Transaction Creation).** Open with a header cluster of icon + title + short description. Split the body into two columns: required fields on the left (source account, category, amount, date), optional and supporting info on the right (description, reference number, transaction bank, file upload zone). Put Batal (zinc) on the left of the footer and a semantic submit on the right — green "Simpan Pemasukan" for income, red "Simpan Pengeluaran" for expense — so color signals intent before the user reads.

## Interactive States

**Primary buttons** sit at `#2563eb` with white text, 6px radius, 42px tall, 8px×16px padding; darken to `#1d4ed8`† on hover over 200ms; show a 3px primary ring on focus; and drop opacity with `cursor: not-allowed` when disabled.

**Choose button color by intent** — all variants share a 1px transparent border, 6px radius, 42px height, and 16px text:
- Blue (`primary-600`) — neutral default CTA ("Buat Invoice", "Catat Pembayaran")
- Green (green-500) — income / positive save ("Simpan Pemasukan")
- Red† (red-600) — expense / destructive save ("Simpan Pengeluaran")
- Zinc (zinc-500) — cancel / secondary ("Batal")

**Form inputs** wrap a transparent field (6px radius, 6px×12px padding, 14px text) under a label (14px / 600):
- Default: white bg + `ring-1` gray-300 (light) / `dark-800` bg + `ring` dark-600 (dark)
- Focus: `ring-2` primary-600 (light) / primary-500 (dark)
- Error†: `ring-2` red-500 (light) / red-400 (dark)

**Navigation links** stay quiet until active:
- Default: no background; text gray-600† (light) / `dark-400` (dark)
- Hover: bg gray-50† / `dark-600`; text gray-900† / `dark-200`
- Active: the entire row fills — `primary-50` bg + `primary-600` text at 8px radius (light); a solid `primary-500` row with near-white text (dark, much more prominent)

**Use two distinct tab bars by purpose.** For switching content modes (Templates / Bulanan / Analitik), use the pill/segment bar: container `bg-zinc-100 dark:bg-dark-700 rounded-xl border p-1`; active tab `bg-white dark:bg-dark-800 shadow-sm border rounded-lg`; inactive muted with a subtle hover. For status filtering on list pages (Semua / Draft / Terkirim / …), use the underline bar: container `flex items-center border-b`; active tab `border-b-2 -mb-px border-primary-600 dark:border-primary-400 text-primary-700`; inactive `border-transparent text-dark-500`; active badge `bg-primary-100 dark:bg-primary-900/30 text-primary-700`, inactive badge `bg-zinc-100 dark:bg-dark-700 text-dark-500`.

**For the month/range switch**, place a smaller pill toggle inline above the `DatePicker`: container `inline-flex p-0.5 bg-zinc-100 dark:bg-dark-700 rounded-lg border`; active `bg-white dark:bg-dark-800 shadow-sm rounded-md text-xs`; inactive `text-dark-500 text-xs`. It drives the `period_mode` URL param (`month` | `range`) and must preserve all other filters when switched.

## Motion

**Keep motion snappy and functional — transitions confirm state, they never entertain.** Stay in the 100–300ms range with Material-style easing and avoid theatrical entrances. Use three timings:
- Fast — 150ms `ease-out` — tab reveals, shadow changes
- Base — 200ms `cubic-bezier(0.4, 0, 0.2, 1)` — button hover, nav hover, card shadow
- Modal — 300ms `cubic-bezier(0.4, 0, 0.2, 1)` — slide-over open/close, backdrop fade

Apply these patterns: slide-overs and modals enter with `transform transition-all` (slide + fade) while the backdrop runs `transition-opacity`; tab content reveals with `ease-out duration-150` from `opacity-0 translate-y-1` to `opacity-100 translate-y-0`; cards lift on hover via `hover:shadow-md transition-shadow` with no positional movement.

## Design Principles

- **Layout follows content type** — lists get tables, collections of similar items get card grids, detail views get slide-over drawers. There is no one-size-fits-all layout.
- **Dual-mode parity** — every surface layer maps to its own stop on the 10-step `dark-*` scale (`#09090a` → `#fafafa`): body / sidebar / card / input / border.
- **Two radii, always** — `rounded-xl` for containers, `rounded-md` for components, enforced without exception.
- **Blue is a signal** — use primary blue only for active states, CTAs, and focus; keep passive UI pure gray so blue stays instantly meaningful.
- **Color encodes intent in forms** — the submit button's color states the direction before the user reads it: green = income, red = expense, blue = neutral create.

## Implementation Notes

**CSS custom properties (verified naming):** `--color-primary-{50–800}` (blue scale, hex), `--color-dark-{50–950}` (gray scale, hex), `--font-heading` (`"Plus Jakarta Sans", …`), `--font-sans` (`"Inter", …`), `--radius-{sm|md|lg|xl}` (4 / 6 / 8 / 12px).

**Stack:** Laravel 12 + Inertia.js + React 18 + shadcn/ui + Tailwind CSS v4. Sejak 25 Sep 2026 halaman baru mengikuti bagian **Obsidian** di bawah; bagian di atasnya menjelaskan halaman lama yang belum dimigrasi. Blade is used only for PDF templates (`resources/views/pdf/`), which do not use these tokens.

**Dark mode** uses the `class` strategy on `<html>`, toggled by the header moon button and persisted to `localStorage`.

**Tailwind v4 note:** computed colors come back as OKLCH/OKLab while custom properties return hex. Always reference class names in new code, never computed values.

**Map Archipelago tokens to shadcn/ui** when working in React:
- `bg-card` ← `bg-white dark:bg-dark-700`
- `bg-background` ← `bg-gray-50 dark:bg-dark-950`
- `text-foreground` ← `text-dark-900 dark:text-dark-50`
- `text-muted-foreground` ← `text-dark-600 dark:text-dark-400`
- `border` ← `border-zinc-200 dark:border-white/8`
- `primary` ← `primary-600` / `primary-500` (dark)
- Override shadcn's default `rounded-md` to `rounded-xl` for containers

**Cursor is global** — `app.css` already sets `cursor: pointer` on buttons, links, `[role="button"]`, `label[for]`, and `summary`. Do not add `cursor-pointer` to individual elements.
```css
button:not(:disabled),
a,
[role="button"]:not([aria-disabled="true"]),
label[for],
summary {
    cursor: pointer;
}
```

**Make table rows clickable** by adding `onClick` + `cursor-pointer` to the `<tr>`, and `onClick={(e) => e.stopPropagation()}` to the actions cell so the row click doesn't fire when the dropdown is used.

**Icons:** `lucide-react` in React pages and components.

**Render the gradient page heading like this:**
```tsx
<h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-indigo-800 dark:from-white dark:via-blue-200 dark:to-indigo-200 bg-clip-text text-transparent">
  Page Title
</h1>
```

**Build stat cards** as a three-row vertical layout with a colored top accent bar and a tooltip, and wrap the grid in `<TooltipProvider delayDuration={300}>`:
```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <Card className="hover:shadow-md transition-all duration-200 overflow-hidden cursor-default">
      <div className="bg-blue-500 h-1" />   {/* colored accent bar — 1px top stripe */}
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-dark-500 dark:text-dark-400 leading-none">
            Label
          </p>
          <span className="text-blue-500 dark:text-blue-400 shrink-0"><Icon className="w-5 h-5" /></span>
        </div>
        <p className="text-xl font-bold text-dark-900 dark:text-dark-50 leading-none">Value</p>
        <p className="text-xs text-dark-500 dark:text-dark-400 mt-2">Sub-text (concise context)</p>
      </CardContent>
    </Card>
  </TooltipTrigger>
  <TooltipContent side="bottom" className="max-w-56 text-center">
    Full explanation of what this metric shows
  </TooltipContent>
</Tooltip>
```

Pick the accent + icon color by role: revenue/total → `bg-blue-500` / `text-blue-500`; profit/positive → `bg-emerald-500` (red if negative) / `text-emerald-500`; payments received → `bg-green-500` / `text-green-500`; count/quantity → `bg-purple-500` / `text-purple-500`.

**Color the form submit button by action:**
```tsx
// Income action
<Button className="bg-green-500 hover:bg-green-600 text-white">Simpan Pemasukan</Button>
// Expense action
<Button className="bg-red-600 hover:bg-red-700 text-white">Simpan Pengeluaran</Button>
// Neutral create
<Button>Buat Invoice</Button> {/* uses default primary */}
```

## React Component Catalog Compliance (MANDATORY)

**CRITICAL — check this before writing any interactive element in a React page.** Before you render a form control or UI primitive, consult the catalog in `CLAUDE.md` → "React Component Catalog". If a catalog component covers the case, **use it — no exceptions.** Write raw HTML or a custom component only when the catalog has no equivalent, and only after telling the user about the gap.

This rule exists because every catalog component is pre-styled to Archipelago tokens (colors, radii, dark mode, error states); writing raw HTML duplicates that work and drifts out of sync. A past incident shipped `<input type="file">` and custom segmented buttons across nine forms that all had catalog equivalents (`FileUpload`, `SegmentedControl`).

**Always substitute the catalog component for the raw element:**
- Text / number input → `Input`, never raw `<input>`
- Multi-line text → `Textarea`, never raw `<textarea>`
- Rupiah / currency → `CurrencyInput`, never `Input` or `<input>`
- Select from a list → `Combobox`, never `<select>` or shadcn's `Select` primitive
- Single date → `DatePicker`, never `<input type="date">`
- Date range → `DatePicker mode="range"`, never two separate pickers
- On/off toggle → `Switch`, never a hand-styled checkbox
- Color picker / hex input → `ColorInput`, never `<input type="color">` or a custom swatch
- Numeric range / slider → `Slider`, never `<input type="range">`
- Yes / no checkbox → `Checkbox`, never raw `<input type="checkbox">`
- File / attachment → `FileUpload`, never `<input type="file">` or a custom drop zone
- Exclusive choice (radio / segment) → `SegmentedControl`, never a custom button group
- Destructive confirm → `ConfirmDialog`, never `window.confirm()` or inline warnings
- Page header → `PageHeader`, never raw `<h1>` + `<p>`
- Stats card → `StatsCard` (`inModal` when inside a modal), never a custom card div
- Form section heading → `FormSection`, never a raw `<h4>` divider
- Data table → `DataTable`, never a raw `<table>`
- Empty state → `EmptyState`, never custom conditional JSX
- Pagination → `Pagination`, never custom prev / next buttons
- Tabs → `Tabs` + `TabsPanel`, never custom pill buttons
- Modal → `Dialog` + subcomponents, never a `<div>` overlay or raw `AlertDialog`
- Dropdown menu → `DropdownMenu` + subcomponents, never hand-positioned menus
- Tooltip → `TooltipProvider` + `Tooltip`, never the `title=""` attribute
- Status label → `Badge` (pick the variant), never a `<span>` with hardcoded colors
- Action button → `Button` (pick the variant), never raw `<button>`

**Reach for `SegmentedControl` for any exclusive choice** (the radio-button replacement): use `layout="stack"` (icon above label, taller card) for form fields whose choices carry meaning (feedback type, priority, transaction direction); use `layout="inline"` (compact single row) for in-line selectors; set width with `columns` (2–6); and give each option its own color via `activeClassName`.
```tsx
// Example — feedback type picker (stack, 3 cols, per-option color)
const TYPE_OPTIONS: SegmentedOption<FeedbackType>[] = [
    { value: 'bug', label: 'Bug Report', icon: <Bug className="w-4 h-4" />, activeClassName: 'bg-red-500 ...' },
    { value: 'feature', label: 'Fitur Baru', icon: <Lightbulb className="w-4 h-4" />, activeClassName: 'bg-blue-500 ...' },
    { value: 'improvement', label: 'Perbaikan', icon: <Wrench className="w-4 h-4" />, activeClassName: 'bg-amber-500 ...' },
];
<SegmentedControl options={TYPE_OPTIONS} value={data.type} onChange={(v) => setData('type', v)} columns={3} layout="stack" label="Tipe *" error={errors.type} />
```

**Reach for `FileUpload` (`@/components/shared/file-upload`) for every file input.** In a new form pass `value` / `onChange` / `accept` / `maxSizeMb`; in an edit form also pass `existingFileName`, `existingFileUrl`, and `onRemoveExisting` so the saved file is visible and replaceable.
```tsx
// Edit form with existing attachment
<FileUpload
    value={data.attachment}
    onChange={(file) => setData('attachment', file)}
    accept={['.jpg', '.jpeg', '.png', '.pdf']}
    maxSizeMb={5}
    error={errors.attachment}
    existingFileName={hasExisting ? row.attachment_name : null}
    existingFileUrl={hasExisting ? row.attachment_url : null}
    onRemoveExisting={() => setData('remove_attachment', true)}
/>
```

**When the catalog has no equivalent:** do not silently write custom inline UI. Tell the user ("There is no catalog component for X — should I create a reusable `ComponentName` in `@/components/ui/` first?"), and if they agree, build a properly styled, reusable component and add it to the CLAUDE.md catalog before using it anywhere. This keeps one-off UI from accumulating across the codebase.


---

## Obsidian (redesign 25 Sep 2026) — berlaku untuk halaman & komponen baru

Gaya "dark soft-surface": permukaan berlapis, tepi 1 px tembus, satu aksen biru, tanpa bayangan dan tanpa gradient. Mockup final ada di kanvas desain "Kisantra Dashboard Redesign" (artboard Layout, Dashboard, Komponen, Navigasi, Grafik, Terang). Halaman yang memakainya: Ringkasan (`resources/js/pages/dashboard.tsx`), rel navigasi (`layouts/sidebar.tsx`), header (`layouts/header.tsx`), Invoice, Pengaturan, dan Reimbursement (daftar + drawer `#reimbursement/{id}`). Halaman lain dimigrasi bertahap; jangan mencampur dua gaya dalam satu halaman.

### Token (satu set variabel, dua nilai per tema)

Didefinisikan di `resources/css/app.css` sebagai `--ob-*` pada `:root` (terang) dan `.dark` (gelap), lalu dipetakan ke kelas Tailwind lewat `@theme inline`. **Selalu pakai kelasnya, jangan hex.**

| Kelas | Peran | Terang | Gelap |
|-------|-------|--------|-------|
| `bg-ob-page` | latar halaman | #F6F6F8 | #0B0B0D |
| `bg-ob-rail` | rel navigasi, kontrol header | #EFEFF2 | #0F0F12 |
| `bg-ob-card` | kartu | #FFFFFF | #151518 |
| `bg-ob-inner` | kartu-dalam (baris, input) | #F1F1F4 | #1C1C21 |
| `bg-ob-chip` | chip / tile ikon | #E4E4E9 | #26262C |
| `bg-ob-hover` | hover baris | #E9E9EE | #22222A |
| `text-ob-ink` / `-ink-2` / `-ink-3` | teks utama / sekunder / paling redup (≥ 5:1) | #141416 / #52525C / #66666F | #F2F2F3 / #A3A3AB / #8B8B95 |
| `border-ob-line` / `-line-soft` / `-line-strong` | tepi 8% / 6% / 14% | hitam | putih |
| `bg-ob-invert` + `text-ob-invert-ink` | pil aktif (rel, pil bersegmen) | hitam / putih | putih / hitam |
| `text-ob-pos` · `-neg` · `-wait` · `-late` · `-act` | masuk/lunas · keluar/jatuh tempo dekat · menunggu · lewat tempo · aktif/terkirim | #047857 · #C2410C · #854D0E · #B91C1C · #1D4ED8 | #34D399 · #FB923C · #FBBF24 · #F87171 · #60A5FA |
| `bg-ob-act-fill` | tombol primer, hari ini | #2563EB | #2563EB |
| `bg-ob-badge` + `text-ob-badge-ink` | badge hitungan menunggu | #F59E0B | #FBBF24 |

Chip status = latar `bg-ob-<tone>/12` + teks `text-ob-<tone>` + titik (status final: ikon centang/silang). **Tiap hue satu makna**; ungu tidak dipakai; kategori (donat) memakai ramp netral satu hue, bukan warna semantik.

### Aturan bentuk

- **Radius**: kartu `rounded-3xl` (24), kartu-dalam `rounded-2xl` (16), kontrol `rounded-xl` (12), tile ikon `rounded-lg` (8), pil `rounded-full`. Tidak ada nilai lain.
- **Kartu**: padding 22 px, header 32 px (judul 16/600 + hitungan 13/500 `text-ob-ink-2`) agar baseline sejajar antar kartu; komponen `Widget` di `components/dashboard/widget.tsx`.
- **Tinggi tetap di xl**; di bawah xl kartu mengikuti isi. Daftar dinamis menggulir di dalam kartu (`ScrollList`: viewport kelipatan baris persis, `tabindex=0`, `aria-label "N item, dapat digulir"`, fade 12 px hanya saat masih ada sisa). Hitungan "3 dari N" di header.
- **Tipografi**: satu keluarga, Plus Jakarta Sans (400–800), `font-variant-numeric: tabular-nums` global. Judul halaman 26/600 tanpa gradient; angka pahlawan 40/600; teks minimum 12 px. `PageHeader` bergradient hanya untuk halaman lama.
- **Tepi**, bukan bayangan; tepi putus-putus hanya untuk placeholder/state kosong; tekstur garis miring (`.ob-hatch`) = pengeluaran / di luar rentang.
- **Navigasi**: rel 76 px (ikon grup + badge) ↔ 260 px (ikon + panel label, pil jembatan untuk grup aktif, satu grup terbuka, kartu ruang kerja dengan pengalih tema); pintasan `[`. Header: breadcrumb kiri, kontrol pil `bg-ob-rail` kanan, tanpa garis bawah.
- **Gerak**: 150–220 ms ease-out; `ob-fade-in` untuk flyout/sub-menu; semua dimatikan pada `prefers-reduced-motion` (`.ob-motion`).
- **State wajib** per widget: kosong (`WidgetEmpty`: judul, satu kalimat, satu aksi), gagal (`WidgetError` + "Coba lagi", per widget bukan per halaman), memuat (skeleton berbentuk baris, bukan spinner).
- **Aksesibilitas**: ikon-saja wajib `aria-label`; grafik menyertakan tabel `sr-only`; arah uang lewat tanda `+`/`−` dan ikon, warna hanya redundansi; fokus = cincin 2 px `ob-act-fill`.
- **Ponsel (≥ 360 px) tanpa geser samping** (perbaikan 8 Okt 2026):
  - wadah gulir tabel wajib `relative` — teks `sr-only` di `<th>` berposisi absolut dan, tanpa itu, lolos dari pemotongan lalu melebarkan `<main>`;
  - tabel `sr-only` (mis. data grafik) dibungkus `<div className="sr-only">` karena tabel tidak bisa dipaksa selebar 1 px;
  - grup pil status = satu baris yang bisa digeser: `ob-no-scrollbar flex max-w-full overflow-x-auto` + pil `shrink-0 whitespace-nowrap`, induk flex-nya `min-w-0 max-w-full`;
  - kepala `Widget` memakai `min-h-8 flex-wrap` agar aksi boleh turun baris;
  - daftar data di bawah `md` memakai daftar bertumpuk (judul + nominal / meta + status), tabel mulai `md` (contoh: Reimbursement).
