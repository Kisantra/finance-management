<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

class Reimbursement extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'title',
        'description',
        'amount',
        'amount_paid',
        'expense_date',
        'category_input', // User's text input
        'category_id', // FK set by finance
        'attachment_path',
        'attachment_name',
        'status',
        'payment_status',
        'reviewed_by',
        'reviewed_at',
        'review_notes',
    ];

    protected $casts = [
        'expense_date' => 'date',
        'reviewed_at' => 'datetime',
        'amount' => 'integer',
        'amount_paid' => 'integer',
    ];

    // =====================================
    // RELATIONSHIPS
    // =====================================

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(TransactionCategory::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(ReimbursementPayment::class);
    }

    // =====================================
    // SCOPES
    // =====================================

    public function scopeForUser($query, int $userId)
    {
        return $query->where('user_id', $userId);
    }

    public function scopeByStatus($query, string $status)
    {
        return $query->where('status', $status);
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeApproved($query)
    {
        return $query->where('status', 'approved');
    }

    public function scopePaid($query)
    {
        return $query->where('payment_status', 'paid');
    }

    public function scopeRejected($query)
    {
        return $query->where('status', 'rejected');
    }

    public function scopeByCategory($query, int $categoryId)
    {
        return $query->where('category_id', $categoryId);
    }

    public function scopeDateBetween($query, $startDate, $endDate)
    {
        return $query->whereBetween('expense_date', [$startDate, $endDate]);
    }

    public function scopeMonth($query, int $month, ?int $year = null)
    {
        $year = $year ?: now()->year;

        return $query->whereYear('expense_date', $year)
            ->whereMonth('expense_date', $month);
    }

    public function scopeYear($query, int $year)
    {
        return $query->whereYear('expense_date', $year);
    }

    // =====================================
    // PAYMENT STATUS CHECKERS
    // =====================================

    public function isFullyPaid(): bool
    {
        return $this->amount_paid >= $this->amount;
    }

    public function hasPartialPayment(): bool
    {
        return $this->amount_paid > 0 && $this->amount_paid < $this->amount;
    }

    public function isUnpaid(): bool
    {
        return $this->amount_paid == 0;
    }

    public function getAmountRemainingAttribute(): int
    {
        return $this->amount - $this->amount_paid;
    }

    // =====================================
    // STATUS CHECKERS
    // =====================================

    public function isDraft(): bool
    {
        return $this->status === 'draft';
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    public function isApproved(): bool
    {
        return $this->status === 'approved';
    }

    public function isRejected(): bool
    {
        return $this->status === 'rejected';
    }

    public function canEdit(): bool
    {
        return in_array($this->status, ['draft', 'rejected']);
    }

    public function canDelete(?User $user = null): bool
    {
        $user = $user ?? auth()->user();

        // Sudah ada pembayaran: transaksi bank debitnya tetap memotong saldo, jadi
        // pengajuannya tidak boleh hilang — bahkan oleh admin.
        if ($this->amount_paid > 0) {
            return false;
        }

        if ($user && $user->hasRole('admin')) {
            return true;
        }

        // Selain admin: hanya pemilik, dan hanya selama belum diproses (draft/ditolak).
        return $user !== null
            && $this->user_id === $user->id
            && in_array($this->status, ['draft', 'rejected']);
    }

    /** Draft, atau ditolak lalu diperbaiki pemohon (pengajuan ulang). */
    public function canSubmit(): bool
    {
        return in_array($this->status, ['draft', 'rejected']);
    }

    public function canReview(): bool
    {
        return $this->status === 'pending';
    }

    public function canPay(): bool
    {
        // Can pay if approved, has category assigned, and not fully paid yet
        return $this->status === 'approved'
            && ! $this->isFullyPaid();
    }

    // =====================================
    // ACTIONS
    // =====================================

    public function submit(): bool
    {
        if (! $this->canSubmit()) {
            return false;
        }

        // Pengajuan ulang setelah ditolak masuk antrean sebagai review baru.
        return $this->update([
            'status' => 'pending',
            'reviewed_by' => null,
            'reviewed_at' => null,
            'review_notes' => null,
        ]);
    }

    public function approve(int $reviewerId, ?string $notes = null): bool
    {
        if (! $this->canReview()) {
            return false;
        }

        return $this->update([
            'status' => 'approved',
            'reviewed_by' => $reviewerId,
            'reviewed_at' => now(),
            'review_notes' => $notes,
        ]);
    }

    public function reject(int $reviewerId, ?string $notes = null): bool
    {
        if (! $this->canReview()) {
            return false;
        }

        return $this->update([
            'status' => 'rejected',
            'reviewed_by' => $reviewerId,
            'reviewed_at' => now(),
            'review_notes' => $notes,
        ]);
    }

    public function recordPayment(int $amount, int $bankTransactionId, int $payerId, string $paymentDate, ?string $notes = null): bool
    {
        if (! $this->canPay()) {
            return false;
        }

        // Create payment record
        $this->payments()->create([
            'bank_transaction_id' => $bankTransactionId,
            'amount' => $amount,
            'payment_date' => $paymentDate,
            'notes' => $notes,
            'paid_by' => $payerId,
        ]);

        // Update total paid
        $this->amount_paid += $amount;

        // Update payment status
        if ($this->isFullyPaid()) {
            $this->payment_status = 'paid';
            $this->status = 'paid';
        } else {
            $this->payment_status = 'partial';
        }

        return $this->save();
    }

    // =====================================
    // ATTACHMENT HELPERS
    // =====================================

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
        if (! $this->hasAttachment()) {
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

    // =====================================
    // FORMATTERS
    // =====================================

    public function getFormattedAmountAttribute(): string
    {
        return 'Rp '.number_format($this->amount, 0, ',', '.');
    }

    public function getFormattedAmountPaidAttribute(): string
    {
        return 'Rp '.number_format($this->amount_paid, 0, ',', '.');
    }

    public function getFormattedAmountRemainingAttribute(): string
    {
        return 'Rp '.number_format($this->amount_remaining, 0, ',', '.');
    }

    public function getStatusBadgeColorAttribute(): string
    {
        return match ($this->status) {
            'draft' => 'gray',
            'pending' => 'yellow',
            'approved' => 'blue',
            'rejected' => 'red',
            'paid' => 'green',
            default => 'gray',
        };
    }

    public function getPaymentStatusBadgeColorAttribute(): string
    {
        return match ($this->payment_status) {
            'unpaid' => 'gray',
            'partial' => 'yellow',
            'paid' => 'green',
            default => 'gray',
        };
    }

    public function getStatusLabelAttribute(): string
    {
        return match ($this->status) {
            'draft' => 'Draft',
            'pending' => 'Menunggu review',
            'approved' => 'Disetujui',
            'rejected' => 'Ditolak',
            'paid' => 'Lunas',
            default => ucfirst($this->status),
        };
    }

    public function getPaymentStatusLabelAttribute(): string
    {
        return match ($this->payment_status) {
            'unpaid' => 'Belum Dibayar',
            'partial' => 'Cicilan',
            'paid' => 'Lunas',
            default => ucfirst($this->payment_status),
        };
    }

    public function getCategoryLabelAttribute(): string
    {
        // Use FK category if set by finance, fallback to user input
        if ($this->relationLoaded('category') && $this->category) {
            return $this->category->label;
        }

        return static::categoryLabel($this->category_input);
    }

    /** Label kategori pilihan pemohon (bahasa Indonesia, sesuai UI). */
    public static function categoryLabel(?string $value): string
    {
        foreach (static::categories() as $category) {
            if ($category['value'] === $value) {
                return $category['label'];
            }
        }

        return $value ? ucfirst($value) : 'Lainnya';
    }

    // =====================================
    // UTILITY
    // =====================================

    public static function parseAmount(string $amount): int
    {
        return (int) preg_replace('/[^0-9]/', '', $amount);
    }

    public static function categories(): array
    {
        return [
            ['label' => 'Transportasi', 'value' => 'transport'],
            ['label' => 'Makan & jamuan', 'value' => 'meals'],
            ['label' => 'Perlengkapan kantor', 'value' => 'office_supplies'],
            ['label' => 'Komunikasi', 'value' => 'communication'],
            ['label' => 'Akomodasi', 'value' => 'accommodation'],
            ['label' => 'Kesehatan', 'value' => 'medical'],
            ['label' => 'Lainnya', 'value' => 'other'],
        ];
    }

    public static function statuses(): array
    {
        return [
            ['label' => 'Draft', 'value' => 'draft'],
            ['label' => 'Menunggu review', 'value' => 'pending'],
            ['label' => 'Disetujui', 'value' => 'approved'],
            ['label' => 'Ditolak', 'value' => 'rejected'],
            ['label' => 'Lunas', 'value' => 'paid'],
        ];
    }

    // =====================================
    // BOOT
    // =====================================

    protected static function boot()
    {
        parent::boot();

        // Delete attachment when model is deleted
        static::deleting(function ($reimbursement) {
            // Lampiran disimpan di disk "public" (lihat controller store/update), bukan disk default.
            if ($reimbursement->attachment_path && Storage::disk('public')->exists($reimbursement->attachment_path)) {
                Storage::disk('public')->delete($reimbursement->attachment_path);
            }
        });
    }
}
