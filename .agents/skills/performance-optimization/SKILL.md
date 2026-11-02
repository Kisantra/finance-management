---
name: performance-optimization
description: Use when asked to optimize, improve performance, or fix slow pages; or when auditing translation/localization (hardcoded strings, missing lang keys, $headers pattern); or when implementing charts in Livewire components; or when writing any code that touches the database (queries, models, migrations). Keywords: optimasi, lambat, slow, performa, query optimization, translation, translasi, hardcode, lang, localization, chart, grafik, chartjs, alpine chart, dashboard, database, query, migration, schema, N+1, eager loading.
---

# Performance Optimization & Chart Protocol

Panduan lengkap untuk optimasi performa Livewire, implementasi chart yang benar, penggunaan Laravel Boost untuk database investigation, dan audit kualitas kode di project ini.

## Kapan Skill Ini Digunakan

- User meminta "optimasi halaman X" / "optimize page X"
- User melaporkan halaman lambat atau ada N+1 query
- User ingin menambahkan chart/grafik di Livewire component
- User melaporkan chart tidak muncul atau error
- User meminta review performa query
- User meminta audit translasi / hardcoded string
- **Setiap menulis query, migration, atau kode yang akses database** — gunakan Boost tools untuk verifikasi

---

## BAGIAN A — Laravel Boost: Database Investigation Protocol

**Gunakan Boost tools sebelum menulis atau mengubah query apapun.** Tools ini jauh lebih akurat daripada asumsi dari kode saja, dan menghemat waktu debugging.

### A1. `database-schema` — Sebelum Query atau Migration

Selalu cek struktur tabel sebelum menulis JOIN, filter, index, atau migration:

```
Tool: mcp__laravel-boost__database-schema
```

Ini mencegah error seperti `Unknown column 'client_id'` karena nama kolom berbeda dari asumsi (contoh: `billed_to_id` bukan `client_id`).

**Kapan wajib:** Setiap kali akan JOIN tabel, tambah kolom, buat migration baru, atau tidak yakin nama kolom.

### A2. `database-query` — Verifikasi Data Aktual

Untuk memastikan query menghasilkan data yang benar sebelum mengubah kode PHP:

```
Tool: mcp__laravel-boost__database-query
Query: SELECT COUNT(*), transaction_type FROM bank_transactions GROUP BY transaction_type
```

**Kapan wajib:** Sebelum membuat computed property baru yang mengagregasi data, untuk verify apakah data ada di DB.

### A3. `tinker` — Test Eloquent Query

Untuk test apakah eager loading atau computed property berjalan dengan benar:

```
Tool: mcp__laravel-boost__tinker
Code: BankAccount::with(['payments','transactions'])->first()->balance
```

**Kapan wajib:** Saat membangun query Eloquent yang kompleks — test dulu sebelum apply ke komponen.

### A4. `last-error` — Saat Ada Error PHP/Laravel

Ketika ada error Laravel/PHP, cek ini terlebih dahulu — jauh lebih informatif dari browser log:

```
Tool: mcp__laravel-boost__last-error
```

### A5. Auto-Check Logs Setelah Setiap Implementasi

**Wajib dilakukan setelah selesai membuat/mengubah kode.** Jangan tunggu user melaporkan error — aktif cek sendiri agar user tidak perlu testing manual.

Jalankan ketiganya secara paralel:

```
Tool 1: mcp__laravel-boost__browser-logs (entries: 15)
→ JS errors, Alpine errors, Livewire frontend errors

Tool 2: mcp__laravel-boost__last-error
→ PHP exceptions, Laravel errors, database errors

Tool 3: mcp__laravel-boost__read-log-entries (entries: 10)
→ Application log (warning, error level)
```

Jika ada error baru yang timestamp-nya setelah implementasi dimulai, perbaiki sebelum menyampaikan hasil ke user. Sampaikan ke user hanya jika ada error yang ditemukan (jika bersih, cukup konfirmasi singkat).

---

## BAGIAN B — Query Optimization

### Step 1 — Identifikasi File Target

Setiap page terdiri dari pasangan PHP + Blade:

```
app/Livewire/{Module}/{Component}.php
resources/views/livewire/{module}/{component}.blade.php
```

Baca **semua** PHP component di module tersebut. Fokus pada file PHP karena query ada di sana.

### Step 2 — Scan Pola Bermasalah

#### 2a. Query Duplikasi

```php
// BAD: rows() dan totalX() punya WHERE clause identik
#[Computed]
public function rows() {
    return Model::where('type', 'debit')->when($this->search, ...)->paginate();
}
#[Computed]
public function totalAmount() {
    return Model::where('type', 'debit')->when($this->search, ...)->sum('amount'); // DUPLIKAT
}

// GOOD: Extract ke shared method
private function getFilteredQuery(): Builder {
    return Model::where('type', 'debit')->when($this->search, ...);
}
#[Computed] public function rows() { return $this->getFilteredQuery()->paginate(); }
#[Computed] public function totalAmount() { return (int) $this->getFilteredQuery()->sum('amount'); }
```

#### 2b. `whereHas` → JOIN

`whereHas` menghasilkan correlated subquery. Untuk filter sederhana, JOIN lebih efisien:

```php
// BAD
BankTransaction::whereHas('category', fn($q) => $q->where('type', 'expense'))

// GOOD
BankTransaction::query()
    ->join('transaction_categories', 'bank_transactions.category_id', '=', 'transaction_categories.id')
    ->where('transaction_categories.type', 'expense')
    ->select('bank_transactions.*') // PENTING: hindari column ambiguity
```

**Selalu prefix column dengan table name saat JOIN** — gunakan `database-schema` untuk konfirmasi nama kolom.

#### 2c. N+1 di Loop

```php
// BAD: Query per item
foreach ($this->selected as $id) { Model::find($id)?->delete(); }

// GOOD: Batch operation
Model::whereIn('id', $this->selected)->delete();
```

#### 2d. PHP Collection Processing → SQL Aggregation

```php
// BAD: Load semua record ke PHP
$transactions = Transaction::with('category')->get();
$grouped = collect($transactions)->groupBy('category.label')->map->sum('amount');

// GOOD: GROUP BY di SQL
DB::table('transactions')->join('categories', ...)
    ->selectRaw('categories.label as category, SUM(amount) as total')
    ->groupBy('categories.label')->get();
```

#### 2e. Multiple Queries per Period → Batch + CASE WHEN

```php
// BAD: Query per bulan × tipe = banyak query
foreach ($months as $month) {
    $income = Transaction::whereBetween('date', ...)->where('type', 'credit')->sum('amount');
    $expense = Transaction::whereBetween('date', ...)->where('type', 'debit')->sum('amount');
}

// GOOD: 1 query GROUP BY + CASE WHEN
BankTransaction::select(
    DB::raw('YEAR(transaction_date) as yr'),
    DB::raw('MONTH(transaction_date) as mo'),
    DB::raw("SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE 0 END) as income"),
    DB::raw("SUM(CASE WHEN transaction_type = 'debit' THEN amount ELSE 0 END) as expenses"),
)->whereBetween('transaction_date', [$start, $end])
    ->groupBy('yr', 'mo')->orderBy('yr')->orderBy('mo')->get();
```

#### 2f. N+1 pada Accessor yang Query DB

```php
// BAD: Accessor selalu query DB meskipun relation sudah eager loaded
public function getBalanceAttribute(): int {
    return $this->payments()->sum('amount'); // N+1 jika tidak eager loaded
}

// GOOD: Cek apakah relation sudah di-load
public function getBalanceAttribute(): int {
    if ($this->relationLoaded('payments')) {
        return $this->payments->sum('amount');
    }
    return $this->payments()->sum('amount');
}
```

#### 2g. Multiple Computed Properties → Single Pass

```php
// BAD: 4 computed properties, masing-masing iterasi items sendiri
#[Computed] public function netRevenue() { return $this->invoice->items->where(...)->sum('amount'); }
#[Computed] public function totalCogs() { return $this->invoice->items->where(...)->sum('cogs_amount'); }

// GOOD: Satu computed property, single pass
#[Computed]
public function invoiceMetrics(): array {
    $items = $this->invoice->items;
    $regular = $items->where('is_tax_deposit', false);
    return [
        'netRevenue' => $regular->sum('amount'),
        'totalCogs' => $regular->sum('cogs_amount'),
    ];
}
#[Computed] public function netRevenue(): int { return $this->invoiceMetrics['netRevenue']; }
```

### Step 3 — Buat Daftar Temuan

| File | Issue | Severity | Pattern |
|------|-------|----------|---------|
| Expenses.php | `totalExpense()` duplikasi `rows()` | HIGH | 2a |
| OverviewTab.php | 60 queries untuk yearly trend | HIGH | 2e |

### Step 4 — Implementasi

Terapkan fix berdasarkan severity (HIGH dulu, lalu MEDIUM). Untuk setiap fix:
1. Gunakan `database-schema` untuk konfirmasi nama kolom
2. Gunakan `database-query` atau `tinker` untuk verifikasi hasil query sebelum apply
3. Terapkan pattern yang sesuai
4. Jalankan auto-check logs (Bagian A5) setelah selesai

---

## BAGIAN C — Chart di Livewire: `@push('scripts')` + Alpine.data() Pattern

**Pattern resmi yang digunakan di project ini** (berdasarkan `accounts/index.blade.php` dan `dashboard.blade.php`).

### C1. Dua Pattern yang Berbeda — Kapan Masing-masing

| Situasi | Pattern | Alasan |
|---------|---------|--------|
| Chart dengan Chart.js | `@push('scripts')` | Butuh `<script src="cdn">` karena Chart.js tidak ada di package.json |
| Alpine component (editor, dll) | `@script` | Livewire-managed script, Chart.js tidak dibutuhkan |

**Chart.js di project ini diload via CDN di `@push('scripts')`, bukan via npm/Vite.**

### C2. Pattern yang BENAR untuk Chart.js

#### HTML Template

```blade
{{-- Chart wrapper: wire:ignore + x-data dengan chartType dan data awal --}}
<div class="h-[260px]" wire:ignore
     x-data="bankAccountCharts('incomeExpense', @js($this->chartData))">
    <canvas x-ref="canvas"></canvas>
</div>
```

Poin penting:
- `wire:ignore` — wajib, mencegah Livewire merusak DOM chart saat re-render
- `x-data="namaKomponen('chartType', @js($data))"` — chartType sebagai router, data awal dari PHP
- `x-ref="canvas"` — bukan `id=`, bukan `querySelector('canvas')`
- Nama komponen Alpine (`bankAccountCharts`) harus unik per page/module

#### `@push('scripts')` Block Template

```blade
@push('scripts')
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script>
(function() {
    function registerCharts() {
        if (typeof Alpine === 'undefined') return;

        Alpine.data('bankAccountCharts', (chartType, initialData) => ({
            chart: null,
            data: initialData,

            // Helper: dark mode detection
            isDark() { return document.documentElement.classList.contains('dark'); },
            textColor() { return this.isDark() ? '#9ca3af' : '#6b7280'; },
            gridColor() { return this.isDark() ? '#374151' : '#f3f4f6'; },

            // Tooltip theme mengikuti dark mode project
            tooltipTheme() {
                const dark = this.isDark();
                return {
                    backgroundColor: dark ? '#1f2937' : '#ffffff',
                    titleColor: dark ? '#f3f4f6' : '#111827',
                    bodyColor: dark ? '#d1d5db' : '#374151',
                    borderColor: dark ? '#374151' : '#e5e7eb',
                    borderWidth: 1,
                    cornerRadius: 8,
                };
            },

            // Currency formatter (abbreviated untuk axis, full untuk tooltip)
            formatRp(v) {
                const abs = Math.abs(v);
                if (abs >= 1e9) return 'Rp ' + (v / 1e9).toFixed(1) + 'B';
                if (abs >= 1e6) return 'Rp ' + (v / 1e6).toFixed(0) + 'Jt';
                if (abs >= 1e3) return 'Rp ' + (v / 1e3).toFixed(0) + 'K';
                return 'Rp ' + new Intl.NumberFormat('id-ID').format(v);
            },
            formatFull(v) {
                return 'Rp ' + new Intl.NumberFormat('id-ID').format(v);
            },

            // Router: chartType menentukan render method mana yang dipanggil
            render() {
                if (typeof Chart === 'undefined') return;
                if (chartType === 'incomeExpense') this.renderBarChart();
                if (chartType === 'categoryBreakdown') this.renderDonutChart();
                if (chartType === 'cashFlow') this.renderLineChart();
                // tambah chartType lain sesuai kebutuhan
            },

            init() {
                const self = this;

                // Render setelah DOM siap
                this.$nextTick(() => self.render());

                // Update data saat Livewire dispatch event (misal: account/period berubah)
                Livewire.on('account-charts-updated', (payload) => {
                    const d = payload[0];
                    if (chartType === 'incomeExpense' && d.incomeExpense) {
                        self.data = d.incomeExpense;
                        self.renderBarChart();
                    }
                    if (chartType === 'categoryBreakdown' && d.categoryBreakdown) {
                        self.data = d.categoryBreakdown;
                        self.renderDonutChart();
                    }
                    // Event name dan key harus match dengan dispatch() di PHP
                });

                // Re-render saat dark mode toggle
                this._themeObserver = new MutationObserver(() => {
                    if (self.chart) setTimeout(() => self.render(), 50);
                });
                this._themeObserver.observe(document.documentElement, {
                    attributes: true, attributeFilter: ['class'],
                });
            },

            destroyChart() {
                if (this.chart) { this.chart.destroy(); this.chart = null; }
            },

            // Bar Chart (Income vs Expense)
            renderBarChart() {
                this.destroyChart();
                if (!this.data || !this.data.length || !this.$refs.canvas) return;
                this.chart = new Chart(this.$refs.canvas, {
                    type: 'bar',
                    data: {
                        labels: this.data.map(d => d.month),
                        datasets: [
                            {
                                label: 'Pemasukan',
                                data: this.data.map(d => d.income),
                                backgroundColor: 'rgba(34, 197, 94, 0.8)',
                                borderColor: 'rgba(34, 197, 94, 1)',
                                borderWidth: 1, borderRadius: 6,
                            },
                            {
                                label: 'Pengeluaran',
                                data: this.data.map(d => d.expense),
                                backgroundColor: 'rgba(239, 68, 68, 0.8)',
                                borderColor: 'rgba(239, 68, 68, 1)',
                                borderWidth: 1, borderRadius: 6,
                            }
                        ],
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        interaction: { mode: 'index', intersect: false },
                        plugins: {
                            legend: { display: false },
                            tooltip: Object.assign({}, this.tooltipTheme(), {
                                callbacks: {
                                    label: ctx => ctx.dataset.label + ': ' + this.formatFull(ctx.parsed.y),
                                },
                            }),
                        },
                        scales: {
                            x: { grid: { color: this.gridColor() }, ticks: { color: this.textColor(), font: { size: 10 } } },
                            y: { grid: { color: this.gridColor() }, ticks: { color: this.textColor(), font: { size: 10 }, callback: v => this.formatRp(v) } },
                        },
                    },
                });
            },

            // Donut/Pie Chart (Category Breakdown)
            renderDonutChart() {
                this.destroyChart();
                if (!this.data || !this.data.length || !this.$refs.canvas) return;
                const colors = ['#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#10b981', '#6366f1'];
                this.chart = new Chart(this.$refs.canvas, {
                    type: 'doughnut',
                    data: {
                        labels: this.data.map(d => d.name),
                        datasets: [{
                            data: this.data.map(d => d.total),
                            backgroundColor: colors.slice(0, this.data.length),
                            borderColor: this.isDark() ? '#27272a' : '#ffffff',
                            borderWidth: 2,
                        }],
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false, cutout: '65%',
                        plugins: {
                            legend: { display: false },
                            tooltip: Object.assign({}, this.tooltipTheme(), {
                                callbacks: {
                                    label: ctx => {
                                        const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                        const pct = total > 0 ? Math.round((ctx.parsed / total) * 100) : 0;
                                        return ctx.label + ': ' + this.formatFull(ctx.parsed) + ' (' + pct + '%)';
                                    },
                                },
                            }),
                        },
                    },
                });
            },

            // Line Chart (Cash Flow trend)
            renderLineChart() {
                this.destroyChart();
                if (!this.data || !this.data.length || !this.$refs.canvas) return;
                this.chart = new Chart(this.$refs.canvas, {
                    type: 'line',
                    data: {
                        labels: this.data.map(d => d.label),
                        datasets: [{
                            label: 'Cash Flow',
                            data: this.data.map(d => d.amount),
                            borderColor: 'rgb(16, 185, 129)',
                            backgroundColor: 'rgba(16, 185, 129, 0.07)',
                            fill: true, tension: 0.4, borderWidth: 2,
                        }],
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: Object.assign({}, this.tooltipTheme(), {
                                callbacks: { label: ctx => this.formatFull(ctx.parsed.y) },
                            }),
                        },
                        scales: {
                            x: { grid: { display: false }, ticks: { color: this.textColor(), font: { size: 11 } } },
                            y: { beginAtZero: true, grid: { color: this.gridColor() }, ticks: { color: this.textColor(), font: { size: 11 }, callback: v => this.formatRp(v) } },
                        },
                    },
                });
            },

            destroy() {
                this.destroyChart();
                if (this._themeObserver) this._themeObserver.disconnect();
            },
        }));
    }

    // Register immediately (Alpine sudah loaded saat @push('scripts') dieksekusi)
    registerCharts();

    // Re-register setelah SPA navigation (wire:navigate)
    document.addEventListener('livewire:navigated', () => {
        registerCharts();
    });
})();
</script>
@endpush
```

### C3. Update Data dari PHP (saat filter/period berubah)

Di PHP component, dispatch event setelah computed property direset:

```php
public function updatedSelectedAccountId(): void
{
    unset($this->chartData);
    unset($this->categoryBreakdown);

    // Dispatch ke Alpine — key harus match dengan yang dicek di Livewire.on()
    $this->dispatch('account-charts-updated',
        incomeExpense: $this->chartData,
        categoryBreakdown: $this->categoryBreakdown,
    );
}
```

### C4. Wire:init untuk Defer Loading

Saat halaman punya chart dan data berat, gunakan `wire:init` agar halaman render cepat dulu, baru load data:

```blade
{{-- Di blade: wire:init triggers loadData() setelah render pertama --}}
<div wire:init="loadData" class="space-y-6">
```

```php
// Di PHP: set flag `ready` agar chart hanya dirender setelah data tersedia
public bool $ready = false;

public function loadData(): void
{
    $this->ready = true;
    // select akun pertama jika ada
    if ($this->accounts->count() > 0) {
        $this->selectedAccountId = $this->accounts->first()['id'];
    }
}
```

```blade
{{-- Di blade: guard chart dengan @if($ready) --}}
@if($ready)
    <div wire:ignore x-data="bankAccountCharts('incomeExpense', @js($this->chartData))">
        <canvas x-ref="canvas"></canvas>
    </div>
@endif
```

### C5. Pola yang SALAH — Jangan Gunakan

```blade
{{-- ❌ SALAH: @script block untuk Chart.js karena tidak bisa load <script src="cdn"> --}}
@script
<script>
Alpine.data('myChart', () => ({ ... }));
</script>
@endscript

{{-- ❌ SALAH: const di top-level = SyntaxError di Alpine's AsyncFunction --}}
@push('scripts')
<script>
const isDark = () => ...;         // Error!
window.initChart = (canvas) => {};  // Timing issue + tidak bisa pakai @js()
</script>
@endpush

{{-- ❌ SALAH: id= alih-alih x-ref= --}}
<canvas id="myChart"></canvas>
<script>new Chart(document.getElementById('myChart'), ...)</script>

{{-- ❌ SALAH: x-init dengan fungsi inline yang panjang --}}
<div x-init="chart = new Chart(...banyak config...)" wire:ignore>

{{-- ❌ SALAH: tidak ada wire:ignore —> chart hilang saat Livewire re-render --}}
<div x-data="myChart()" class="h-[260px]">
    <canvas x-ref="canvas"></canvas>
</div>
```

### C6. Checklist Sebelum Implementasi Chart

1. `wire:ignore` ada di div wrapper chart ✓
2. `x-ref="canvas"` ada di `<canvas>` element ✓
3. `@push('scripts')` digunakan, bukan `@script` ✓
4. Chart.js diload via CDN di `@push('scripts')`, bukan via npm ✓
5. `init()` method pakai `this.$nextTick()` sebelum render ✓
6. `destroyChart()` dipanggil sebelum membuat chart baru ✓
7. Dark mode observer terpasang di `init()` ✓
8. `destroy()` method membersihkan observer ✓
9. `document.addEventListener('livewire:navigated', ...)` untuk SPA navigation ✓
10. Nama Alpine.data unik per page (e.g. `bankAccountCharts`, `dashboardChart`) ✓

---

## BAGIAN D — Lazy Loading + Skeleton UI

### Kapan Digunakan

- Component yang melakukan query berat saat mount
- Halaman dengan stats cards + filter + table
- Component dengan render time > 200ms

### Implementasi

```php
use Livewire\Attributes\Lazy;

#[Lazy]
class Expenses extends Component
{
    public function placeholder(): View
    {
        return view('livewire.placeholders.cashflow-skeleton');
    }
}
```

### Skeleton yang Tersedia

| File | Struktur | Digunakan Oleh |
|------|----------|----------------|
| `placeholders/table-skeleton.blade.php` | 4 stats + filter + table 5 kolom | Clients, Invoices |
| `placeholders/stats-skeleton.blade.php` | 4 stats cards saja | Analytics tabs |
| `placeholders/cashflow-skeleton.blade.php` | Header + 3 stats + 4 filter + table | CashFlow Expenses |

Buat file baru di `resources/views/livewire/placeholders/` jika tidak ada yang cocok.

---

## BAGIAN E — Translation & Localization Protocol

### Kapan Diaudit

Setiap kali membuat atau memodifikasi file PHP/Blade.

### Prosedur Audit

1. Baca blade target + PHP component pasangannya
2. Identifikasi hardcoded text: UI labels, placeholders, `$headers`, pesan toast/dialog
3. Baca `lang/id/common.php` + `lang/id/pages.php`
4. Audit tabel: `Teks | Lokasi | Status | Key | File`
5. Tambah missing keys ke `lang/id/` + `lang/zh/` (nilai sama)
6. Update blade + PHP component

### `$headers` — Pola Wajib

```php
// ❌ SALAH — error saat boot
public array $headers = [['label' => __('pages.col_date')]];

// ✅ BENAR
public array $headers = [];
public function mount(): void
{
    $this->headers = [['index' => 'date', 'label' => __('pages.col_date')]];
}
```

### Dynamic Translation

| Sumber | Metode |
|--------|--------|
| UI string hardcoded | `__('file.key')` |
| Data dari DB (user-generated) | `translate_text($text)` |
| Nama kategori transaksi | `translate_category($name)` |

---

## BAGIAN F — preventLazyLoading

Pastikan ada di `AppServiceProvider::boot()`:

```php
Model::preventLazyLoading(!app()->isProduction());
```

Ini membantu deteksi N+1 — lazy load akan throw exception di development.

---

## Aturan Global

- Jangan ubah UI/blade kecuali untuk chart atau skeleton placeholder
- Jangan tambah fitur baru atau refactor di luar scope
- Jangan ubah business logic — output harus tetap sama
- Gunakan `database-schema` sebelum menulis JOIN atau migration
- Jalankan auto-check logs (Bagian A5) setelah selesai implementasi
- Prefix column dengan table name saat pakai JOIN
- Cek `export()` method jika `getFilteredQuery()` diubah
- **Gunakan `tinker` atau `database-query` untuk verify data sebelum membuat computed property baru**
