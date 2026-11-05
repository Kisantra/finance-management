<?php

namespace App\Mcp\Tools;

use App\Models\Company;
use App\Models\Invoice;
use App\Models\Payment;
use Carbon\CarbonInterface;
use Closure;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Database\Eloquent\Builder;
use Laravel\Mcp\Request;

/**
 * Daftar invoice. Query & aturan filter mengikuti InvoiceController::index(): join klien,
 * pembayaran dijumlahkan per invoice lewat subquery (hasilnya sama dengan accessor
 * Invoice::amount_paid, tanpa query per baris), dan "lewat tempo" = applyStatusFilter('overdue').
 */
class DaftarInvoice extends AlatKeuangan
{
    /** Label status seperti di aplikasi (resources/js/pages/invoices/components/ob.tsx). */
    public const LABEL_STATUS = [
        'draft' => 'Draft',
        'sent' => 'Terkirim',
        'partially_paid' => 'Dibayar sebagian',
        'paid' => 'Lunas',
        'overdue' => 'Lewat tempo',
        'cancelled' => 'Dibatalkan',
    ];

    /** Status yang masih menunggu pembayaran; hanya ini yang bisa lewat tempo. */
    public const STATUS_MENUNGGU_BAYAR = ['sent', 'partially_paid'];

    private const URUTAN = ['terbaru', 'terlama', 'jatuh_tempo', 'sisa_terbesar', 'total_terbesar'];

    protected string $name = 'daftar-invoice';

    protected string $description = 'Daftar invoice: total, dibayar, sisa, status, dan hari lewat tempo per invoice, plus ringkasan untuk SELURUH hasil filter (bukan hanya halaman ini). Tanpa dari/sampai = semua periode. Lewat tempo = terkirim/dibayar sebagian yang jatuh temponya sudah lewat (tab "Perlu ditagih" di aplikasi). Draft belum dikirim ke klien (nomor null). ringkasan.belum_dibayar = sisa tagihan tanpa draft. Item, pajak & pembayaran: detail-invoice.';

    protected function izin(): string
    {
        return 'view invoices';
    }

    protected function skemaTambahan(JsonSchema $schema): array
    {
        return [
            'status' => $schema->string()->enum(['draft', 'sent', 'partially_paid', 'paid'])
                ->description('draft = belum dikirim, sent = terkirim belum dibayar, partially_paid = dibayar sebagian, paid = lunas.'),
            'lewat_tempo' => $schema->boolean()
                ->description('true = hanya yang lewat jatuh tempo; false = tanpa yang lewat jatuh tempo.'),
            'klien' => $schema->string()
                ->description('Nama klien (cocok sebagian) atau ID klien dari daftar-klien.'),
            'dari' => $schema->string()->format('date')
                ->description('Tanggal terbit paling awal, YYYY-MM-DD.'),
            'sampai' => $schema->string()->format('date')
                ->description('Tanggal terbit paling akhir, YYYY-MM-DD.'),
            'kata_kunci' => $schema->string()
                ->description('Cari di nomor invoice atau nama klien.'),
            'urut' => $schema->string()->enum(self::URUTAN)
                ->description('terbaru (bawaan, tanggal terbit terbaru), terlama, jatuh_tempo (paling awal dulu), sisa_terbesar, total_terbesar.'),
            'halaman' => $schema->integer()->min(1)
                ->description('Nomor halaman, mulai 1.'),
            'per_halaman' => $schema->integer()->min(1)->max(50)
                ->description('Baris per halaman, bawaan 25, maksimal 50.'),
        ];
    }

    protected function jalankan(Request $request, Company $perusahaan): array
    {
        $data = $request->validate([
            'status' => ['nullable', 'in:draft,sent,partially_paid,paid'],
            'lewat_tempo' => ['nullable', 'boolean'],
            'klien' => ['nullable', self::teksAtauAngka(), 'max:150'],
            'dari' => ['nullable', 'date_format:Y-m-d'],
            'sampai' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:dari'],
            'kata_kunci' => ['nullable', 'string', 'max:100'],
            'urut' => ['nullable', 'in:'.implode(',', self::URUTAN)],
            'halaman' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'per_halaman' => ['nullable', 'integer', 'min:1', 'max:50'],
        ], [
            'status' => 'status harus salah satu dari: draft, sent, partially_paid, paid. Untuk invoice yang lewat jatuh tempo pakai lewat_tempo=true.',
            'lewat_tempo' => 'lewat_tempo harus true atau false.',
            'klien.max' => 'klien maksimal 150 karakter.',
            'dari' => 'dari harus tanggal berformat YYYY-MM-DD, mis. 2026-01-01.',
            'sampai.date_format' => 'sampai harus tanggal berformat YYYY-MM-DD, mis. 2026-12-31.',
            'sampai.after_or_equal' => 'sampai tidak boleh lebih awal dari dari.',
            'kata_kunci' => 'kata_kunci harus teks, maksimal 100 karakter.',
            'urut' => 'urut harus salah satu dari: '.implode(', ', self::URUTAN).'.',
            'halaman' => 'halaman harus bilangan bulat mulai 1 (maksimal 10000).',
            'per_halaman' => 'per_halaman harus bilangan bulat 1–50.',
        ]);

        $hariIni = today()->toDateString();
        $halaman = (int) ($data['halaman'] ?? 1);
        $perHalaman = (int) ($data['per_halaman'] ?? 25);
        $urut = $data['urut'] ?? 'terbaru';
        $lewatTempo = isset($data['lewat_tempo']) ? filter_var($data['lewat_tempo'], FILTER_VALIDATE_BOOLEAN) : null;
        $klien = isset($data['klien']) ? trim((string) $data['klien']) : '';
        $kataKunci = trim((string) ($data['kata_kunci'] ?? ''));

        $dasar = Invoice::query()
            ->join('clients', 'invoices.billed_to_id', '=', 'clients.id')
            ->leftJoinSub(
                Payment::query()->select('invoice_id')->selectRaw('SUM(amount) AS jumlah_dibayar')->groupBy('invoice_id'),
                'p',
                'p.invoice_id',
                '=',
                'invoices.id'
            )
            ->when($data['status'] ?? null, fn (Builder $q, string $status) => $q->where('invoices.status', $status))
            ->when($lewatTempo === true, fn (Builder $q) => $q
                ->whereIn('invoices.status', self::STATUS_MENUNGGU_BAYAR)
                ->where('invoices.due_date', '<', $hariIni))
            ->when($lewatTempo === false, fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->whereNotIn('invoices.status', self::STATUS_MENUNGGU_BAYAR)
                ->orWhere('invoices.due_date', '>=', $hariIni)))
            ->when($klien !== '', fn (Builder $q) => ctype_digit($klien)
                ? $q->where('invoices.billed_to_id', (int) $klien)
                : $q->where('clients.name', 'like', "%{$klien}%"))
            ->when($data['dari'] ?? null, fn (Builder $q, string $dari) => $q->where('invoices.issue_date', '>=', $dari))
            ->when($data['sampai'] ?? null, fn (Builder $q, string $sampai) => $q->where('invoices.issue_date', '<=', $sampai))
            ->when($kataKunci !== '', fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->where('invoices.invoice_number', 'like', "%{$kataKunci}%")
                ->orWhere('clients.name', 'like', "%{$kataKunci}%")));

        $sisa = 'invoices.total_amount - COALESCE(p.jumlah_dibayar, 0)';
        $menunggu = "invoices.status IN ('sent', 'partially_paid')";

        $ringkasan = (clone $dasar)->toBase()->selectRaw(
            "COUNT(*) AS jumlah,
            COALESCE(SUM(invoices.total_amount), 0) AS total,
            COALESCE(SUM(p.jumlah_dibayar), 0) AS dibayar,
            COALESCE(SUM(CASE WHEN {$menunggu} THEN {$sisa} ELSE 0 END), 0) AS belum_dibayar,
            COALESCE(SUM(CASE WHEN {$menunggu} AND invoices.due_date < ? THEN 1 ELSE 0 END), 0) AS lewat_tempo_jumlah,
            COALESCE(SUM(CASE WHEN {$menunggu} AND invoices.due_date < ? THEN {$sisa} ELSE 0 END), 0) AS lewat_tempo_sisa,
            COALESCE(SUM(CASE WHEN invoices.status = 'draft' THEN 1 ELSE 0 END), 0) AS draft_jumlah,
            COALESCE(SUM(CASE WHEN invoices.status = 'draft' THEN invoices.total_amount ELSE 0 END), 0) AS draft_total",
            [$hariIni, $hariIni]
        )->first();

        $baris = (clone $dasar)
            ->select([
                'invoices.id', 'invoices.invoice_number', 'invoices.billed_to_id', 'invoices.issue_date',
                'invoices.due_date', 'invoices.total_amount', 'invoices.status', 'clients.name as nama_klien',
            ])
            // Alias sengaja bukan `amount_paid`: accessor Invoice::getAmountPaidAttribute()
            // mengabaikan kolom terpilih dan menjalankan query SUM per baris.
            ->selectRaw('COALESCE(p.jumlah_dibayar, 0) AS jumlah_dibayar')
            ->tap(fn (Builder $q) => match ($urut) {
                'terlama' => $q->orderBy('invoices.issue_date')->orderBy('invoices.id'),
                'jatuh_tempo' => $q->orderBy('invoices.due_date')->orderBy('invoices.id'),
                'sisa_terbesar' => $q->orderByRaw("{$sisa} DESC")->orderByDesc('invoices.id'),
                'total_terbesar' => $q->orderByDesc('invoices.total_amount')->orderByDesc('invoices.id'),
                default => $q->orderByDesc('invoices.issue_date')->orderByDesc('invoices.id'),
            })
            ->forPage($halaman, $perHalaman)
            ->get();

        $jumlah = (int) $ringkasan->jumlah;
        $total = (int) $ringkasan->total;
        $dibayar = (int) $ringkasan->dibayar;

        return [
            'filter' => array_filter([
                'status' => $data['status'] ?? null,
                'lewat_tempo' => $lewatTempo,
                'klien' => $klien !== '' ? $klien : null,
                'dari' => $data['dari'] ?? null,
                'sampai' => $data['sampai'] ?? null,
                'kata_kunci' => $kataKunci !== '' ? $kataKunci : null,
                'urut' => $urut,
            ], fn ($nilai) => $nilai !== null),
            'ringkasan' => [
                'jumlah' => $jumlah,
                'total' => $total,
                'dibayar' => $dibayar,
                'sisa' => $total - $dibayar,
                'belum_dibayar' => (int) $ringkasan->belum_dibayar,
                'lewat_tempo' => ['jumlah' => (int) $ringkasan->lewat_tempo_jumlah, 'sisa' => (int) $ringkasan->lewat_tempo_sisa],
                'draft' => ['jumlah' => (int) $ringkasan->draft_jumlah, 'total' => (int) $ringkasan->draft_total],
            ],
            'halaman' => $halaman,
            'per_halaman' => $perHalaman,
            'total_halaman' => max(1, (int) ceil($jumlah / $perHalaman)),
            'invoice' => $baris->map(fn (Invoice $invoice) => [
                'id' => $invoice->id,
                'nomor' => $invoice->invoice_number,
                'klien_id' => (int) $invoice->billed_to_id,
                'klien' => $invoice->nama_klien,
                'terbit' => $invoice->issue_date?->format('Y-m-d'),
                'jatuh_tempo' => $invoice->due_date?->format('Y-m-d'),
                'total' => (int) $invoice->total_amount,
                'dibayar' => (int) $invoice->jumlah_dibayar,
                'sisa' => (int) $invoice->total_amount - (int) $invoice->jumlah_dibayar,
                'status' => $invoice->status,
                'status_label' => self::labelStatus($invoice->status),
                'hari_lewat_tempo' => self::hariLewatTempo($invoice->status, $invoice->due_date),
            ])->values()->all(),
        ];
    }

    public static function labelStatus(?string $status): ?string
    {
        return $status === null ? null : (self::LABEL_STATUS[$status] ?? $status);
    }

    /** Hari sejak jatuh tempo untuk invoice yang masih menunggu bayar; 0 bila belum lewat, lunas, atau draft. */
    public static function hariLewatTempo(?string $status, ?CarbonInterface $jatuhTempo): int
    {
        if ($jatuhTempo === null || ! in_array($status, self::STATUS_MENUNGGU_BAYAR, true)) {
            return 0;
        }

        return max(0, (int) round($jatuhTempo->copy()->startOfDay()->diffInDays(today())));
    }

    /** Argumen yang boleh berupa teks atau bilangan bulat (mis. nama atau ID). */
    private static function teksAtauAngka(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            if (! is_string($value) && ! is_int($value)) {
                $fail("{$attribute} harus berupa teks (nama) atau bilangan bulat (ID).");
            }
        };
    }
}
