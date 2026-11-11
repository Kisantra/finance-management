<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InvoiceItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'invoice_id',
        'client_id',
        'service_name',
        'description',
        'quantity',
        'unit',
        'unit_price',
        'amount',
        'cogs_amount',
        'is_tax_deposit',
    ];

    protected $casts = [
        'quantity' => 'decimal:3',
        'unit_price' => 'integer',
        'amount' => 'integer',
        'cogs_amount' => 'integer',
        'is_tax_deposit' => 'boolean',
    ];

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    // Net revenue excluding tax deposits
    public function getNetRevenueAttribute(): int
    {
        return $this->is_tax_deposit ? 0 : $this->amount;
    }

    // Net profit excluding tax deposits
    public function getNetProfitAttribute(): int
    {
        return $this->is_tax_deposit ? 0 : ($this->amount - $this->cogs_amount);
    }

    // Original profit calculation (for backwards compatibility)
    public function getProfitAmountAttribute(): int
    {
        return $this->amount - $this->cogs_amount;
    }
}
