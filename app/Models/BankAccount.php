<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BankAccount extends Model
{
    use HasFactory;

    /** Rekening bank (jenis bawaan; semua baris sebelum ada kolom `type`). */
    public const TYPE_BANK = 'bank';

    /** Kas tunai / kas kecil: tanpa nomor rekening, boleh punya penanggung jawab dan plafon. */
    public const TYPE_CASH = 'cash';

    /**
     * Isi `bank_name` akun kas. Label rekening di modul lain disusun `nama — bank`, jadi kas
     * terbaca "Kas Kecil Kantor — Tunai" tanpa perubahan di modul-modul itu.
     */
    public const CASH_BANK_NAME = 'Tunai';

    /** Awalan kode pengganti nomor rekening akun kas: KAS-0001, KAS-0002, ... */
    public const CASH_CODE_PREFIX = 'KAS-';

    protected $fillable = [
        'type',
        'account_name',
        'account_number',
        'bank_name',
        'branch',
        'initial_balance',
        'custodian_id',
        'cash_limit',
    ];

    protected $attributes = [
        'type' => self::TYPE_BANK,
    ];

    protected $casts = [
        'initial_balance' => 'integer',
        'custodian_id' => 'integer',
        'cash_limit' => 'integer',
    ];

    protected $appends = ['balance'];

    /** Kolom bantu hasil withBalance(); internal, jangan ikut terserialisasi ke frontend. */
    protected $hidden = ['payments_sum', 'credits_sum', 'debits_sum'];

    /**
     * Akun kas tanpa nomor rekening / nama bank diisi otomatis, di jalur mana pun akun dibuat
     * (form, seeder, tinker): `account_number` dan `bank_name` NOT NULL dan dipakai label di
     * banyak modul. Nomor yang sudah ada tidak pernah diganti.
     */
    protected static function booted(): void
    {
        static::saving(function (BankAccount $akun): void {
            if (! $akun->isCash()) {
                return;
            }

            if (blank($akun->bank_name)) {
                $akun->bank_name = self::CASH_BANK_NAME;
            }

            if (blank($akun->account_number)) {
                $akun->account_number = self::generateCashCode();
            }
        });
    }

    public function isCash(): bool
    {
        return $this->type === self::TYPE_CASH;
    }

    /**
     * Nama akun ini di jurnal tampilan (JournalService): "BCA Operasional — BCA" untuk rekening
     * bank (sama dengan label pemilih rekening), cukup "Kas Kecil" untuk kas ("— Tunai" tidak
     * menambah informasi). Satu-satunya definisi; klien menerimanya sebagai `journal_name`.
     */
    public static function journalNameFor(?string $accountName, ?string $bankName, ?string $type): string
    {
        $nama = trim((string) $accountName);

        if ($type === self::TYPE_CASH || trim((string) $bankName) === '') {
            return $nama !== '' ? $nama : 'Kas';
        }

        return $nama.' — '.$bankName;
    }

    public function journalName(): string
    {
        return self::journalNameFor($this->account_name, $this->bank_name, $this->type);
    }

    /**
     * Kode unik pengganti nomor rekening untuk akun kas, melanjutkan kode KAS- terbesar yang
     * sudah ada (KAS-0001, KAS-0002, ...). Nomor rekening divalidasi unik di semua akun.
     */
    public static function generateCashCode(): string
    {
        $terpakai = static::query()
            ->where('account_number', 'like', self::CASH_CODE_PREFIX.'%')
            ->pluck('account_number')
            ->map(fn ($kode): string => strtoupper((string) $kode));

        $nomor = (int) $terpakai
            ->map(fn (string $kode): int => (int) substr($kode, strlen(self::CASH_CODE_PREFIX)))
            ->max();

        do {
            $kode = self::CASH_CODE_PREFIX.str_pad((string) ++$nomor, 4, '0', STR_PAD_LEFT);
        } while ($terpakai->contains($kode));

        return $kode;
    }

    /**
     * Kekurangan kas kecil terhadap plafonnya (plafon − saldo): nominal yang perlu diisi ulang.
     * 0 untuk rekening bank, kas tanpa plafon, atau saldo yang sudah mencapai plafon.
     *
     * @param  int|null  $balance  saldo yang sudah dihitung, agar tidak dihitung dua kali
     */
    public function refillAmount(?int $balance = null): int
    {
        if (! $this->isCash() || ! $this->cash_limit) {
            return 0;
        }

        return max(0, $this->cash_limit - ($balance ?? $this->balance));
    }

    /**
     * Nama penanggung jawab per id untuk sekumpulan akun. Pengguna hidup di database PUSAT:
     * dicari lewat whereIn, tidak di-join dari database perusahaan.
     *
     * @param  iterable<BankAccount>  $accounts
     * @return array<int, string>
     */
    public static function custodianNames(iterable $accounts): array
    {
        $ids = collect($accounts)->pluck('custodian_id')->filter()->map(fn ($id): int => (int) $id)->unique()->values();

        return $ids->isEmpty() ? [] : User::query()->whereIn('id', $ids)->pluck('name', 'id')->all();
    }

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
