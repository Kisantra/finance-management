<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Invoice extends Model
{
    use HasFactory;

    protected $fillable = [
        'invoice_number',
        'billed_to_id',
        'subtotal',
        'discount_amount',
        'discount_type',
        'discount_value',
        'discount_reason',
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
        'total_amount' => 'integer',
    ];

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

    public function getGrossProfitAttribute(): int
    {
        return $this->total_amount - $this->total_cogs;
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

    // Invoice number generation
    public static function generateInvoiceNumber(\DateTimeInterface $issueDate, int $clientId): string
    {
        $maxSequence = static::getMaxSequenceFromDb($issueDate);
        $sequence = $maxSequence + 1;

        $companyInitials = static::getCompanyInitials();
        $clientInitials = static::getClientInitials($clientId);
        $romanMonth = static::getRomanMonth($issueDate->month);
        $year = $issueDate->year;

        return sprintf(
            '%03d/INV/%s-%s/%s/%d',
            $sequence,
            $companyInitials,
            $clientInitials,
            $romanMonth,
            $year
        );
    }

    public static function getMaxSequenceFromDb(\DateTimeInterface $date): int
    {
        $invoiceNumbers = static::whereYear('issue_date', $date->format('Y'))
            ->whereMonth('issue_date', $date->format('m'))
            ->where('invoice_number', 'LIKE', '%/INV/%')
            ->pluck('invoice_number');

        if ($invoiceNumbers->isEmpty()) {
            return 0;
        }

        return (int) $invoiceNumbers->map(fn ($num) => (int) explode('/INV/', $num)[0])->max();
    }

    public static function isInvoiceLatestInMonth(self $invoice): bool
    {
        if (! $invoice->invoice_number || ! str_contains($invoice->invoice_number, '/INV/')) {
            return false;
        }

        $maxSeq = static::getMaxSequenceFromDb(Carbon::parse($invoice->issue_date));
        $invoiceSeq = (int) explode('/INV/', $invoice->invoice_number)[0];

        return $invoiceSeq === (int) $maxSeq;
    }

    private static function getCompanyInitials(): string
    {
        $company = CompanyProfile::first();
        if (! $company || ! $company->name) {
            return 'SPI';
        }

        return static::extractInitials($company->name) ?: 'SPI';
    }

    private static function getClientInitials(int $clientId): string
    {
        $client = Client::find($clientId);
        if (! $client) {
            return 'XXX';
        }

        $name = $client->type === 'company' && $client->company_name
            ? $client->company_name
            : $client->name;

        return static::extractInitials($name) ?: 'XXX';
    }

    public static function extractCompanyInitials(string $name): string
    {
        return static::extractInitials($name);
    }

    private static function extractInitials(string $name): string
    {
        $skipWords = ['pt', 'pt.', 'cv', 'cv.', 'ud', 'ud.', 'tb', 'tb.', 'pd', 'pd.', 'firma', 'yayasan', 'koperasi', 'perum', 'persero'];

        $words = preg_split('/\s+/', trim($name));
        $initials = '';
        foreach ($words as $word) {
            if (! empty($word) && ! in_array(strtolower(rtrim($word, '.')), $skipWords) && ! in_array(strtolower($word), $skipWords)) {
                $initials .= strtoupper($word[0]);
            }
        }

        return $initials;
    }

    private static function getRomanMonth(int $month): string
    {
        $romans = [
            1 => 'I', 2 => 'II', 3 => 'III', 4 => 'IV',
            5 => 'V', 6 => 'VI', 7 => 'VII', 8 => 'VIII',
            9 => 'IX', 10 => 'X', 11 => 'XI', 12 => 'XII',
        ];

        return $romans[$month] ?? 'I';
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
