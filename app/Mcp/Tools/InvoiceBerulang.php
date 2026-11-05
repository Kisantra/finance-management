<?php

namespace App\Mcp\Tools;

use App\Models\Company;
use App\Models\RecurringInvoice;
use App\Models\RecurringTemplate;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Database\Eloquent\Builder;
use Laravel\Mcp\Request;

/**
 * Invoice berulang, mengikuti tab Templates & Bulanan di RecurringInvoiceController::index():
 * progres template seperti formatTemplate(), baris & statistik bulan seperti
 * formatMonthlyInvoice() dan computeMonthlyStats(). Siklus penagihan memakai
 * RecurringTemplate::getValidMonths(), aturan yang sama dengan generate bulanan.
 */
class InvoiceBerulang extends AlatKeuangan
{
    /** Label seperti di halaman Invoice Berulang. */
    private const LABEL_FREKUENSI = [
        'monthly' => 'Bulanan',
        'quarterly' => 'Triwulanan',
        'semi_annual' => 'Semesteran',
        'annual' => 'Tahunan',
    ];

    private const LABEL_STATUS_TEMPLATE = [
        'active' => 'Aktif',
        'inactive' => 'Nonaktif',
        'archived' => 'Diarsipkan',
    ];

    private const LABEL_STATUS_BULANAN = [
        'draft' => 'Draft (belum dipublish)',
        'published' => 'Sudah dipublish',
    ];

    protected string $name = 'invoice-berulang';

    protected string $description = 'Invoice berulang (recurring). tampilan=template (bawaan): template per klien dengan frekuensi, nilai, masa berlaku, status, progres siklus, bulan_berikutnya (siklus pertama yang drafnya belum dibuat) dan bulan_terlewat (siklus sebelum bulan ini yang belum dibuat). tampilan=bulanan (otomatis bila bulan/status diisi): draft & yang sudah dipublish di satu bulan beserta invoice hasilnya. nilai = tanpa PPN & titipan pajak; invoice hasil publish = nilai + titipan_pajak + PPN bila perusahaan PKP. Draft dibuat & dipublish manual di aplikasi.';

    protected function izin(): string
    {
        return 'view recurring-invoices';
    }

    protected function skemaTambahan(JsonSchema $schema): array
    {
        return [
            'tampilan' => $schema->string()->enum(['template', 'bulanan'])
                ->description('template = daftar template; bulanan = invoice berulang satu bulan.'),
            'status_template' => $schema->string()->enum(array_keys(self::LABEL_STATUS_TEMPLATE))
                ->description('Khusus tampilan=template: active, inactive, atau archived.'),
            'bulan' => $schema->string()
                ->description('Khusus tampilan=bulanan: bulan penagihan YYYY-MM, bawaan bulan ini.'),
            'status' => $schema->string()->enum(array_keys(self::LABEL_STATUS_BULANAN))
                ->description('Khusus tampilan=bulanan: draft = belum dipublish, published = sudah jadi invoice.'),
            'halaman' => $schema->integer()->min(1)
                ->description('Nomor halaman, mulai 1.'),
            'per_halaman' => $schema->integer()->min(1)->max(50)
                ->description('Baris per halaman, bawaan 50, maksimal 50.'),
        ];
    }

    protected function jalankan(Request $request, Company $perusahaan): array
    {
        $data = $request->validate([
            'tampilan' => ['nullable', 'in:template,bulanan'],
            'status_template' => ['nullable', 'in:'.implode(',', array_keys(self::LABEL_STATUS_TEMPLATE))],
            'bulan' => ['nullable', 'date_format:Y-m'],
            'status' => ['nullable', 'in:'.implode(',', array_keys(self::LABEL_STATUS_BULANAN))],
            'halaman' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'per_halaman' => ['nullable', 'integer', 'min:1', 'max:50'],
        ], [
            'tampilan' => 'tampilan harus template atau bulanan.',
            'status_template' => 'status_template harus active, inactive, atau archived.',
            'bulan' => 'bulan harus berformat YYYY-MM, mis. 2026-11.',
            'status' => 'status harus draft atau published.',
            'halaman' => 'halaman harus bilangan bulat mulai 1 (maksimal 10000).',
            'per_halaman' => 'per_halaman harus bilangan bulat 1–50.',
        ]);

        $halaman = (int) ($data['halaman'] ?? 1);
        $perHalaman = (int) ($data['per_halaman'] ?? 50);
        $tampilan = $data['tampilan'] ?? (isset($data['bulan']) || isset($data['status']) ? 'bulanan' : 'template');

        return $tampilan === 'bulanan'
            ? $this->bulanan($data, $halaman, $perHalaman)
            : $this->template($data, $halaman, $perHalaman);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function template(array $data, int $halaman, int $perHalaman): array
    {
        $status = $data['status_template'] ?? null;
        $dasar = RecurringTemplate::query()->when($status, fn (Builder $q, string $s) => $q->where('status', $s));

        $jumlah = (clone $dasar)->count();
        $template = (clone $dasar)
            ->with(['client:id,name', 'recurringInvoices:id,template_id,scheduled_date,status'])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->forPage($halaman, $perHalaman)
            ->get();

        $perStatus = RecurringTemplate::query()
            ->selectRaw('status, COUNT(*) AS jumlah')
            ->groupBy('status')
            ->pluck('jumlah', 'status')
            ->map(fn ($nilai) => (int) $nilai);

        $draft = RecurringInvoice::query()->where('status', 'draft')->toBase()
            ->selectRaw('COUNT(*) AS jumlah, MIN(scheduled_date) AS tertua')
            ->first();
        $nilaiDraft = (int) RecurringInvoice::query()->where('status', 'draft')->sum('invoice_data->total_amount');

        $bulanIni = now()->format('Y-m');

        return [
            'tampilan' => 'template',
            'filter' => array_filter(['status_template' => $status]),
            'ringkasan' => [
                'jumlah_template' => $perStatus->sum(),
                'aktif' => $perStatus->get('active', 0),
                'nonaktif' => $perStatus->get('inactive', 0),
                'diarsipkan' => $perStatus->get('archived', 0),
                'draft_belum_dipublish' => [
                    'jumlah' => (int) $draft->jumlah,
                    'nilai' => $nilaiDraft,
                    'bulan_tertua' => $draft->tertua ? substr((string) $draft->tertua, 0, 7) : null,
                ],
            ],
            'jumlah' => $jumlah,
            'halaman' => $halaman,
            'per_halaman' => $perHalaman,
            'total_halaman' => max(1, (int) ceil($jumlah / $perHalaman)),
            'template' => $template->map(fn (RecurringTemplate $t) => $this->barisTemplate($t, $bulanIni))->values()->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function barisTemplate(RecurringTemplate $template, string $bulanIni): array
    {
        $isi = is_array($template->invoice_template) ? $template->invoice_template : [];
        $item = collect(is_array($isi['items'] ?? null) ? $isi['items'] : []);

        $dibuat = $template->recurringInvoices;
        $bulanDibuat = $dibuat->map(fn (RecurringInvoice $r) => $r->scheduled_date?->format('Y-m'))->filter()->unique();
        $siklus = collect($template->getValidMonths())->map(fn (array $b) => sprintf('%04d-%02d', $b['year'], $b['month']));
        $belumDibuat = $siklus->reject(fn (string $b) => $bulanDibuat->contains($b))->values();

        // generateMonthly() hanya mengambil template aktif; template lain tidak akan dibuatkan draft.
        $aktif = $template->status === 'active';

        return [
            'id' => $template->id,
            'nama' => $template->template_name,
            'klien_id' => (int) $template->client_id,
            'klien' => $template->client?->name,
            'frekuensi' => $template->frequency,
            'frekuensi_label' => self::LABEL_FREKUENSI[$template->frequency] ?? $template->frequency,
            'status' => $template->status,
            'status_label' => self::LABEL_STATUS_TEMPLATE[$template->status] ?? $template->status,
            'aktif' => $aktif,
            'nilai' => (int) $template->total_amount,
            'titipan_pajak' => (int) $item->filter(fn ($i) => (bool) ($i['is_tax_deposit'] ?? false))
                ->sum(fn ($i) => (int) ($i['amount'] ?? 0)),
            'layanan' => $item->pluck('service_name')->filter()->unique()->values()->all(),
            'mulai' => $template->start_date?->format('Y-m-d'),
            'selesai' => $template->end_date?->format('Y-m-d'),
            'siklus_total' => $siklus->count(),
            'sudah_dibuat' => $dibuat->count(),
            'sudah_dipublish' => $dibuat->where('status', 'published')->count(),
            'sisa_siklus' => max(0, $siklus->count() - $dibuat->count()),
            'bulan_berikutnya' => $aktif ? $belumDibuat->first() : null,
            'bulan_terlewat' => $aktif ? $belumDibuat->filter(fn (string $b) => $b < $bulanIni)->count() : 0,
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function bulanan(array $data, int $halaman, int $perHalaman): array
    {
        $bulan = $data['bulan'] ?? now()->format('Y-m');
        [$tahun, $nomorBulan] = array_map('intval', explode('-', $bulan));
        $status = $data['status'] ?? null;

        $bulanItu = fn () => RecurringInvoice::query()
            ->whereYear('scheduled_date', $tahun)
            ->whereMonth('scheduled_date', $nomorBulan);

        // Statistik seperti computeMonthlyStats(): seluruh baris bulan itu, tanpa filter status.
        $semua = $bulanItu()->get(['id', 'status', 'invoice_data']);
        $nilai = fn (RecurringInvoice $r): int => (int) $r->total_amount;
        $nilaiTotal = $semua->sum($nilai);
        $hpp = $semua->sum(fn (RecurringInvoice $r): int => (int) collect(data_get($r->invoice_data, 'items', []))->sum('cogs_amount'));
        $draft = $semua->where('status', 'draft');
        $dipublish = $semua->where('status', 'published');

        $dasar = $bulanItu()->when($status, fn (Builder $q, string $s) => $q->where('status', $s));
        $jumlah = (clone $dasar)->count();
        $baris = (clone $dasar)
            ->with(['client:id,name', 'template:id,template_name,frequency', 'publishedInvoice:id,invoice_number,status'])
            ->orderByDesc('scheduled_date')
            ->orderBy('id')
            ->forPage($halaman, $perHalaman)
            ->get();

        return [
            'tampilan' => 'bulanan',
            'bulan' => $bulan,
            'filter' => array_filter(['status' => $status]),
            'ringkasan_bulan' => [
                'jumlah' => $semua->count(),
                'nilai' => $nilaiTotal,
                'hpp' => $hpp,
                'laba' => $nilaiTotal - $hpp,
                'draft' => ['jumlah' => $draft->count(), 'nilai' => $draft->sum($nilai)],
                'dipublish' => ['jumlah' => $dipublish->count(), 'nilai' => $dipublish->sum($nilai)],
            ],
            'jumlah' => $jumlah,
            'halaman' => $halaman,
            'per_halaman' => $perHalaman,
            'total_halaman' => max(1, (int) ceil($jumlah / $perHalaman)),
            'invoice_berulang' => $baris->map(fn (RecurringInvoice $r) => [
                'id' => $r->id,
                'template_id' => (int) $r->template_id,
                'template' => $r->template?->template_name,
                'frekuensi' => $r->template?->frequency,
                'klien_id' => (int) $r->client_id,
                'klien' => $r->client?->name,
                'tanggal_jadwal' => $r->scheduled_date?->format('Y-m-d'),
                'terbit' => $r->issue_date?->format('Y-m-d'),
                'jatuh_tempo' => $r->due_date?->format('Y-m-d'),
                'nilai' => (int) $r->total_amount,
                'status' => $r->status,
                'status_label' => self::LABEL_STATUS_BULANAN[$r->status] ?? $r->status,
                'invoice' => $r->publishedInvoice ? [
                    'id' => $r->publishedInvoice->id,
                    'nomor' => $r->publishedInvoice->invoice_number,
                    'status' => $r->publishedInvoice->status,
                    'status_label' => DaftarInvoice::labelStatus($r->publishedInvoice->status),
                ] : null,
            ])->values()->all(),
        ];
    }
}
