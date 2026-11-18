<?php

namespace App\Models;

use App\Services\InvoiceNumberService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

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
        'total_amount',
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
        'total_amount' => 'integer',
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
     * "Titipan dulu": uang yang SUDAH dibayar klien (kumulatif) menutup titipan pajak klien lebih
     * dulu, lalu PPN Keluaran, sisanya baru pendapatan. Satu-satunya rumus alokasi pembayaran —
     * dipakai Laba Rugi (ProfitLossService::invoiceContributions) dan jurnal pembayaran invoice
     * (JournalService), dicerminkan di klien oleh resources/js/lib/journal.ts › allocatePayments.
     * Ketiga bagian selalu berjumlah $paid (untuk $paid >= 0).
     *
     * @return array{tax_deposit: int, ppn: int, revenue: int}
     */
    public static function allocatePayments(int $paid, int $taxDeposit, int $ppn): array
    {
        $paid = max(0, $paid);

        return [
            'tax_deposit' => min($paid, $taxDeposit),
            'ppn' => min(max(0, $paid - $taxDeposit), $ppn),
            'revenue' => max(0, $paid - $taxDeposit - $ppn),
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

    public function getAmountRemainingAttribute(): int
    {
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
     * tetapi bukan pendapatan — tidak ikut laba. Sama dengan laba kotor di drawer & editor.
     */
    public function getGrossProfitAttribute(): int
    {
        return $this->total_amount - (int) $this->ppn_amount - $this->taxDepositTotal() - $this->total_cogs;
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
        $amountPaid = $this->amount_paid;

        if ($amountPaid == 0) {
            $this->status = $this->invoice_number ? 'sent' : 'draft';
        } elseif ($amountPaid >= $this->total_amount) {
            $this->status = 'paid';
        } else {
            $this->status = 'partially_paid';
        }

        $this->save();
    }
}
