<?php

namespace App\Models;

use App\Services\InvoiceNumberService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

class Invoice extends Model
{
    use HasFactory;

    /** Jenis dokumen tagihan; kolom `document_type`. */
    public const TYPE_INVOICE = 'invoice';

    /**
     * Debit Note: menagih kembali biaya yang perusahaan bayar lebih dulu atas nama klien (talangan,
     * mis. PNBP). Semua itemnya titipan (`is_tax_deposit`), jadi tanpa PPN dan bukan pendapatan.
     */
    public const TYPE_DEBIT_NOTE = 'debit_note';

    /** @var list<string> */
    public const TYPES = [self::TYPE_INVOICE, self::TYPE_DEBIT_NOTE];

    /** Tarif PPh 23 atas jasa (persen) — bawaan editor bila perusahaan belum pernah memotong PPh. */
    public const DEFAULT_PPH_RATE = 2.0;

    /** Mata uang tagihan; kolom `currency`. Pembukuan selalu Rupiah, USD = utang klien (`total_foreign`). */
    public const CURRENCY_IDR = 'IDR';

    public const CURRENCY_USD = 'USD';

    /** @var list<string> */
    public const CURRENCIES = [self::CURRENCY_IDR, self::CURRENCY_USD];

    /** Awalan {KODE} di nomor per jenis: "INV", "INV-FINAL", "DN", "DN-PNBP". */
    private const NUMBER_PREFIXES = [self::TYPE_INVOICE => 'INV', self::TYPE_DEBIT_NOTE => 'DN'];

    protected $fillable = [
        'invoice_number',
        'document_type',
        'document_code',
        'billed_to_id',
        'subject',
        'subtotal',
        'discount_amount',
        'discount_type',
        'discount_value',
        'discount_reason',
        'ppn_rate',
        'ppn_amount',
        'pph_rate',
        'pph_amount',
        'total_amount',
        'currency',
        'exchange_rate',
        'total_foreign',
        'issue_date',
        'due_date',
        'status',
        'faktur',
    ];

    protected $casts = [
        'issue_date' => 'date',
        'due_date' => 'date',
        'subtotal' => 'integer',
        'discount_amount' => 'integer',
        'discount_value' => 'integer',
        'ppn_rate' => 'decimal:2',
        'ppn_amount' => 'integer',
        'pph_rate' => 'decimal:2',
        'pph_amount' => 'integer',
        'total_amount' => 'integer',
        'exchange_rate' => 'decimal:2',
        'total_foreign' => 'decimal:2',
        'invoice_sequence' => 'integer',
    ];

    /**
     * PPN dari DPP (subtotal layanan − diskon, tanpa titipan pajak) dengan tarif persen.
     * Satu-satunya rumus PPN — dipakai editor invoice, publish invoice berulang, dan pratinjau.
     */
    public static function ppnFor(int $dpp, float|string|null $rate): int
    {
        return $rate ? (int) round(max(0, $dpp) * (float) $rate / 100) : 0;
    }

    /**
     * PPh 23 yang dipotong klien dari DPP yang sama dengan PPN (layanan − diskon, tanpa titipan).
     * Satu-satunya rumus potongan PPh — dipakai editor invoice dan pratinjau.
     */
    public static function pphFor(int $dpp, float|string|null $rate): int
    {
        return $rate ? (int) round(max(0, $dpp) * (float) $rate / 100) : 0;
    }

    /**
     * "Titipan dulu": uang yang SUDAH dibayar klien (kumulatif) menutup titipan pajak klien lebih
     * dulu, lalu PPN Keluaran, sisanya baru pendapatan. Satu-satunya rumus alokasi pembayaran —
     * dipakai Laba Rugi (ProfitLossService::invoiceContributions) dan jurnal pembayaran invoice
     * (JournalService), dicerminkan di klien oleh resources/js/lib/journal.ts › allocatePayments.
     *
     * Invoice yang dipotong PPh 23 ($pph > 0, $total = total_amount = yang ditransfer klien): setiap
     * rupiah yang dibayar ikut melunasi bagian PPh-nya secara proporsional ('pph', kredit pajak
     * berbukti potong), sehingga saat lunas seluruh potongan tercatat dan pendapatan = DPP penuh.
     * tax_deposit + ppn + revenue selalu = $paid + pph (untuk $paid >= 0).
     *
     * @return array{tax_deposit: int, ppn: int, revenue: int, pph: int}
     */
    public static function allocatePayments(int $paid, int $taxDeposit, int $ppn, int $pph = 0, int $total = 0): array
    {
        $paid = max(0, $paid);
        $pphSettled = $pph > 0 && $total > 0 ? min($pph, (int) round($pph * min($paid, $total) / $total)) : 0;
        $settled = $paid + $pphSettled;

        return [
            'tax_deposit' => min($settled, $taxDeposit),
            'ppn' => min(max(0, $settled - $taxDeposit), $ppn),
            'revenue' => max(0, $settled - $taxDeposit - $ppn),
            'pph' => $pphSettled,
        ];
    }

    /**
     * Segmen {KODE} nomor: awalan jenis + kode bila ada ("INV", "INV-FINAL", "DN-PNBP").
     */
    public static function numberCode(?string $documentType, ?string $documentCode): string
    {
        $prefix = self::NUMBER_PREFIXES[$documentType] ?? self::NUMBER_PREFIXES[self::TYPE_INVOICE];

        return filled($documentCode) ? "{$prefix}-{$documentCode}" : $prefix;
    }

    /**
     * Kode jenis seperti disimpan: huruf kapital, tanpa spasi tepi, dan tanpa awalan jenis yang
     * terlanjur diketik ("dn-pnbp" → "PNBP"), karena awalan itu ditambahkan numberCode().
     */
    public static function normalizeDocumentCode(?string $code): ?string
    {
        $code = strtoupper(trim((string) $code));
        $code = (string) preg_replace('/^(INV|DN)-/', '', $code);

        return $code !== '' ? $code : null;
    }

    public function isDebitNote(): bool
    {
        return $this->document_type === self::TYPE_DEBIT_NOTE;
    }

    /**
     * Rupiah satu baris item berharga USD: jumlah × harga USD × kurs, dibulatkan sekali di akhir
     * (55.070 × $0,75 × 17.898 = Rp 739.232.145, sama dengan Excel). Satu-satunya rumus — dipakai editor
     * invoice, validasi diskon, dan pratinjau; dicerminkan editor React (create.tsx › lineAmount).
     */
    public static function foreignLineAmount(float $quantity, float|string $foreignUnitPrice, float|string $exchangeRate): int
    {
        return (int) round($quantity * (float) $foreignUnitPrice * (float) $exchangeRate);
    }

    /** Utang klien dalam USD = GRAND TOTAL Rupiah ÷ kurs, dibulatkan ke sen. */
    public static function foreignTotalFor(int $total, float|string $exchangeRate): float
    {
        return (float) $exchangeRate > 0 ? round($total / (float) $exchangeRate, 2) : 0.0;
    }

    /** Sen dari nominal USD, untuk membandingkan tanpa galat pecahan (44116.00 = 4411600). */
    public static function cents(float|string|null $amount): int
    {
        return (int) round((float) $amount * 100);
    }

    /**
     * Σ sisa tagihan (Rupiah) sekumpulan invoice dalam satu query: Rupiah = total − dibayar; USD = sisa USD
     * × kurs invoice (tidak minus walau Rupiah yang masuk melebihi total karena kurs naik). Sama dengan
     * Σ accessor amount_remaining, untuk kartu "Perlu ditagih" / "Belum dibayar" di daftar invoice.
     *
     * @param  iterable<int>  $ids
     */
    public static function outstandingTotal(iterable $ids): int
    {
        $ids = collect($ids)->all();

        if ($ids === []) {
            return 0;
        }

        $dibayar = DB::table('payments')
            ->selectRaw('invoice_id, SUM(amount) as paid, SUM(COALESCE(foreign_amount, 0)) as foreign_paid')
            ->groupBy('invoice_id');

        return (int) DB::table('invoices')
            ->leftJoinSub($dibayar, 'p', 'p.invoice_id', '=', 'invoices.id')
            ->whereIn('invoices.id', $ids)
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN invoices.currency = ? THEN GREATEST(0, invoices.total_amount - COALESCE(p.paid, 0))'
                .' ELSE ROUND(GREATEST(0, invoices.total_foreign - COALESCE(p.foreign_paid, 0)) * invoices.exchange_rate) END), 0) as sisa',
                [self::CURRENCY_IDR],
            )
            ->value('sisa');
    }

    /** Tagihan dalam mata uang asing (USD): utangnya `total_foreign`, bukan `total_amount`. */
    public function isForeign(): bool
    {
        return ($this->currency ?? self::CURRENCY_IDR) !== self::CURRENCY_IDR;
    }

    /** USD yang sudah diterima (Σ payments.foreign_amount); 0 untuk tagihan Rupiah. */
    public function getForeignPaidAttribute(): float
    {
        $sum = $this->relationLoaded('payments')
            ? $this->payments->sum(fn (Payment $payment) => (float) $payment->foreign_amount)
            : (float) $this->payments()->sum('foreign_amount');

        return round((float) $sum, 2);
    }

    /** Sisa utang USD (tidak pernah minus); null untuk tagihan Rupiah. */
    public function getForeignRemainingAttribute(): ?float
    {
        if (! $this->isForeign()) {
            return null;
        }

        return max(0, self::cents($this->total_foreign) - self::cents($this->foreign_paid)) / 100;
    }

    /**
     * Bagian Rupiah tagihan yang sudah tertutup, dinilai dengan kurs INVOICE (bukan kurs saat
     * dibayar), dari USD yang sudah diterima. Dasar alokasi "titipan dulu" tagihan USD di Laba Rugi
     * dan jurnal; selisihnya dengan Rupiah yang benar-benar masuk = selisih kurs. Lunas = total penuh.
     */
    public function settledAtInvoiceRate(float|string $foreignPaid): int
    {
        if (self::cents($foreignPaid) >= self::cents($this->total_foreign)) {
            return (int) $this->total_amount;
        }

        return min((int) $this->total_amount, (int) round((float) $foreignPaid * (float) $this->exchange_rate));
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'billed_to_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(InvoiceItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    // Essential payment tracking
    public function getAmountPaidAttribute(): int
    {
        if ($this->relationLoaded('payments')) {
            return $this->payments->sum('amount');
        }

        return $this->payments()->sum('amount');
    }

    /**
     * Sisa tagihan dalam Rupiah. Tagihan USD: sisa USD × kurs invoice (0 bila USD lunas), karena
     * Rupiah yang masuk bergantung kurs saat dibayar dan bisa melebihi total_amount.
     */
    public function getAmountRemainingAttribute(): int
    {
        if ($this->isForeign()) {
            return (int) round((float) $this->foreign_remaining * (float) $this->exchange_rate);
        }

        return $this->total_amount - $this->amount_paid;
    }

    // Essential profit tracking
    public function getTotalCogsAttribute(): int
    {
        if ($this->relationLoaded('items')) {
            return $this->items->sum('cogs_amount');
        }

        return $this->items()->sum('cogs_amount');
    }

    /**
     * PPN (titipan negara) dan item titipan (titipan pajak klien, talangan Debit Note) ikut ditagih
     * tetapi bukan pendapatan — tidak ikut laba. Potongan PPh 23 sebaliknya tetap pendapatan (kredit
     * pajak, bukan biaya), jadi dikembalikan. Sama dengan laba kotor di drawer & editor.
     */
    public function getGrossProfitAttribute(): int
    {
        return $this->total_amount + (int) $this->pph_amount - (int) $this->ppn_amount - $this->taxDepositTotal() - $this->total_cogs;
    }

    /** Dasar Pengenaan Pajak: subtotal layanan (tanpa titipan pajak) − diskon. */
    public function getDppAmountAttribute(): int
    {
        return max(0, (int) $this->subtotal - $this->taxDepositTotal() - (int) $this->discount_amount);
    }

    /** Σ item titipan (titipan pajak klien / talangan Debit Note). */
    public function taxDepositTotal(): int
    {
        return $this->relationLoaded('items')
            ? (int) $this->items->where('is_tax_deposit', true)->sum('amount')
            : (int) $this->items()->where('is_tax_deposit', true)->sum('amount');
    }

    public function getOutstandingProfitAttribute(): int
    {
        $totalPaid = $this->amount_paid;
        $totalCogs = $this->total_cogs;

        if ($totalPaid <= $totalCogs) {
            return $this->gross_profit;
        }

        $realizedProfit = $totalPaid - $totalCogs;

        return $this->gross_profit - $realizedProfit;
    }

    public function getPaidProfitAttribute(): int
    {
        return $this->gross_profit - $this->outstanding_profit;
    }

    /**
     * Nomor urut selalu mengikuti nomor: setiap kali invoice_number berubah (kirim, terbitkan,
     * rollback, data lama/factory) urutannya dibaca ulang dari nomor dengan pola aktif.
     */
    protected static function booted(): void
    {
        static::saving(function (Invoice $invoice): void {
            if ($invoice->isDirty('invoice_number') && ! $invoice->isDirty('invoice_sequence')) {
                $invoice->invoice_sequence = $invoice->invoice_number
                    ? app(InvoiceNumberService::class)->sequenceOf($invoice->invoice_number)
                    : null;
            }
        });
    }

    public static function generateInvoiceNumber(\DateTimeInterface $issueDate, int $clientId, ?string $documentType = null, ?string $documentCode = null): string
    {
        return app(InvoiceNumberService::class)->next(Carbon::instance($issueDate), $clientId, self::numberCode($documentType, $documentCode));
    }

    public static function isLatestInNumberingPeriod(self $invoice): bool
    {
        return app(InvoiceNumberService::class)->isLatestInPeriod($invoice);
    }

    // Update invoice status based on payments
    public function updateStatus(): void
    {
        // Tagihan USD lunas bila USD-nya terbayar penuh, berapa pun Rupiah yang masuk (kurs berubah).
        [$amountPaid, $total] = $this->isForeign()
            ? [self::cents($this->foreign_paid), self::cents($this->total_foreign)]
            : [$this->amount_paid, $this->total_amount];

        if ($amountPaid == 0) {
            $this->status = $this->invoice_number ? 'sent' : 'draft';
        } elseif ($amountPaid >= $total) {
            $this->status = 'paid';
        } else {
            $this->status = 'partially_paid';
        }

        $this->save();
    }
}
