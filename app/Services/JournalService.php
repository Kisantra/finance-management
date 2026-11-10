<?php

namespace App\Services;

use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Invoice;
use App\Models\Loan;
use App\Models\Payment;
use App\Models\Receivable;
use App\Models\TransactionCategory;
use Illuminate\Support\Collection;

/**
 * Jurnal tampilan ("Cara A"): baris debit/kredit yang DITURUNKAN dari data yang sudah ada —
 * rekening + kategori + arah + jumlah, dan untuk pembayaran invoice dari titipan pajak & PPN
 * invoicenya. Tidak ada yang disimpan dan ini BUKAN buku besar (belum ada bagan akun maupun
 * saldo per akun); Laba Rugi tidak membacanya. Satu-satunya definisi aturan jurnal untuk transaksi
 * & pembayaran yang tersimpan; pratinjau di formulir mencerminkannya di
 * resources/js/lib/journal.ts. Lihat docs/module/cash-flow.md › Jurnal.
 *
 * Setiap jurnal: debit dulu, lalu kredit; Σ debit = Σ kredit; nominal rupiah penuh; baris bernilai
 * nol tidak ditampilkan.
 */
class JournalService
{
    /** Akun yang dikredit porsi PPN pembayaran invoice — sama dengan akun lawan "Setor PPN". */
    public const PPN_KELUARAN = 'PPN Keluaran';

    /** Akun yang dikredit porsi titipan pajak klien — sama dengan akun lawan "Setor Titipan Pajak Klien". */
    public const TAX_DEPOSIT = 'Titipan Pajak Klien';

    public const INVOICE_REVENUE = 'Pendapatan dari Invoice';

    public const LOAN = 'Utang Pinjaman';

    public const RECEIVABLE = 'Piutang';

    /** Selisih kaki keluar − kaki masuk satu transfer (biaya admin bank). */
    public const TRANSFER_FEE = 'Biaya Admin Transfer';

    public const UNCATEGORIZED = 'Tanpa Kategori';

    /**
     * Nama akun sistem untuk layar, dalam bahasa pengguna. Konstanta di atas tetap menjadi identitas
     * (pembanding, kunci); terjemahan hanya di batas keluaran. Nama lain (label kategori, nama
     * rekening) adalah data dan lewat apa adanya.
     */
    public static function terjemahAkun(string $akun): string
    {
        return match ($akun) {
            self::PPN_KELUARAN => __('PPN Keluaran'),
            self::TAX_DEPOSIT => __('Titipan Pajak Klien'),
            self::INVOICE_REVENUE => __('Pendapatan dari Invoice'),
            self::LOAN => __('Utang Pinjaman'),
            self::RECEIVABLE => __('Piutang'),
            self::TRANSFER_FEE => __('Biaya Admin Transfer'),
            self::UNCATEGORIZED => __('Tanpa Kategori'),
            'Modal Pemilik' => __('Modal Pemilik'),
            'Prive Pemilik' => __('Prive Pemilik'),
            default => $akun,
        };
    }

    /**
     * Akun lawan sebuah kategori: pokok utang/piutang → "Utang Pinjaman"/"Piutang" (nama pihaknya
     * ditambahkan per transaksi); sub pendanaan template → akun neraca
     * (CategoryTemplateService::JOURNAL_ACCOUNTS); selain itu labelnya sendiri — pemasukan,
     * pengeluaran (termasuk bunga EXP-/REV-INTEREST), penyesuaian, kaki transfer tanpa pasangan,
     * dan pendanaan buatan pengguna.
     */
    public static function counterAccount(?string $type, ?string $systemKey, ?string $label): string
    {
        $modul = TransactionCategory::POKOK_MODUL[(string) $systemKey]['module'] ?? null;

        if ($modul !== null) {
            return self::terjemahAkun($modul === 'loans' ? self::LOAN : self::RECEIVABLE);
        }

        $label = trim((string) $label);

        if ($label === '') {
            return self::terjemahAkun(self::UNCATEGORIZED);
        }

        return $type === 'financing' ? self::terjemahAkun(CategoryTemplateService::journalAccount($label) ?? $label) : $label;
    }

    public static function counterAccountFor(TransactionCategory $category): string
    {
        return self::counterAccount($category->type, $category->system_key, $category->label);
    }

    /**
     * Uang masuk: Debit rekening / Kredit akun lawan. Uang keluar: Debit akun lawan / Kredit rekening.
     *
     * @param  'credit'|'debit'|string  $direction  arah transaksi bank (credit = masuk)
     * @return list<array{account: string, side: 'debit'|'credit', amount: int}>
     */
    public static function cashLines(string $account, string $direction, int $amount, string $counter): array
    {
        if ($amount <= 0) {
            return [];
        }

        return $direction === 'credit'
            ? [self::line($account, 'debit', $amount), self::line($counter, 'credit', $amount)]
            : [self::line($counter, 'debit', $amount), self::line($account, 'credit', $amount)];
    }

    /**
     * Transfer antar rekening: Debit rekening tujuan (yang diterima) + Debit biaya admin / Kredit
     * rekening asal (yang keluar = jumlah + biaya admin).
     *
     * @return list<array{account: string, side: 'debit'|'credit', amount: int}>
     */
    public static function transferLines(string $from, string $to, int $amount, int $adminFee): array
    {
        return self::withoutZero([
            self::line($to, 'debit', $amount),
            self::line(self::terjemahAkun(self::TRANSFER_FEE), 'debit', $adminFee),
            self::line($from, 'credit', $amount + $adminFee),
        ]);
    }

    /**
     * Pembayaran invoice: Debit rekening (penuh) / Kredit dipecah mengikuti "titipan dulu" Laba Rugi
     * (Invoice::allocatePayments): bagian satu pembayaran = alokasi kumulatif SESUDAH pembayaran ini
     * dikurangi alokasi kumulatif SEBELUMNYA (urut payment_date, id) — bukan proporsional. HPP tidak
     * dijurnal di sini: pengakuan HPP (cost recovery) tidak menggerakkan uang.
     *
     * @return list<array{account: string, side: 'debit'|'credit', amount: int}>
     */
    public static function paymentLines(string $account, int $amount, int $paidBefore, int $taxDeposit, int $ppn): array
    {
        if ($amount <= 0) {
            return [];
        }

        $sebelum = Invoice::allocatePayments($paidBefore, $taxDeposit, $ppn);
        $sesudah = Invoice::allocatePayments($paidBefore + $amount, $taxDeposit, $ppn);

        return self::withoutZero([
            self::line($account, 'debit', $amount),
            self::line(self::terjemahAkun(self::TAX_DEPOSIT), 'credit', $sesudah['tax_deposit'] - $sebelum['tax_deposit']),
            self::line(self::terjemahAkun(self::PPN_KELUARAN), 'credit', $sesudah['ppn'] - $sebelum['ppn']),
            self::line(self::terjemahAkun(self::INVOICE_REVENUE), 'credit', $sesudah['revenue'] - $sebelum['revenue']),
        ]);
    }

    /**
     * Jurnal per baris transaksi bank (baris query builder atau rowOf()). Nama pemberi pinjaman &
     * debitur pokok utang/piutang dicari sekali untuk seluruh halaman (bukan per baris); kaki transfer
     * berpasangan juga dicari dalam satu query. Baris butuh: id, transaction_type, amount,
     * category_type, category_system_key, category_label, reference_number, description,
     * account_name, bank_name, account_type, dan (untuk kaki transfer) transfer_group_id.
     *
     * @param  Collection<int, object>  $rows
     * @return list<list<array{account: string, side: 'debit'|'credit', amount: int}>> per indeks baris
     */
    public static function forTransactions(Collection $rows): array
    {
        $rows = $rows->values();
        $pihak = self::partyNames($rows);
        $transfer = self::transferPairs($rows);

        return $rows->map(function (object $row) use ($pihak, $transfer): array {
            if (isset($transfer[$row->id ?? null])) {
                return $transfer[$row->id];
            }

            $rekening = BankAccount::journalNameFor($row->account_name ?? null, $row->bank_name ?? null, $row->account_type ?? null);

            return self::cashLines($rekening, (string) $row->transaction_type, (int) $row->amount, self::counterForRow($row, $pihak));
        })->all();
    }

    /**
     * Jurnal per baris pembayaran invoice, dua query untuk seluruh halaman: pembayaran semua invoice
     * terkait (urut payment_date, id → jumlah yang sudah dibayar SEBELUM tiap pembayaran) dan titipan
     * pajak + PPN invoicenya. Baris butuh: id, invoice_id, amount, account_name, bank_name, account_type.
     *
     * @param  Collection<int, object>  $rows
     * @return list<list<array{account: string, side: 'debit'|'credit', amount: int}>> per indeks baris
     */
    public static function forPayments(Collection $rows): array
    {
        $rows = $rows->values();
        $invoiceIds = $rows->pluck('invoice_id')->filter()->unique()->values();

        if ($invoiceIds->isEmpty()) {
            return $rows->map(fn (): array => [])->all();
        }

        $dibayarSebelum = [];
        Payment::query()->whereIn('invoice_id', $invoiceIds)->orderBy('payment_date')->orderBy('id')
            ->get(['id', 'invoice_id', 'amount'])
            ->groupBy('invoice_id')
            ->each(function (Collection $pembayaran) use (&$dibayarSebelum): void {
                $jalan = 0;
                foreach ($pembayaran as $p) {
                    $dibayarSebelum[$p->id] = $jalan;
                    $jalan += (int) $p->amount;
                }
            });

        $invoices = Invoice::query()->whereIn('id', $invoiceIds)
            ->withSum(['items as tax_deposit_total' => fn ($q) => $q->where('is_tax_deposit', true)], 'amount')
            ->get(['id', 'ppn_amount'])
            ->keyBy('id');

        return $rows->map(function (object $row) use ($dibayarSebelum, $invoices): array {
            $invoice = $invoices->get($row->invoice_id);

            return self::paymentLines(
                BankAccount::journalNameFor($row->account_name ?? null, $row->bank_name ?? null, $row->account_type ?? null),
                (int) $row->amount,
                $dibayarSebelum[$row->id] ?? 0,
                (int) ($invoice->tax_deposit_total ?? 0),
                (int) ($invoice->ppn_amount ?? 0),
            );
        })->all();
    }

    /**
     * Jurnal satu transaksi (bentuk tunggal forTransactions()).
     *
     * @return list<array{account: string, side: 'debit'|'credit', amount: int}>
     */
    public static function forTransaction(BankTransaction $transaction): array
    {
        return self::forTransactions(collect([self::rowOf($transaction)]))[0];
    }

    /**
     * Jurnal satu pembayaran invoice (bentuk tunggal forPayments()).
     *
     * @return list<array{account: string, side: 'debit'|'credit', amount: int}>
     */
    public static function forPayment(Payment $payment): array
    {
        $payment->loadMissing('bankAccount');

        return self::forPayments(collect([(object) [
            'id' => $payment->id,
            'invoice_id' => $payment->invoice_id,
            'amount' => $payment->amount,
            'account_name' => $payment->bankAccount?->account_name,
            'bank_name' => $payment->bankAccount?->bank_name,
            'account_type' => $payment->bankAccount?->type,
        ]]))[0];
    }

    /** Model transaksi → bentuk baris yang dibaca forTransactions(). */
    public static function rowOf(BankTransaction $transaction): object
    {
        $transaction->loadMissing('category', 'bankAccount');

        return (object) [
            'id' => $transaction->id,
            'transaction_type' => $transaction->transaction_type,
            'amount' => $transaction->amount,
            'category_type' => $transaction->category?->type,
            'category_system_key' => $transaction->category?->system_key,
            'category_label' => $transaction->category?->label,
            'reference_number' => $transaction->reference_number,
            'description' => $transaction->description,
            'transfer_group_id' => $transaction->transfer_group_id,
            'account_name' => $transaction->bankAccount?->account_name,
            'bank_name' => $transaction->bankAccount?->bank_name,
            'account_type' => $transaction->bankAccount?->type,
        ];
    }

    /**
     * Akun lawan satu baris: akun kategorinya, ditambah nama pihak untuk pokok utang/piutang
     * ("Utang Pinjaman – Bank BRI"). Nama tidak ketemu → akun tanpa nama.
     *
     * @param  array{loans: array<string, string>, receivables: array<string, string>}  $pihak
     */
    private static function counterForRow(object $row, array $pihak): string
    {
        $kunci = (string) ($row->category_system_key ?? '');
        $akun = self::counterAccount($row->category_type ?? null, $kunci, $row->category_label ?? null);

        $nama = match ($kunci) {
            'FIN-LOAN-IN' => $pihak['loans'][(string) $row->reference_number] ?? null,
            'FIN-LOAN-OUT' => BankTransaction::lenderFromDescription($row->description ?? null),
            'FIN-RCV-OUT' => $pihak['receivables'][(string) $row->reference_number] ?? null,
            'FIN-RCV-IN' => $pihak['receivables'][(string) BankTransaction::receivableNumberFromDescription($row->description ?? null)] ?? null,
            default => null,
        };

        $nama = trim((string) $nama);

        return $nama !== '' ? "{$akun} – {$nama}" : $akun;
    }

    /**
     * Nama pemberi pinjaman (per nomor utang, untuk FIN-LOAN-IN) dan nama debitur (per nomor piutang,
     * untuk FIN-RCV-OUT/IN) — masing-masing satu query, hanya bila halaman memuat baris itu. Debitur
     * polimorfik (klien di database perusahaan, karyawan di database pusat) dimuat lewat eager load.
     *
     * @param  Collection<int, object>  $rows
     * @return array{loans: array<string, string>, receivables: array<string, string>}
     */
    private static function partyNames(Collection $rows): array
    {
        $nomorUtang = $rows->where('category_system_key', 'FIN-LOAN-IN')->pluck('reference_number')->filter()->unique()->values();

        $nomorPiutang = $rows->where('category_system_key', 'FIN-RCV-OUT')->pluck('reference_number')
            ->merge($rows->where('category_system_key', 'FIN-RCV-IN')
                ->map(fn (object $row): ?string => BankTransaction::receivableNumberFromDescription($row->description ?? null)))
            ->filter()->unique()->values();

        return [
            'loans' => $nomorUtang->isEmpty() ? [] : Loan::query()->whereIn('loan_number', $nomorUtang)->pluck('lender_name', 'loan_number')->all(),
            'receivables' => $nomorPiutang->isEmpty() ? [] : Receivable::query()->with('debtor')->whereIn('receivable_number', $nomorPiutang)->get()
                ->mapWithKeys(fn (Receivable $r): array => [$r->receivable_number => (string) $r->debtor?->name])
                ->all(),
        ];
    }

    /**
     * Jurnal transfer untuk kaki-kaki transfer di halaman ini yang pasangannya ketemu (tepat satu
     * kaki keluar + satu kaki masuk dalam satu tautan: transfer_group_id, atau reference_number TRF
     * untuk baris warisan) — satu query. Kaki tanpa pasangan dijurnal biasa dengan label kategorinya.
     *
     * @param  Collection<int, object>  $rows
     * @return array<int, list<array{account: string, side: 'debit'|'credit', amount: int}>> per id transaksi
     */
    private static function transferPairs(Collection $rows): array
    {
        $kaki = $rows->filter(fn (object $row): bool => ($row->category_type ?? null) === 'transfer' && isset($row->id));
        $grup = $kaki->pluck('transfer_group_id')->filter()->unique()->values();
        $ref = $kaki->filter(fn (object $row): bool => empty($row->transfer_group_id) && str_starts_with((string) $row->reference_number, 'TRF'))
            ->pluck('reference_number')->unique()->values();

        if ($grup->isEmpty() && $ref->isEmpty()) {
            return [];
        }

        $pasangan = BankTransaction::query()
            ->with('bankAccount')
            ->whereHas('category', fn ($q) => $q->where('type', 'transfer'))
            ->where(fn ($q) => $q->whereIn('transfer_group_id', $grup)
                ->orWhere(fn ($w) => $w->whereNull('transfer_group_id')->whereIn('reference_number', $ref)))
            ->get()
            ->groupBy(fn (BankTransaction $t): string => $t->transfer_group_id ?: (string) $t->reference_number);

        $hasil = [];
        foreach ($pasangan as $legs) {
            $keluar = $legs->where('transaction_type', 'debit');
            $masuk = $legs->where('transaction_type', 'credit');

            if ($keluar->count() !== 1 || $masuk->count() !== 1) {
                continue;
            }

            $keluar = $keluar->first();
            $masuk = $masuk->first();

            // Kaki keluar = jumlah + biaya admin; lebih kecil dari kaki masuk berarti bukan pasangan wajar.
            if ((int) $keluar->amount < (int) $masuk->amount) {
                continue;
            }
            $baris = self::transferLines(
                $keluar->bankAccount?->journalName() ?? __('Rekening asal'),
                $masuk->bankAccount?->journalName() ?? __('Rekening tujuan'),
                (int) $masuk->amount,
                (int) $keluar->amount - (int) $masuk->amount,
            );
            $hasil[$keluar->id] = $baris;
            $hasil[$masuk->id] = $baris;
        }

        return $hasil;
    }

    /** @return array{account: string, side: 'debit'|'credit', amount: int} */
    private static function line(string $account, string $side, int $amount): array
    {
        return ['account' => $account, 'side' => $side, 'amount' => $amount];
    }

    /**
     * @param  list<array{account: string, side: 'debit'|'credit', amount: int}>  $lines
     * @return list<array{account: string, side: 'debit'|'credit', amount: int}>
     */
    private static function withoutZero(array $lines): array
    {
        return array_values(array_filter($lines, fn (array $line): bool => $line['amount'] > 0));
    }
}
