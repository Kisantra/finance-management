<?php

namespace App\Http\Controllers;

use App\Http\Requests\PayLoanRequest;
use App\Http\Requests\StoreLoanRequest;
use App\Http\Requests\UpdateLoanRequest;
use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Loan;
use App\Models\LoanPayment;
use App\Models\TransactionCategory;
use App\Services\JadwalAngsuranService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class LoanController extends Controller
{
    public function index(Request $request): Response
    {
        $search = $request->input('search');
        $status = $request->input('status');
        $perPage = (int) $request->input('per_page', 15);
        $page = (int) $request->input('page', 1);

        $query = Loan::withSum('payments', 'principal_paid')
            ->withSum('payments', 'interest_paid');

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('loan_number', 'like', "%{$search}%")
                    ->orWhere('lender_name', 'like', "%{$search}%");
            });
        }
        if ($status) {
            $query->where('status', $status);
        }

        $paginator = $query->orderBy('start_date', 'desc')
            ->paginate($perPage, ['*'], 'page', $page);

        $statsRow = Loan::selectRaw("
            COUNT(*) as total,
            SUM(principal_amount) as total_principal,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
            SUM(CASE WHEN status = 'active' THEN principal_amount ELSE 0 END) as active_principal,
            MIN(CASE WHEN status = 'active' THEN maturity_date END) as next_maturity
        ")->first();

        // Dicakup ke pinjaman AKTIF, bukan seluruh pembayaran: sisa pokok hanya punya arti
        // untuk utang yang masih berjalan, dan pinjaman yang ditandai lunas secara manual
        // (pembayarannya tidak genap) akan menggeser angkanya kalau ikut dijumlah.
        $terbayarAktif = LoanPayment::whereHas('loan', fn ($q) => $q->where('status', 'active'))
            ->selectRaw('COALESCE(SUM(principal_paid), 0) as pokok, COALESCE(SUM(interest_paid), 0) as bunga')
            ->first();

        $activePrincipal = (int) ($statsRow->active_principal ?? 0);
        $paidPrincipal = (int) ($terbayarAktif->pokok ?? 0);

        $rows = $paginator->map(fn (Loan $l) => [
            'id' => $l->id,
            'loan_number' => $l->loan_number,
            'lender_name' => $l->lender_name,
            'principal_amount' => $l->principal_amount,
            'interest_type' => $l->interest_type,
            'interest_amount' => $l->interest_amount,
            'interest_rate' => $l->interest_rate,
            'term_months' => $l->term_months,
            'start_date' => $l->start_date?->format('Y-m-d'),
            'maturity_date' => $l->maturity_date?->format('Y-m-d'),
            'status' => $l->status,
            'purpose' => $l->purpose,
            'contract_attachment_url' => $l->contract_attachment ? Storage::disk('public')->url($l->contract_attachment) : null,
            'paid_principal' => (int) ($l->payments_sum_principal_paid ?? 0),
            'paid_interest' => (int) ($l->payments_sum_interest_paid ?? 0),
            'remaining_principal' => $l->principal_amount - (int) ($l->payments_sum_principal_paid ?? 0),
        ]);

        $bankAccountOptions = BankAccount::with(['payments', 'transactions'])
            ->orderBy('account_name')
            ->get()
            ->map(fn ($b) => [
                'value' => $b->id,
                'label' => $b->account_name.' — '.$b->bank_name.' ('.$b->formatted_balance.')',
            ]);

        $nextLoanNumber = $this->generateLoanNumber();

        return Inertia::render('loans/index', [
            'rows' => $rows,
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
            'stats' => [
                'total' => (int) ($statsRow->total ?? 0),
                'total_principal' => (int) ($statsRow->total_principal ?? 0),
                'active_count' => (int) ($statsRow->active_count ?? 0),
                'active_principal' => $activePrincipal,
                'outstanding_principal' => max(0, $activePrincipal - $paidPrincipal),
                'paid_principal' => $paidPrincipal,
                'paid_interest' => (int) ($terbayarAktif->bunga ?? 0),
                'next_maturity' => $statsRow->next_maturity
                    ? Carbon::parse($statsRow->next_maturity)->toDateString()
                    : null,
            ],
            'filters' => [
                'search' => $search,
                'status' => $status,
                'per_page' => $perPage,
                'page' => $page,
            ],
            'bankAccountOptions' => $bankAccountOptions,
            'nextLoanNumber' => $nextLoanNumber,
        ]);
    }

    public function store(StoreLoanRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        $attachmentPath = null;
        if ($request->hasFile('contract_attachment')) {
            $attachmentPath = $request->file('contract_attachment')->store('loans', 'public');
        }

        DB::transaction(function () use ($validated, $attachmentPath) {
            $loan = Loan::create([
                'loan_number' => $validated['loan_number'],
                'lender_name' => $validated['lender_name'],
                'principal_amount' => $validated['principal_amount'],
                'interest_type' => $validated['interest_type'],
                'interest_amount' => $validated['interest_type'] === 'fixed' ? $validated['interest_amount'] : null,
                'interest_rate' => $validated['interest_type'] === 'percentage' ? $validated['interest_rate'] : null,
                'term_months' => $validated['term_months'],
                'start_date' => $validated['start_date'],
                'maturity_date' => $validated['maturity_date'],
                'status' => 'active',
                'purpose' => $validated['purpose'] ?? null,
                'contract_attachment' => $attachmentPath,
            ]);

            $category = TransactionCategory::findSystem('FIN-LOAN-IN');

            BankTransaction::create([
                'bank_account_id' => $validated['bank_account_id'],
                'amount' => $validated['principal_amount'],
                'transaction_type' => 'credit',
                'transaction_date' => $validated['start_date'],
                'description' => "Penerimaan pinjaman dari {$validated['lender_name']}",
                'reference_number' => $validated['loan_number'],
                'category_id' => $category?->id,
            ]);
        });

        return back()->with('success', 'Pinjaman berhasil dibuat');
    }

    public function update(UpdateLoanRequest $request, Loan $loan): RedirectResponse
    {
        // Nominal pokok dan tanggal mulai sudah tercermin di mutasi bank.
        // Mengubahnya tanpa menyinkronkan transaksi membuat saldo dan riwayat
        // pinjaman bercerita berbeda, jadi keduanya dikunci begitu pencairan
        // tercatat. Kolom lain (nama pemberi pinjaman, catatan, lampiran)
        // tetap dapat disunting.
        $adaPencairan = BankTransaction::where('reference_number', $loan->loan_number)
            ->where('transaction_type', 'credit')
            ->exists();

        abort_if($loan->status !== 'active', 403, 'Pinjaman yang sudah lunas tidak dapat diedit');

        $validated = $request->validated();

        $attachmentPath = $loan->contract_attachment;

        if ($request->boolean('remove_attachment') && $attachmentPath) {
            Storage::disk('public')->delete($attachmentPath);
            $attachmentPath = null;
        }

        if ($request->hasFile('contract_attachment')) {
            if ($attachmentPath) {
                Storage::disk('public')->delete($attachmentPath);
            }
            $attachmentPath = $request->file('contract_attachment')->store('loans', 'public');
        }

        $loan->update([
            'lender_name' => $validated['lender_name'],
            // Nominal pokok & tanggal mulai dipertahankan bila pencairannya
            // sudah tercatat di bank (lihat catatan di awal metode).
            'principal_amount' => $adaPencairan ? $loan->principal_amount : $validated['principal_amount'],
            'interest_type' => $validated['interest_type'],
            'interest_amount' => $validated['interest_type'] === 'fixed' ? $validated['interest_amount'] : null,
            'interest_rate' => $validated['interest_type'] === 'percentage' ? $validated['interest_rate'] : null,
            'term_months' => $validated['term_months'],
            'start_date' => $adaPencairan ? $loan->start_date : $validated['start_date'],
            'maturity_date' => $validated['maturity_date'],
            'purpose' => $validated['purpose'] ?? null,
            'contract_attachment' => $attachmentPath,
        ]);

        return back()->with('success', 'Pinjaman berhasil diperbarui');
    }

    public function destroy(Loan $loan): RedirectResponse
    {
        abort_if($loan->payments()->exists(), 403, 'Pinjaman yang sudah memiliki pembayaran tidak dapat dihapus');

        DB::transaction(function () use ($loan) {
            // Pencairan pinjaman membentuk transaksi masuk di bank, ditautkan
            // lewat `reference_number` = nomor pinjaman. Menghapus pinjamannya
            // saja meninggalkan dana masuk yatim yang menggelembungkan saldo
            // tanpa dokumen pendukung. Karena penghapusan hanya diizinkan
            // selama belum ada pembayaran, membalik pencairannya aman.
            BankTransaction::where('reference_number', $loan->loan_number)
                ->where('transaction_type', 'credit')
                ->get()
                ->each
                ->delete();

            if ($loan->contract_attachment) {
                Storage::disk('public')->delete($loan->contract_attachment);
            }

            $loan->delete();
        });

        return back()->with('success', 'Pinjaman berhasil dihapus beserta mutasi pencairannya');
    }

    public function pay(PayLoanRequest $request, Loan $loan): RedirectResponse
    {
        abort_if($loan->status !== 'active', 403, 'Pinjaman ini tidak dapat dibayar');

        $paidPrincipal = (int) $loan->payments()->sum('principal_paid');
        $remainingPrincipal = $loan->principal_amount - $paidPrincipal;

        // Satu definisi rumus bunga, dipakai bersama jadwal angsuran yang
        // ditampilkan di layar. Dua salinan akan menyimpang, dan yang menyimpang
        // berarti layar menjanjikan angka yang ditolak server ini.
        $totalInterest = app(JadwalAngsuranService::class)->totalBungaPinjaman($loan);
        $paidInterest = (int) $loan->payments()->sum('interest_paid');
        $remainingInterest = $totalInterest - $paidInterest;

        $validated = $request->validated();

        $principalPaid = (int) ($validated['principal_paid'] ?? 0);
        $interestPaid = (int) ($validated['interest_paid'] ?? 0);

        if ($principalPaid === 0 && $interestPaid === 0) {
            return back()->withErrors(['principal_paid' => 'Minimal salah satu harus diisi: Pembayaran Pokok atau Bunga']);
        }

        // Pembayaran tidak boleh melampaui sisa. Tanpa batas ini kas terdebit
        // penuh dan sisa pokok/bunga menjadi negatif.
        if ($principalPaid > $remainingPrincipal) {
            return back()->withErrors([
                'principal_paid' => 'Pembayaran pokok melebihi sisa pokok (Rp '.number_format($remainingPrincipal, 0, ',', '.').').',
            ]);
        }

        if ($interestPaid > $remainingInterest) {
            return back()->withErrors([
                'interest_paid' => 'Pembayaran bunga melebihi sisa bunga (Rp '.number_format($remainingInterest, 0, ',', '.').').',
            ]);
        }

        DB::transaction(function () use ($loan, $validated, $principalPaid, $interestPaid, $remainingPrincipal) {
            LoanPayment::create([
                'loan_id' => $loan->id,
                'bank_account_id' => $validated['bank_account_id'],
                'payment_date' => $validated['payment_date'],
                'principal_paid' => $principalPaid,
                'interest_paid' => $interestPaid,
                'total_paid' => $principalPaid + $interestPaid,
                'reference_number' => $validated['reference_number'] ?? null,
                'notes' => $validated['notes'] ?? null,
            ]);

            if ($principalPaid > 0) {
                $category = TransactionCategory::findSystem('FIN-LOAN-OUT');
                BankTransaction::create([
                    'bank_account_id' => $validated['bank_account_id'],
                    'amount' => $principalPaid,
                    'transaction_type' => 'debit',
                    'transaction_date' => $validated['payment_date'],
                    'description' => "Pembayaran pokok pinjaman - {$loan->lender_name}",
                    'reference_number' => $validated['reference_number'] ?? null,
                    'category_id' => $category?->id,
                ]);
            }

            if ($interestPaid > 0) {
                $category = TransactionCategory::findSystem('EXP-INTEREST');
                BankTransaction::create([
                    'bank_account_id' => $validated['bank_account_id'],
                    'amount' => $interestPaid,
                    'transaction_type' => 'debit',
                    'transaction_date' => $validated['payment_date'],
                    'description' => "Pembayaran bunga pinjaman - {$loan->lender_name}",
                    'reference_number' => $validated['reference_number'] ?? null,
                    'category_id' => $category?->id,
                ]);
            }

            $newRemaining = $remainingPrincipal - $principalPaid;
            if ($newRemaining <= 0) {
                $loan->update(['status' => 'paid_off']);
            }
        });

        return back()->with('success', 'Pembayaran pinjaman berhasil dicatat');
    }

    private function generateLoanNumber(): string
    {
        // Diturunkan dari NOMOR terbesar yang sudah dipakai, bukan dari id
        // terakhir. `loan_number` boleh diketik manual dan barisnya boleh
        // dihapus, sehingga urutan id dan urutan nomor bisa berbeda — prefill
        // berbasis id lalu menawarkan nomor yang sudah terpakai.
        $terbesar = Loan::query()
            ->pluck('loan_number')
            ->map(fn ($n) => (int) preg_replace('/\D/', '', (string) $n))
            ->max() ?? 0;

        $urut = $terbesar + 1;

        do {
            $nomor = 'LOAN-'.str_pad((string) $urut, 5, '0', STR_PAD_LEFT);
            $urut++;
        } while (Loan::where('loan_number', $nomor)->exists());

        return $nomor;
    }

    /**
     * Jadwal angsuran satu loan, dihitung saat panel detail dibuka.
     *
     * Tidak ikut di payload daftar: penyusunannya menjumlahkan pembayaran per
     * baris, jadi menaruhnya di daftar berarti dua query dikali jumlah baris.
     */
    public function schedule(Loan $loan, JadwalAngsuranService $jadwal): JsonResponse
    {
        $this->authorize('view loans');

        return response()->json([
            'rows' => $jadwal->untukPinjaman($loan),
            'summary' => [
                'principal' => (int) $loan->principal_amount,
                'interest' => $jadwal->totalBungaPinjaman($loan),
                'terms' => (int) $loan->term_months,
                'start_date' => $loan->start_date?->toDateString(),
                'principal_paid' => (int) $loan->payments()->sum('principal_paid'),
                'interest_paid' => (int) $loan->payments()->sum('interest_paid'),
            ],
        ]);
    }
}
