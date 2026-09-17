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
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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
            SUM(CASE WHEN status = 'active' THEN principal_amount ELSE 0 END) as active_principal
        ")->first();

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
            'contract_attachment_url' => $l->contract_attachment ? Storage::url($l->contract_attachment) : null,
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
                'active_principal' => (int) ($statsRow->active_principal ?? 0),
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
            'principal_amount' => $validated['principal_amount'],
            'interest_type' => $validated['interest_type'],
            'interest_amount' => $validated['interest_type'] === 'fixed' ? $validated['interest_amount'] : null,
            'interest_rate' => $validated['interest_type'] === 'percentage' ? $validated['interest_rate'] : null,
            'term_months' => $validated['term_months'],
            'start_date' => $validated['start_date'],
            'maturity_date' => $validated['maturity_date'],
            'purpose' => $validated['purpose'] ?? null,
            'contract_attachment' => $attachmentPath,
        ]);

        return back()->with('success', 'Pinjaman berhasil diperbarui');
    }

    public function destroy(Loan $loan): RedirectResponse
    {
        abort_if($loan->payments()->exists(), 403, 'Pinjaman yang sudah memiliki pembayaran tidak dapat dihapus');

        if ($loan->contract_attachment) {
            Storage::disk('public')->delete($loan->contract_attachment);
        }

        $loan->delete();

        return back()->with('success', 'Pinjaman berhasil dihapus');
    }

    public function pay(PayLoanRequest $request, Loan $loan): RedirectResponse
    {
        abort_if($loan->status !== 'active', 403, 'Pinjaman ini tidak dapat dibayar');

        $paidPrincipal = (int) $loan->payments()->sum('principal_paid');
        $remainingPrincipal = $loan->principal_amount - $paidPrincipal;

        $totalInterest = $loan->interest_type === 'fixed'
            ? (int) ($loan->interest_amount ?? 0)
            : (int) round($loan->principal_amount * ($loan->interest_rate ?? 0) / 100 / 12 * $loan->term_months);
        $paidInterest = (int) $loan->payments()->sum('interest_paid');
        $remainingInterest = $totalInterest - $paidInterest;

        $validated = $request->validated();

        $principalPaid = (int) ($validated['principal_paid'] ?? 0);
        $interestPaid = (int) ($validated['interest_paid'] ?? 0);

        if ($principalPaid === 0 && $interestPaid === 0) {
            return back()->withErrors(['principal_paid' => 'Minimal salah satu harus diisi: Pembayaran Pokok atau Bunga']);
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
        $latest = Loan::latest('id')->first();
        $nextId = $latest ? $latest->id + 1 : 1;

        return 'LOAN-'.str_pad($nextId, 5, '0', STR_PAD_LEFT);
    }
}
