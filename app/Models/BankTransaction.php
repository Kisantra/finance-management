<?php

namespace App\Models;

use App\Models\Concerns\MencatatPengguna;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;

class BankTransaction extends Model
{
    use HasFactory, MencatatPengguna;

    protected $fillable = [
        'bank_account_id',
        'amount',
        'transaction_date',
        'transaction_type',
        'description',
        'reference_number',
        'transfer_group_id',
        'attachment_path',
        'attachment_name',
        'category_id',
    ];

    protected $casts = [
        'transaction_date' => 'date',
        'amount' => 'integer',
    ];

    public function bankAccount(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(TransactionCategory::class);
    }

    /**
     * Resolve which cash-flow feature this transaction belongs to for permission
     * checks. Transfer legs (TRF reference) override the credit/debit direction.
     */
    public function permissionFeature(): string
    {
        if ($this->reference_number && str_starts_with($this->reference_number, 'TRF')) {
            return 'transfer';
        }

        return $this->transaction_type === 'credit' ? 'income' : 'expense';
    }

    /**
     * Build the permission name for an action against this transaction's feature,
     * e.g. "delete transfer" or "edit income".
     */
    public function abilityFor(string $action): string
    {
        return $action.' '.$this->permissionFeature();
    }

    /**
     * Feature name for a fresh income/expense entry given its accounting
     * direction. Transfers are created through the dedicated transfer endpoint.
     */
    public static function featureForType(string $transactionType): string
    {
        return $transactionType === 'credit' ? 'income' : 'expense';
    }

    /**
     * Modul yang mengelola transaksi ini bila ia pokok utang/piutang (kategori sistem FIN-*):
     * 'loans' / 'receivables'; null bila transaksi biasa yang boleh diubah dari Arus Kas / Kas & Bank.
     *
     * Pengecualian: penerimaan utang (FIN-LOAN-IN) yang utangnya sudah tidak ada. LoanController::destroy
     * kini ikut menghapus pencairannya, tetapi data lama bisa menyimpan pencairan yatim dari utang yang
     * dihapus sebelum perbaikan itu. Mengunci transaksi yatim membuat saldo tidak bisa dikoreksi sama
     * sekali (tautan "kelola di Utang" pun tidak menemukan apa-apa), jadi ia diperlakukan transaksi biasa.
     */
    public function managingModule(): ?string
    {
        $kunci = (string) $this->category?->system_key;
        $modul = TransactionCategory::POKOK_MODUL[$kunci]['module'] ?? null;

        if ($modul === 'loans' && $kunci === 'FIN-LOAN-IN'
            && ! Loan::query()->where('loan_number', (string) $this->reference_number)->exists()) {
            return null;
        }

        return $modul;
    }

    /** Pesan penolakan ubah/hapus transaksi yang dikelola modul Utang/Piutang; null bila bebas diubah. */
    public function moduleLockMessage(): ?string
    {
        return match ($this->managingModule()) {
            'loans' => 'Transaksi ini pokok utang yang dicatat otomatis oleh modul Utang, jadi tidak bisa diubah atau dihapus dari sini. Kelola lewat menu Utang.',
            'receivables' => 'Transaksi ini pokok piutang yang dicatat otomatis oleh modul Piutang, jadi tidak bisa diubah atau dihapus dari sini. Kelola lewat menu Piutang.',
            default => null,
        };
    }

    /**
     * Tautan "kelola di Utang/Piutang" untuk baris daftar (query builder, bukan model): satu query
     * untuk seluruh halaman. Baris butuh kolom `category_system_key`, `reference_number`, `description`.
     *
     * Kata cari yang membuka data spesifiknya di halaman modul (`?search=`):
     * - FIN-LOAN-IN / FIN-RCV-OUT → `reference_number` = nomor utang/piutang (diisi LoanController /
     *   ReceivableController saat mencatat);
     * - FIN-RCV-IN → nomor piutang dari deskripsi "Pembayaran piutang pokok: {nomor} - …";
     * - FIN-LOAN-OUT → nama pemberi pinjaman dari deskripsi "Pembayaran pokok pinjaman - {nama}" (bisa
     *   lebih dari satu utang); `reference_number`-nya isian bebas pengguna, bukan nomor utang.
     * Bila tidak bisa ditentukan, `search` null → halaman indeks modul.
     *
     * @param  Collection<int, object>  $rows
     * @return array<int, array{module: 'loans'|'receivables', label: string, search: string|null}|null> per indeks baris
     */
    public static function moduleLinks(Collection $rows): array
    {
        $nomorUtang = $rows->where('category_system_key', 'FIN-LOAN-IN')->pluck('reference_number')->filter()->unique()->values();
        $utangAda = $nomorUtang->isEmpty()
            ? collect()
            : Loan::query()->whereIn('loan_number', $nomorUtang)->pluck('loan_number')->flip();

        return $rows->map(function (object $row) use ($utangAda): ?array {
            $kunci = (string) ($row->category_system_key ?? '');
            $modul = TransactionCategory::POKOK_MODUL[$kunci]['module'] ?? null;

            if ($modul === null) {
                return null;
            }

            $search = match ($kunci) {
                'FIN-LOAN-IN', 'FIN-RCV-OUT' => $row->reference_number ?: null,
                'FIN-RCV-IN' => preg_match('/^Pembayaran piutang pokok: (\S+) - /u', (string) $row->description, $m) ? $m[1] : null,
                'FIN-LOAN-OUT' => preg_match('/^Pembayaran pokok pinjaman - (.+)$/u', (string) $row->description, $m) ? trim($m[1]) : null,
                default => null,
            };

            // Sama dengan managingModule(): pencairan utang yatim (utangnya sudah tidak ada) tidak dikunci.
            if ($kunci === 'FIN-LOAN-IN' && ! $utangAda->has((string) $row->reference_number)) {
                return null;
            }

            return ['module' => $modul, 'label' => $modul === 'loans' ? 'Utang' : 'Piutang', 'search' => $search];
        })->all();
    }

    /**
     * Transfer antar akun sendiri, per kelompok kaki — satu-satunya definisi yang dipakai angka
     * Pemasukan/Pengeluaran TINGKAT PERUSAHAAN (kartu & grafik semua rekening serta donat di
     * Ringkasan, Ringkasan Total di Kas & Bank, alat Claude ringkasan-keuangan). Lihat
     * docs/module/dashboard.md › Transfer antar akun sendiri.
     *
     * Kaki transfer = baris yang kategorinya bertipe `transfer`. Kaki-kaki dikelompokkan per
     * tanggal dan per tautan: `transfer_group_id`, atau untuk baris warisan sebelum kolom itu ada
     * `reference_number` berawalan TRF. Kaki tanpa tautan (dicatat sendiri lewat dialog
     * Pemasukan/Pengeluaran yang juga menawarkan kategori transfer) berkumpul dalam satu kelompok
     * per tanggal, sehingga transfer yang dicatat manual sebagai dua kaki tetap saling meniadakan.
     *
     * Per kelompok: `credit` = Σ kaki masuk, `debit` = Σ kaki keluar (jumlah + biaya admin), dan
     * `internal` = min(credit, debit) = uang yang hanya berpindah antar akun sendiri. Di tingkat
     * perusahaan `internal` bukan pemasukan maupun pengeluaran; sisanya tetap uang yang benar-benar
     * keluar/masuk perusahaan — `debit − internal` pada transfer bertautan adalah biaya admin.
     * Karena `internal` dikurangkan dari KEDUA sisi, Pemasukan − Pengeluaran tetap sama dengan
     * perubahan total saldo, dan kaki tanpa lawan tidak pernah menjadi pengeluaran negatif.
     *
     * Angka SATU rekening (filter rekening grafik Ringkasan, statistik per akun di Kas & Bank)
     * tidak memakai ini: bagi satu rekening, transfer memang uang masuk/keluar.
     *
     * @return Collection<int, object{date: string, linked: string|null, category: string|null, credit: int, debit: int, internal: int}>
     */
    public static function internalTransferGroups(CarbonInterface|string|null $from = null, CarbonInterface|string|null $to = null): Collection
    {
        return self::internalTransferGroupQuery($from, $to)
            ->get()
            ->map(fn (object $group): object => (object) [
                'date' => (string) $group->transfer_date,
                'linked' => $group->transfer_link,
                'category' => $group->category_label,
                'credit' => (int) $group->credit_total,
                'debit' => (int) $group->debit_total,
                'internal' => (int) $group->internal_total,
            ]);
    }

    /**
     * Σ `internal` dari internalTransferGroups() dalam rentang yang sama, dihitung di database:
     * nominal yang dikurangkan dari Pemasukan DAN Pengeluaran tingkat perusahaan.
     */
    public static function internalTransferTotal(CarbonInterface|string|null $from = null, CarbonInterface|string|null $to = null): int
    {
        $groups = self::internalTransferGroupQuery($from, $to);

        return (int) $groups->newQuery()->fromSub($groups, 'internal_transfer_groups')->sum('internal_total');
    }

    /**
     * Satu baris per kelompok kaki transfer (lihat internalTransferGroups()). Rentang memakai
     * perbandingan yang sama dengan whereBetween() pemanggil, jadi Carbon akhir hari dan string
     * Y-m-d sama-sama berlaku. CASE alih-alih LEAST/GREATEST supaya sama di MySQL dan SQLite.
     */
    private static function internalTransferGroupQuery(CarbonInterface|string|null $from, CarbonInterface|string|null $to): QueryBuilder
    {
        $link = "CASE WHEN bank_transactions.transfer_group_id IS NOT NULL THEN bank_transactions.transfer_group_id
            WHEN bank_transactions.reference_number LIKE 'TRF%' THEN bank_transactions.reference_number END";
        $credit = "SUM(CASE WHEN bank_transactions.transaction_type = 'credit' THEN bank_transactions.amount ELSE 0 END)";
        $debit = "SUM(CASE WHEN bank_transactions.transaction_type = 'debit' THEN bank_transactions.amount ELSE 0 END)";

        return static::query()
            ->join('transaction_categories as transfer_category', 'transfer_category.id', '=', 'bank_transactions.category_id')
            ->where('transfer_category.type', 'transfer')
            ->when($from !== null, fn ($query) => $query->where('bank_transactions.transaction_date', '>=', $from))
            ->when($to !== null, fn ($query) => $query->where('bank_transactions.transaction_date', '<=', $to))
            ->groupBy('bank_transactions.transaction_date')
            ->groupByRaw($link)
            ->selectRaw('MIN(bank_transactions.transaction_date) AS transfer_date')
            ->selectRaw("MIN({$link}) AS transfer_link")
            ->selectRaw('MIN(transfer_category.label) AS category_label')
            ->selectRaw("{$credit} AS credit_total")
            ->selectRaw("{$debit} AS debit_total")
            ->selectRaw("CASE WHEN {$credit} < {$debit} THEN {$credit} ELSE {$debit} END AS internal_total")
            ->toBase();
    }

    // Format currency for display
    public function getFormattedAmountAttribute(): string
    {
        return 'Rp '.number_format($this->amount, 0, ',', '.');
    }

    // Convert rupiah string to integer (remove formatting)
    public static function parseAmount(string $amount): int
    {
        return (int) preg_replace('/[^0-9]/', '', $amount);
    }

    // Attachment helpers
    public function getAttachmentUrlAttribute(): ?string
    {
        return $this->attachment_path ? Storage::disk('public')->url($this->attachment_path) : null;
    }

    public function hasAttachment(): bool
    {
        return ! empty($this->attachment_path);
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
        return in_array($this->attachment_type, ['jpg', 'jpeg', 'png']);
    }

    public function isPdfAttachment(): bool
    {
        return $this->attachment_type === 'pdf';
    }

    // Delete attachment when model is deleted
    protected static function boot()
    {
        parent::boot();

        static::deleting(function ($transaction) {
            if (! $transaction->attachment_path) {
                return;
            }

            // Transfer tersimpan sebagai dua baris yang berbagi satu berkas
            // lampiran. Menghapus salah satu leg tidak boleh membuang berkas
            // yang masih dirujuk leg pasangannya.
            $masihDipakai = static::where('attachment_path', $transaction->attachment_path)
                ->whereKeyNot($transaction->getKey())
                ->exists();

            if (! $masihDipakai && Storage::disk('public')->exists($transaction->attachment_path)) {
                Storage::disk('public')->delete($transaction->attachment_path);
            }
        });
    }
}
