<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BankAccount extends Model
{
    use HasFactory;

    protected $fillable = [
        'account_name',
        'account_number',
        'bank_name',
        'branch',
        'initial_balance',
    ];

    protected $casts = [
        'initial_balance' => 'integer',
    ];

    protected $appends = ['balance'];

    /** Kolom bantu hasil withBalance(); internal, jangan ikut terserialisasi ke frontend. */
    protected $hidden = ['payments_sum', 'credits_sum', 'debits_sum'];

    /**
     * Hitung saldo sebagai subquery skalar, satu statement untuk berapa pun jumlah rekening.
     *
     * Tanpa ini, accessor `balance` menjalankan tiga query agregat per rekening, dan
     * `$appends` memanggilnya di setiap serialisasi — dashboard sendiri membayarnya
     * 3 x (1 + 3N) kali hanya untuk saldo.
     *
     * @param  Builder<BankAccount>  $query
     * @return Builder<BankAccount>
     */
    public function scopeWithBalance(Builder $query): Builder
    {
        $table = $this->getTable();

        if (empty($query->getQuery()->columns)) {
            $query->select("{$table}.*");
        }

        return $query->addSelect([
            'payments_sum' => Payment::selectRaw('COALESCE(SUM(amount), 0)')
                ->whereColumn('payments.bank_account_id', "{$table}.id"),
            'credits_sum' => BankTransaction::selectRaw('COALESCE(SUM(amount), 0)')
                ->whereColumn('bank_transactions.bank_account_id', "{$table}.id")
                ->where('transaction_type', 'credit'),
            'debits_sum' => BankTransaction::selectRaw('COALESCE(SUM(amount), 0)')
                ->whereColumn('bank_transactions.bank_account_id', "{$table}.id")
                ->where('transaction_type', 'debit'),
        ]);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(BankTransaction::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function loanPayments(): HasMany
    {
        return $this->hasMany(LoanPayment::class);
    }

    // Current balance calculation
    public function getBalanceAttribute(): int
    {
        // Jalur termurah: saldo sudah dihitung di SQL oleh scopeWithBalance().
        if (isset($this->attributes['payments_sum'])) {
            return (int) $this->initial_balance
                + (int) $this->attributes['payments_sum']
                + (int) $this->attributes['credits_sum']
                - (int) $this->attributes['debits_sum'];
        }

        if ($this->relationLoaded('payments') && $this->relationLoaded('transactions')) {
            $payments = $this->payments->sum('amount');
            $credits = $this->transactions->where('transaction_type', 'credit')->sum('amount');
            $debits = $this->transactions->where('transaction_type', 'debit')->sum('amount');
        } else {
            $payments = $this->payments()->sum('amount');
            $credits = $this->transactions()->where('transaction_type', 'credit')->sum('amount');
            $debits = $this->transactions()->where('transaction_type', 'debit')->sum('amount');
        }

        return $this->initial_balance + $payments + $credits - $debits;
    }

    // Formatted currency display
    public function getFormattedBalanceAttribute(): string
    {
        return 'Rp '.number_format($this->balance, 0, ',', '.');
    }

    public function getFormattedInitialBalanceAttribute(): string
    {
        return 'Rp '.number_format($this->initial_balance, 0, ',', '.');
    }

    // Parse currency string to integer
    public static function parseAmount(string $amount): int
    {
        return (int) preg_replace('/[^0-9]/', '', $amount);
    }
}
