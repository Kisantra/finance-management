<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReimbursementPayment extends Model
{
    use HasFactory;

    protected $fillable = [
        'reimbursement_id',
        'bank_transaction_id',
        'amount',
        'payment_date',
        'notes',
        'paid_by',
    ];

    protected $casts = [
        'payment_date' => 'date',
        'amount' => 'integer',
    ];

    /**
     * `reimbursements.amount_paid` adalah kolom tersimpan yang selama ini hanya
     * diinkremen saat pembayaran dicatat. Menghapus atau mengubah satu
     * pembayaran tidak pernah menurunkannya kembali, sehingga reimbursement
     * bisa tampak lunas padahal pembayarannya sudah tidak ada — dan status
     * bohong itu ikut ke laporan.
     */
    protected static function booted(): void
    {
        $rekonsiliasi = function (self $payment) {
            $reimbursement = $payment->reimbursement()->first();

            if (! $reimbursement) {
                return;
            }

            $reimbursement->forceFill([
                'amount_paid' => (int) $reimbursement->payments()->sum('amount'),
            ]);

            $reimbursement->payment_status = match (true) {
                $reimbursement->amount_paid <= 0 => 'unpaid',
                $reimbursement->amount_paid >= $reimbursement->amount => 'paid',
                default => 'partial',
            };

            $reimbursement->saveQuietly();
        };

        static::saved($rekonsiliasi);
        static::deleted($rekonsiliasi);
    }

    // Relationships
    public function reimbursement(): BelongsTo
    {
        return $this->belongsTo(Reimbursement::class);
    }

    public function bankTransaction(): BelongsTo
    {
        return $this->belongsTo(BankTransaction::class);
    }

    public function payer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'paid_by');
    }

    // Formatters
    public function getFormattedAmountAttribute(): string
    {
        return 'Rp '.number_format($this->amount, 0, ',', '.');
    }
}
