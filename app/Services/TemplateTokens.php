<?php

namespace App\Services;

use App\Models\Client;
use App\Models\CompanyProfile;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use Carbon\Carbon;

/**
 * Single source of truth for template token catalog.
 *
 * Each entry defines:
 *   - path:    the {{dot.path}} used in templates
 *   - label:   Indonesian label shown in the field picker
 *   - resolve: callable(Invoice, array) → string   (second arg = $paymentContext)
 *
 * Used server-side (token resolution) AND exposed to the editor (field picker + sampleData).
 *
 * Payment context keys (all optional, pass from print route):
 *   mode            : 'full' | 'dp' | 'pelunasan'
 *   dp_amount       : int|null
 *   pelunasan_amount: int|null
 */
class TemplateTokens
{
    /**
     * Return the full catalog as an array of ['path', 'label', 'resolve'].
     *
     * @return array<int, array{path: string, label: string, resolve: callable(Invoice, array): string}>
     */
    public static function catalog(): array
    {
        return [
            // ── Invoice ──────────────────────────────────────────────────────
            [
                'path' => 'invoice.number',
                'label' => 'No. Invoice',
                'resolve' => fn (Invoice $inv, array $ctx = []): string => (string) ($inv->invoice_number ?? ''),
            ],
            [
                'path' => 'invoice.issue_date',
                'label' => 'Tanggal Terbit',
                'resolve' => fn (Invoice $inv, array $ctx = []): string => self::formatDate($inv->issue_date),
            ],
            [
                'path' => 'invoice.date',
                'label' => 'Tanggal (alias issue_date)',
                'resolve' => fn (Invoice $inv, array $ctx = []): string => self::formatDate($inv->issue_date),
            ],
            [
                'path' => 'invoice.due_date',
                'label' => 'Jatuh Tempo',
                'resolve' => fn (Invoice $inv, array $ctx = []): string => self::formatDate($inv->due_date),
            ],
            [
                'path' => 'invoice.status',
                'label' => 'Status',
                'resolve' => fn (Invoice $inv, array $ctx = []): string => self::translateStatus((string) ($inv->status ?? '')),
            ],
            [
                'path' => 'invoice.subtotal',
                'label' => 'Subtotal',
                'resolve' => fn (Invoice $inv, array $ctx = []): string => self::formatRupiah((int) ($inv->subtotal ?? 0)),
            ],
            [
                'path' => 'invoice.discount_amount',
                'label' => 'Diskon',
                'resolve' => fn (Invoice $inv, array $ctx = []): string => self::formatRupiah((int) ($inv->discount_amount ?? 0)),
            ],
            [
                'path' => 'invoice.dpp',
                'label' => 'DPP (dasar PPN)',
                'resolve' => fn (Invoice $inv, array $ctx = []): string => self::formatRupiah($inv->dpp_amount),
            ],
            [
                'path' => 'invoice.ppn_rate',
                'label' => 'Tarif PPN',
                'resolve' => fn (Invoice $inv, array $ctx = []): string => (float) $inv->ppn_rate > 0
                    ? rtrim(rtrim(number_format((float) $inv->ppn_rate, 2, ',', '.'), '0'), ',').'%'
                    : '',
            ],
            [
                'path' => 'invoice.ppn_amount',
                'label' => 'PPN',
                'resolve' => fn (Invoice $inv, array $ctx = []): string => self::formatRupiah((int) ($inv->ppn_amount ?? 0)),
            ],
            [
                'path' => 'invoice.total_amount',
                'label' => 'Total',
                'resolve' => fn (Invoice $inv, array $ctx = []): string => self::formatRupiah((int) ($inv->total_amount ?? 0)),
            ],
            [
                'path' => 'invoice.amount_paid',
                'label' => 'Sudah Dibayar',
                'resolve' => fn (Invoice $inv, array $ctx = []): string => self::formatRupiah((int) $inv->amount_paid),
            ],
            [
                'path' => 'invoice.amount_remaining',
                'label' => 'Sisa Tagihan',
                'resolve' => fn (Invoice $inv, array $ctx = []): string => self::formatRupiah((int) $inv->amount_remaining),
            ],
            [
                'path' => 'invoice.notes',
                'label' => 'Catatan',
                'resolve' => fn (Invoice $inv, array $ctx = []): string => (string) ($inv->notes ?? ''),
            ],
            [
                'path' => 'invoice.faktur',
                'label' => 'No. Faktur Pajak',
                'resolve' => fn (Invoice $inv, array $ctx = []): string => (string) ($inv->faktur ?? ''),
            ],

            // ── Client ───────────────────────────────────────────────────────
            [
                'path' => 'client.name',
                'label' => 'Nama Klien',
                'resolve' => fn (Invoice $inv, array $ctx = []): string => (string) ($inv->client?->name ?? ''),
            ],
            [
                'path' => 'client.npwp',
                'label' => 'NPWP Klien',
                'resolve' => fn (Invoice $inv, array $ctx = []): string => (string) ($inv->client?->NPWP ?? ''),
            ],
            [
                'path' => 'client.address',
                'label' => 'Alamat Klien',
                'resolve' => fn (Invoice $inv, array $ctx = []): string => (string) ($inv->client?->address ?? ''),
            ],
            [
                'path' => 'client.email',
                'label' => 'Email Klien',
                'resolve' => fn (Invoice $inv, array $ctx = []): string => (string) ($inv->client?->email ?? ''),
            ],
            [
                'path' => 'client.phone',
                'label' => 'Telepon Klien',
                'resolve' => fn (Invoice $inv, array $ctx = []): string => (string) ($inv->client?->ar_phone_number ?? ''),
            ],
            [
                'path' => 'client.person_in_charge',
                'label' => 'Penanggung Jawab',
                'resolve' => fn (Invoice $inv, array $ctx = []): string => (string) ($inv->client?->person_in_charge ?? ''),
            ],

            // ── Company ──────────────────────────────────────────────────────
            [
                'path' => 'company.name',
                'label' => 'Nama Perusahaan',
                'resolve' => fn (Invoice $inv, array $ctx = []): string => (string) (CompanyProfile::current()?->name ?? ''),
            ],
            [
                'path' => 'company.npwp',
                'label' => 'NPWP Perusahaan',
                'resolve' => fn (Invoice $inv, array $ctx = []): string => (string) (CompanyProfile::current()?->npwp ?? ''),
            ],
            [
                'path' => 'company.address',
                'label' => 'Alamat Perusahaan',
                'resolve' => fn (Invoice $inv, array $ctx = []): string => (string) (CompanyProfile::current()?->address ?? ''),
            ],
            [
                'path' => 'company.phone',
                'label' => 'Telepon Perusahaan',
                'resolve' => fn (Invoice $inv, array $ctx = []): string => (string) (CompanyProfile::current()?->phone ?? ''),
            ],
            [
                'path' => 'company.email',
                'label' => 'Email Perusahaan',
                'resolve' => fn (Invoice $inv, array $ctx = []): string => (string) (CompanyProfile::current()?->email ?? ''),
            ],
            [
                'path' => 'company.finance_manager',
                'label' => 'Manajer Keuangan',
                'resolve' => fn (Invoice $inv, array $ctx = []): string => (string) (CompanyProfile::current()?->finance_manager_name ?? ''),
            ],

            // ── Payment context (mode-aware: full / dp / pelunasan) ────────────
            // Resolved from $paymentContext passed at print time; safe defaults
            // when rendering in the editor (treated as "full" / no DP).
            [
                'path' => 'payment.mode',
                'label' => 'Tipe Cetak',
                'resolve' => fn (Invoice $inv, array $ctx = []): string => match ($ctx['mode'] ?? 'full') {
                    'dp' => 'Uang Muka',
                    'pelunasan' => 'Pelunasan',
                    default => 'Penuh',
                },
            ],
            [
                'path' => 'payment.display_amount',
                'label' => 'Nominal Tagih (sesuai tipe cetak)',
                'resolve' => function (Invoice $inv, array $ctx = []): string {
                    $mode = $ctx['mode'] ?? 'full';
                    $amount = match ($mode) {
                        'dp' => (int) ($ctx['dp_amount'] ?? 0),
                        'pelunasan' => (int) ($ctx['pelunasan_amount'] ?? 0),
                        default => (int) ($inv->total_amount ?? 0),
                    };

                    return self::formatRupiah($amount);
                },
            ],
            [
                'path' => 'payment.display_amount_words',
                'label' => 'Nominal Tagih (terbilang)',
                'resolve' => function (Invoice $inv, array $ctx = []): string {
                    $mode = $ctx['mode'] ?? 'full';
                    $amount = match ($mode) {
                        'dp' => (int) ($ctx['dp_amount'] ?? 0),
                        'pelunasan' => (int) ($ctx['pelunasan_amount'] ?? 0),
                        default => (int) ($inv->total_amount ?? 0),
                    };

                    return self::numberToWords($amount).' Rupiah';
                },
            ],
            [
                'path' => 'payment.dp_amount',
                'label' => 'Nominal DP',
                'resolve' => fn (Invoice $inv, array $ctx = []): string => isset($ctx['dp_amount']) && $ctx['dp_amount'] > 0
                    ? self::formatRupiah((int) $ctx['dp_amount'])
                    : '',
            ],
            [
                'path' => 'payment.dp_percentage',
                'label' => 'Persentase DP',
                'resolve' => function (Invoice $inv, array $ctx = []): string {
                    $dp = (int) ($ctx['dp_amount'] ?? 0);
                    $subtotal = (int) ($inv->subtotal ?? 0);
                    if ($dp <= 0 || $subtotal <= 0) {
                        return '';
                    }

                    return round(($dp / $subtotal) * 100).'%';
                },
            ],
            [
                'path' => 'payment.pelunasan_amount',
                'label' => 'Nominal Pelunasan',
                'resolve' => fn (Invoice $inv, array $ctx = []): string => isset($ctx['pelunasan_amount']) && $ctx['pelunasan_amount'] > 0
                    ? self::formatRupiah((int) $ctx['pelunasan_amount'])
                    : '',
            ],
            [
                'path' => 'payment.already_paid',
                'label' => 'Sudah Dibayar (sebelum pelunasan)',
                'resolve' => fn (Invoice $inv, array $ctx = []): string => self::formatRupiah((int) $inv->amount_paid),
            ],
            [
                'path' => 'payment.remaining_after',
                'label' => 'Sisa setelah DP',
                'resolve' => function (Invoice $inv, array $ctx = []): string {
                    $dp = (int) ($ctx['dp_amount'] ?? 0);
                    if ($dp <= 0) {
                        return '';
                    }
                    $remaining = max(0, (int) ($inv->total_amount ?? 0) - $dp);

                    return self::formatRupiah($remaining);
                },
            ],
        ];
    }

    /**
     * Resolve all tokens in a text string against the given Invoice.
     * Unknown {{tokens}} are left as-is.
     *
     * @param  array{mode?: string, dp_amount?: int|null, pelunasan_amount?: int|null}  $paymentContext
     */
    public static function resolveText(string $text, Invoice $invoice, array $paymentContext = []): string
    {
        $map = self::buildMap($invoice, $paymentContext);

        return preg_replace_callback('/\{\{([\w.]+)\}\}/', function (array $m) use ($map): string {
            return \array_key_exists($m[1], $map) ? $map[$m[1]] : $m[0];
        }, $text);
    }

    /**
     * Return a flat path→value map for a given Invoice (used for sampleData in the editor).
     *
     * @param  array{mode?: string, dp_amount?: int|null, pelunasan_amount?: int|null}  $paymentContext
     * @return array<string, string>
     */
    public static function buildMap(Invoice $invoice, array $paymentContext = []): array
    {
        $map = [];
        foreach (self::catalog() as $entry) {
            $map[$entry['path']] = ($entry['resolve'])($invoice, $paymentContext);
        }

        return $map;
    }

    /**
     * Build a flat key→value map for a single InvoiceItem,
     * prefixed with "item." for use in TRB detail row token resolution.
     *
     * @return array<string, string>
     */
    public static function itemMap(InvoiceItem $item, int $index): array
    {
        $columns = ItemColumns::catalog();
        $map = [];
        foreach ($columns as $col) {
            $map['item.'.$col['key']] = ($col['resolve'])($item, $index);
        }
        // Explicitly override item.no with the row index
        $map['item.no'] = (string) $index;

        return $map;
    }

    /**
     * Return just [path, label] pairs — safe to serialize to JSON for the frontend.
     *
     * @return array<int, array{path: string, label: string}>
     */
    public static function catalogForFrontend(): array
    {
        return array_map(
            fn (array $entry): array => ['path' => $entry['path'], 'label' => $entry['label']],
            self::catalog()
        );
    }

    /**
     * Build an in-memory sample Invoice so preview/PDF never crashes when DB is empty.
     */
    public static function sampleInvoice(): Invoice
    {
        $inv = new Invoice([
            'invoice_number' => 'INV/001/KSN/VI.2026',
            'subtotal' => 5000000,
            'discount_amount' => 0,
            'total_amount' => 5000000,
            'issue_date' => '2026-06-08',
            'due_date' => '2026-06-22',
            'status' => 'draft',
            'faktur' => '',
        ]);

        // Attach a synthetic client (not persisted).
        $client = new Client([
            'name' => 'PT Maju Jaya',
            'NPWP' => '01.234.567.8-901.000',
            'address' => 'Jl. Contoh No. 1, Jakarta',
            'email' => 'info@majujaya.co.id',
            'ar_phone_number' => '021-1234567',
            'person_in_charge' => 'Budi Santoso',
        ]);
        $inv->setRelation('client', $client);

        // Payments relation = empty collection so accessors work without DB.
        $inv->setRelation('payments', collect());

        // Attach sample items — enough rows to test multi-page in PDF.
        $sampleItems = collect([
            new InvoiceItem(['invoice_id' => 0, 'service_name' => 'Konsultasi IT', 'quantity' => '2.000', 'unit' => 'jam', 'unit_price' => 750000, 'amount' => 1500000, 'cogs_amount' => 300000, 'is_tax_deposit' => false]),
            new InvoiceItem(['invoice_id' => 0, 'service_name' => 'Pengembangan Fitur A', 'quantity' => '1.000', 'unit' => 'paket', 'unit_price' => 2000000, 'amount' => 2000000, 'cogs_amount' => 800000, 'is_tax_deposit' => false]),
            new InvoiceItem(['invoice_id' => 0, 'service_name' => 'Hosting & Domain (1 th)', 'quantity' => '1.000', 'unit' => 'tahun', 'unit_price' => 500000, 'amount' => 500000, 'cogs_amount' => 350000, 'is_tax_deposit' => false]),
            new InvoiceItem(['invoice_id' => 0, 'service_name' => 'PPh Final 0,5%', 'quantity' => '1.000', 'unit' => 'ls', 'unit_price' => 20000, 'amount' => 20000, 'cogs_amount' => 0, 'is_tax_deposit' => true]),
            new InvoiceItem(['invoice_id' => 0, 'service_name' => 'Pemeliharaan Bulanan', 'quantity' => '3.000', 'unit' => 'bulan', 'unit_price' => 300000, 'amount' => 900000, 'cogs_amount' => 150000, 'is_tax_deposit' => false]),
        ]);
        $inv->setRelation('items', $sampleItems);

        return $inv;
    }

    // ── Formatting helpers ────────────────────────────────────────────────────

    /**
     * Format an integer (stored in cents-of-Rupiah, i.e. whole Rupiah) to "Rp 1.500.000".
     * Matches the convention used throughout the app: integer → display.
     */
    public static function formatRupiah(int $amount): string
    {
        return 'Rp '.number_format($amount, 0, ',', '.');
    }

    /**
     * Format a date value (Carbon, string, or null) to Indonesian long format.
     * Example: "08 Juni 2026"  — matches kisantra-invoice.blade.php convention.
     */
    public static function formatDate(mixed $date): string
    {
        if ($date === null || $date === '') {
            return '';
        }

        $carbon = $date instanceof \DateTimeInterface
            ? Carbon::instance($date)
            : Carbon::parse($date);

        $months = [
            1 => 'Januari',  2 => 'Februari', 3 => 'Maret',
            4 => 'April',    5 => 'Mei',       6 => 'Juni',
            7 => 'Juli',     8 => 'Agustus',   9 => 'September',
            10 => 'Oktober',  11 => 'November',  12 => 'Desember',
        ];

        return sprintf('%02d %s %d', $carbon->day, $months[$carbon->month], $carbon->year);
    }

    /**
     * Convert an integer amount to Indonesian words (terbilang).
     * Mirrors InvoicePrintService::numberToWords() so builder templates
     * can use {{payment.display_amount_words}} just like hardcoded templates.
     */
    public static function numberToWords(int $number): string
    {
        if ($number === 0) {
            return 'Nol';
        }

        $words = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan'];

        if ($number >= 1_000_000_000) {
            $milyar = intval($number / 1_000_000_000);
            $sisa = $number % 1_000_000_000;
            $result = ($milyar === 1 ? 'Satu' : self::numberToWords($milyar)).' Milyar';

            return $sisa > 0 ? $result.' '.self::numberToWords($sisa) : $result;
        }

        if ($number >= 1_000_000) {
            $juta = intval($number / 1_000_000);
            $sisa = $number % 1_000_000;
            $result = ($juta === 1 ? 'Satu' : self::numberToWords($juta)).' Juta';

            return $sisa > 0 ? $result.' '.self::numberToWords($sisa) : $result;
        }

        if ($number >= 1_000) {
            $ribu = intval($number / 1_000);
            $sisa = $number % 1_000;
            $result = $ribu === 1 ? 'Seribu' : self::numberToWords($ribu).' Ribu';

            return $sisa > 0 ? $result.' '.self::numberToWords($sisa) : $result;
        }

        if ($number >= 100) {
            $ratus = intval($number / 100);
            $sisa = $number % 100;
            $result = $ratus === 1 ? 'Seratus' : $words[$ratus].' Ratus';

            return $sisa > 0 ? $result.' '.self::numberToWords($sisa) : $result;
        }

        if ($number >= 20) {
            $puluh = intval($number / 10);
            $sisa = $number % 10;
            $result = $words[$puluh].' Puluh';

            return $sisa > 0 ? $result.' '.$words[$sisa] : $result;
        }

        if ($number >= 11) {
            return $words[$number - 10].' Belas';
        }

        if ($number === 10) {
            return 'Sepuluh';
        }

        return $words[$number];
    }

    /**
     * Translate invoice status to Indonesian.
     */
    private static function translateStatus(string $status): string
    {
        return match ($status) {
            'draft' => 'Draft',
            'paid' => 'Lunas',
            'partially_paid' => 'Sebagian Dibayar',
            'sent' => 'Terkirim',
            'overdue' => 'Jatuh Tempo',
            default => $status,
        };
    }
}
