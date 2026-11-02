<?php

namespace App\Services;

use App\Models\Client;
use App\Models\CompanyProfile;
use App\Models\Invoice;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;

/**
 * Satu-satunya tempat nomor invoice disusun dan dibaca.
 *
 * Pola token, jumlah digit, dan periode reset tersimpan di profil perusahaan. Nomor urut
 * tersimpan sebagai angka di kolom `invoices.invoice_sequence` (diisi model saat
 * `invoice_number` berubah, lewat sequenceOf()), jadi mengganti pola tidak merusak urutan
 * maupun aturan rollback invoice lama.
 */
class InvoiceNumberService
{
    public const DEFAULT_FORMAT = '{NO}/INV/{PT}-{KLIEN}/{BLN_ROMAWI}/{THN}';

    public const DEFAULT_PADDING = 3;

    public const DEFAULT_RESET = 'monthly';

    /**
     * Jumlah digit minimum {NO}; nomor tetap bertambah melewati batas ini (99 → 100 pada 2 digit).
     * 1 = tanpa nol di depan.
     *
     * @var list<int>
     */
    public const PADDINGS = [1, 2, 3, 4, 5];

    /** @var list<string> */
    public const RESETS = ['monthly', 'yearly', 'never'];

    /** @var array<string, string> token => keterangan untuk halaman pengaturan */
    public const TOKENS = [
        'NO' => 'Nomor urut',
        'PT' => 'Singkatan perusahaan',
        'KLIEN' => 'Inisial klien',
        'BLN_ROMAWI' => 'Bulan romawi',
        'BLN' => 'Bulan 2 digit',
        'THN' => 'Tahun 4 digit',
        'THN2' => 'Tahun 2 digit',
    ];

    private const ROMAN_MONTHS = [1 => 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

    private const SKIPPED_WORDS = ['pt', 'cv', 'ud', 'tb', 'pd', 'firma', 'yayasan', 'koperasi', 'perum', 'persero'];

    /** @return array{format: string, padding: int, reset: string} */
    public function settings(): array
    {
        $company = CompanyProfile::current();

        return [
            'format' => $company?->invoice_number_format ?: self::DEFAULT_FORMAT,
            'padding' => in_array((int) $company?->invoice_number_padding, self::PADDINGS, true) ? (int) $company->invoice_number_padding : self::DEFAULT_PADDING,
            'reset' => in_array($company?->invoice_number_reset, self::RESETS, true) ? $company->invoice_number_reset : self::DEFAULT_RESET,
        ];
    }

    /** Nomor yang akan diberikan bila invoice klien ini diterbitkan dengan tanggal terbit ini. */
    public function next(CarbonInterface $issueDate, int $clientId): string
    {
        $settings = $this->settings();

        return $this->render(
            $settings,
            $this->nextSequence($issueDate, $settings['reset']),
            $issueDate,
            $this->companyInitials(),
            $this->clientInitials($clientId),
        );
    }

    /** Urutan terbesar dalam periode reset tanggal ini, ditambah satu. */
    public function nextSequence(CarbonInterface $date, ?string $reset = null): int
    {
        return (int) $this->inPeriod(Invoice::query(), $date, $reset ?? $this->settings()['reset'])->max('invoice_sequence') + 1;
    }

    /** @param array{format: string, padding: int} $settings */
    public function render(array $settings, int $sequence, CarbonInterface $date, string $companyInitials, string $clientInitials): string
    {
        return strtr($settings['format'], [
            '{NO}' => str_pad((string) $sequence, $settings['padding'], '0', STR_PAD_LEFT),
            '{PT}' => $companyInitials,
            '{KLIEN}' => $clientInitials,
            '{BLN_ROMAWI}' => self::ROMAN_MONTHS[$date->month],
            '{BLN}' => $date->format('m'),
            '{THN}' => $date->format('Y'),
            '{THN2}' => $date->format('y'),
        ]);
    }

    /**
     * Nomor urut di dalam nomor yang mengikuti pola aktif; null bila tidak cocok (mis. nomor
     * manual berformat lain). Token lain dicocokkan per jenis karakter, bukan nilainya, agar
     * nomor tetap terbaca walau nama perusahaan/klien berubah setelahnya.
     */
    public function sequenceOf(string $number): ?int
    {
        $regex = strtr(preg_quote($this->settings()['format'], '/'), [
            '\{NO\}' => '(\d+)',
            '\{PT\}' => '[A-Za-z0-9]+?',
            '\{KLIEN\}' => '[A-Za-z0-9]+?',
            '\{BLN_ROMAWI\}' => '(?:XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)',
            '\{BLN\}' => '\d{2}',
            '\{THN\}' => '\d{4}',
            '\{THN2\}' => '\d{2}',
        ]);

        return preg_match('/^'.$regex.'$/', $number, $match) ? (int) $match[1] : null;
    }

    /** Hanya urutan tertinggi di periodenya yang boleh di-rollback, supaya urutan tidak berlubang. */
    public function isLatestInPeriod(Invoice $invoice): bool
    {
        if ($invoice->invoice_sequence === null || ! $invoice->issue_date) {
            return false;
        }

        return $invoice->invoice_sequence === $this->nextSequence($invoice->issue_date) - 1;
    }

    /**
     * @param  Builder<Invoice>  $query
     * @return Builder<Invoice>
     */
    public function inPeriod(Builder $query, CarbonInterface $date, string $reset): Builder
    {
        return match ($reset) {
            'monthly' => $query->whereYear('issue_date', $date->year)->whereMonth('issue_date', $date->month),
            'yearly' => $query->whereYear('issue_date', $date->year),
            default => $query,
        };
    }

    /** Pesan kesalahan pola untuk pengguna; null bila pola dapat dipakai. */
    public function formatError(string $format, string $reset): ?string
    {
        preg_match_all('/\{([^{}]*)\}/', $format, $matches);
        $unknown = array_diff($matches[1], array_keys(self::TOKENS));
        if ($unknown !== []) {
            return 'Token tidak dikenal: {'.implode('}, {', $unknown).'}.';
        }

        if (preg_match('/[{}]/', preg_replace('/\{[A-Z0-9_]+\}/', '', $format))) {
            return 'Kurung kurawal hanya dipakai untuk token, mis. {NO}.';
        }

        if (substr_count($format, '{NO}') !== 1) {
            return 'Pola wajib berisi {NO} tepat satu kali.';
        }

        $hasYear = str_contains($format, '{THN}') || str_contains($format, '{THN2}');
        $hasMonth = str_contains($format, '{BLN}') || str_contains($format, '{BLN_ROMAWI}');

        if ($reset === 'monthly' && ! ($hasMonth && $hasYear)) {
            return 'Nomor kembali ke 1 tiap bulan, jadi pola wajib memuat bulan ({BLN_ROMAWI} atau {BLN}) dan tahun ({THN} atau {THN2}) agar tidak sama dengan nomor bulan lain.';
        }

        if ($reset === 'yearly' && ! $hasYear) {
            return 'Nomor kembali ke 1 tiap tahun, jadi pola wajib memuat tahun ({THN} atau {THN2}) agar tidak sama dengan nomor tahun lain.';
        }

        return null;
    }

    /** Inisial nama perusahaan; "SPI" bila profil perusahaan belum diisi (perilaku lama). */
    public function companyInitials(): string
    {
        $name = CompanyProfile::current()?->name;

        return ($name ? $this->initials($name) : '') ?: 'SPI';
    }

    /** Inisial klien (nama perusahaan untuk klien badan usaha); "XXX" bila tidak ditemukan. */
    public function clientInitials(int $clientId): string
    {
        $client = Client::find($clientId);
        if (! $client) {
            return 'XXX';
        }

        $name = $client->type === 'company' && $client->company_name ? $client->company_name : $client->name;

        return $this->initials($name) ?: 'XXX';
    }

    /** Huruf pertama tiap kata, tanpa sebutan badan usaha (PT, CV, ...). */
    public function initials(string $name): string
    {
        $initials = '';
        foreach (preg_split('/\s+/', trim($name)) as $word) {
            if ($word !== '' && ! in_array(strtolower(rtrim($word, '.')), self::SKIPPED_WORDS, true)) {
                $initials .= strtoupper($word[0]);
            }
        }

        return $initials;
    }
}
