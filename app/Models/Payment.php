<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class Payment extends Model
{
    use HasFactory;

    protected $fillable = [
        'invoice_id',
        'bank_account_id',
        'amount',
        'payment_date',
        'payment_method',
        'reference_number',
        'attachment_path',
        'attachment_name',
    ];

    protected $casts = [
        'payment_date' => 'date',
        'amount' => 'integer',
    ];

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function bankAccount(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class);
    }

    public function hasAttachment(): bool
    {
        return ! empty($this->attachment_path);
    }

    public function getAttachmentUrlAttribute(): ?string
    {
        return $this->attachment_path ? Storage::url($this->attachment_path) : null;
    }

    public function getAttachmentTypeAttribute(): ?string
    {
        if (! $this->attachment_path) {
            return null;
        }

        $extension = pathinfo($this->attachment_name, PATHINFO_EXTENSION);

        return strtolower($extension);
    }

    public function isImageAttachment(): bool
    {
        return in_array($this->attachment_type, ['jpg', 'jpeg', 'png', 'gif']);
    }

    public function isPdfAttachment(): bool
    {
        return $this->attachment_type === 'pdf';
    }

    // Delete attachment when model is deleted
    protected static function boot()
    {
        parent::boot();

        static::deleting(function ($payment) {
            if ($payment->attachment_path && Storage::disk('public')->exists($payment->attachment_path)) {
                Storage::disk('public')->delete($payment->attachment_path);
            }
        });
    }
}
