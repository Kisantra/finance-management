<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RecurringInvoice extends Model
{
    use HasFactory;

    protected $fillable = [
        'template_id',
        'client_id',
        'scheduled_date',
        'issue_date',
        'due_date',
        'invoice_data',
        'status',
        'published_invoice_id',
    ];

    protected $casts = [
        'scheduled_date' => 'date',
        'issue_date' => 'date',
        'due_date' => 'date',
        'invoice_data' => 'array',
    ];

    public function template(): BelongsTo
    {
        return $this->belongsTo(RecurringTemplate::class, 'template_id');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function publishedInvoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class, 'published_invoice_id');
    }

    // Get total amount from invoice data
    public function getTotalAmountAttribute(): int
    {
        return $this->invoice_data['total_amount'] ?? 0;
    }

    public function getFormattedTotalAmountAttribute(): string
    {
        return 'Rp '.number_format($this->total_amount, 0, ',', '.');
    }

    // Get items from invoice data
    public function getItemsAttribute(): array
    {
        return $this->invoice_data['items'] ?? [];
    }

    // Publish to invoices table
    public function publish(): Invoice
    {
        if ($this->status === 'published') {
            return $this->publishedInvoice;
        }

        // PPN mengikuti status PKP saat publish (subtotal template sudah tanpa titipan pajak).
        $company = CompanyProfile::current();
        $ppnRate = $company?->is_pkp && (float) $company->ppn_rate > 0 ? (float) $company->ppn_rate : 0.0;
        $discountAmount = (int) ($this->invoice_data['discount_amount'] ?? 0);
        $ppnAmount = Invoice::ppnFor((int) $this->invoice_data['subtotal'] - $discountAmount, $ppnRate);

        // Draft tanpa nomor, sama seperti invoice biasa: nomor resmi diberikan saat "Kirim".
        $invoice = Invoice::create([
            'billed_to_id' => $this->client_id,
            'subtotal' => $this->invoice_data['subtotal'],
            'discount_amount' => $discountAmount,
            'discount_type' => $this->invoice_data['discount_type'] ?? 'fixed',
            'discount_value' => $this->invoice_data['discount_value'] ?? 0,
            'discount_reason' => $this->invoice_data['discount_reason'] ?? null,
            'ppn_rate' => $ppnRate,
            'ppn_amount' => $ppnAmount,
            'total_amount' => $this->total_amount + $ppnAmount,
            'issue_date' => $this->issue_date ?? $this->scheduled_date,
            'due_date' => $this->due_date ?? ($this->issue_date ?? $this->scheduled_date)->copy()->addDays(30),
            'status' => 'draft',
        ]);

        // Create invoice items
        foreach ($this->items as $itemData) {
            // `unit` dan `is_tax_deposit` WAJIB ikut tersalin. Tanpa keduanya,
            // invoice hasil publish memakai satuan bawaan, dan item titipan pajak
            // kehilangan penandanya — padahal item titipan dikecualikan dari omzet.
            // Akibatnya titipan pajak terhitung sebagai pendapatan dan basis PPh
            // final 0,5% ikut salah. Hilang sekali saat merge rekonsiliasi; dikunci
            // RecurringInvoiceHardeningTest.
            $invoice->items()->create([
                'client_id' => $this->client_id,
                'service_name' => $itemData['service_name'],
                'quantity' => $itemData['quantity'],
                'unit' => $itemData['unit'] ?? 'pcs',
                'unit_price' => $itemData['unit_price'],
                'amount' => $itemData['amount'],
                'cogs_amount' => $itemData['cogs_amount'] ?? 0,
                'is_tax_deposit' => (bool) ($itemData['is_tax_deposit'] ?? false),
            ]);
        }

        // Update recurring invoice status
        $this->update([
            'status' => 'published',
            'published_invoice_id' => $invoice->id,
        ]);

        return $invoice;
    }

    // Scope for monthly filtering
    public function scopeForMonth($query, int $month, ?int $year = null)
    {
        $year = $year ?: now()->year;

        return $query->whereYear('scheduled_date', $year)
            ->whereMonth('scheduled_date', $month);
    }

    // Scope for year filtering
    public function scopeForYear($query, int $year)
    {
        return $query->whereYear('scheduled_date', $year);
    }
}
