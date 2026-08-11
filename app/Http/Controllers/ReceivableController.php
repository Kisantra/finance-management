<?php

namespace App\Http\Controllers;

use App\Http\Requests\ApproveReceivableRequest;
use App\Http\Requests\PayReceivableRequest;
use App\Http\Requests\StoreReceivableRequest;
use App\Http\Requests\UpdateReceivableRequest;
use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Client;
use App\Models\Receivable;
use App\Models\ReceivablePayment;
use App\Models\TransactionCategory;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class ReceivableController extends Controller
{
    public function index(Request $request): Response
    {
        $search = $request->input('search');
        $status = $request->input('status');
        $type = $request->input('type');
        $perPage = (int) $request->input('per_page', 15);
        $page = (int) $request->input('page', 1);

        $query = Receivable::with(['debtor', 'approver'])
            ->withSum('payments', 'principal_paid')
            ->withSum('payments', 'interest_paid');

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('receivable_number', 'like', "%{$search}%")
                    ->orWhere('purpose', 'like', "%{$search}%");
            });
        }
        if ($status) {
            $query->where('status', $status);
        }
        if ($type) {
            $query->where('type', $type);
        }

        $paginator = $query->orderBy('loan_date', 'desc')
            ->paginate($perPage, ['*'], 'page', $page);

        $statsRow = Receivable::selectRaw("
            COUNT(*) as total,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
            SUM(CASE WHEN status = 'pending_approval' THEN 1 ELSE 0 END) as pending_count,
            SUM(CASE WHEN status = 'active' THEN principal_amount ELSE 0 END) as total_principal_active
        ")->first();

        $rows = $paginator->map(fn (Receivable $r) => [
            'id' => $r->id,
            'receivable_number' => $r->receivable_number,
            'type' => $r->type,
            'debtor_id' => $r->debtor_id,
            'debtor_name' => $r->debtor?->name,
            'debtor_type' => $r->debtor_type,
            'principal_amount' => $r->principal_amount,
            'interest_rate' => $r->interest_rate,
            'installment_months' => $r->installment_months,
            'installment_amount' => $r->installment_amount,
            'loan_date' => $r->loan_date?->format('Y-m-d'),
            'due_date' => $r->due_date?->format('Y-m-d'),
            'status' => $r->status,
            'purpose' => $r->purpose,
            'notes' => $r->notes,
            'disbursement_account' => $r->disbursement_account,
            'approved_by_name' => $r->approver?->name,
            'approved_at' => $r->approved_at?->format('Y-m-d'),
            'review_notes' => $r->review_notes,
            'rejection_reason' => $r->rejection_reason,
            'contract_attachment_url' => $r->contract_attachment_path ? Storage::url($r->contract_attachment_path) : null,
            'contract_attachment_name' => $r->contract_attachment_name,
            'paid_principal' => (int) ($r->payments_sum_principal_paid ?? 0),
            'paid_interest' => (int) ($r->payments_sum_interest_paid ?? 0),
            'remaining_principal' => $r->principal_amount - (int) ($r->payments_sum_principal_paid ?? 0),
            'can_submit' => $r->status === 'draft',
            'can_approve' => $r->status === 'pending_approval' && auth()->user()->can('approve receivables'),
            'can_pay' => $r->status === 'active' && auth()->user()->can('pay receivables'),
            'can_edit' => in_array($r->status, ['draft', 'rejected']),
            'can_delete' => $r->status === 'draft' && ! $r->payments()->exists(),
        ]);

        $bankAccountOptions = BankAccount::with(['payments', 'transactions'])
            ->orderBy('account_name')
            ->get()
            ->map(fn ($b) => [
                'value' => $b->id,
                'label' => $b->account_name.' — '.$b->bank_name.' ('.$b->formatted_balance.')',
            ]);

        $employeeOptions = User::where('status', 'active')
            ->orderBy('name')
            ->get()
            ->map(fn ($u) => ['value' => $u->id, 'label' => $u->name]);

        $companyOptions = Client::where('type', 'company')
            ->where('status', 'Active')
            ->orderBy('name')
            ->get()
            ->map(fn ($c) => ['value' => $c->id, 'label' => $c->name]);

        $nextReceivableNumber = $this->generateReceivableNumber();

        return Inertia::render('receivables/index', [
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
                'active_count' => (int) ($statsRow->active_count ?? 0),
                'pending_count' => (int) ($statsRow->pending_count ?? 0),
                'total_principal_active' => (int) ($statsRow->total_principal_active ?? 0),
            ],
            'filters' => [
                'search' => $search,
                'status' => $status,
                'type' => $type,
                'per_page' => $perPage,
                'page' => $page,
            ],
            'bankAccountOptions' => $bankAccountOptions,
            'employeeOptions' => $employeeOptions,
            'companyOptions' => $companyOptions,
            'nextReceivableNumber' => $nextReceivableNumber,
            'canApprove' => auth()->user()->can('approve receivables'),
            'canPay' => auth()->user()->can('pay receivables'),
        ]);
    }

    public function store(StoreReceivableRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        $attachmentPath = null;
        $attachmentName = null;
        if ($request->hasFile('contract_attachment')) {
            $attachmentPath = $request->file('contract_attachment')->store('receivables', 'public');
            $attachmentName = $request->file('contract_attachment')->getClientOriginalName();
        }

        $principalAmount = $validated['principal_amount'];
        $installmentMonths = $validated['installment_months'];

        if ($validated['interest_type'] === 'fixed') {
            $totalInterest = (int) ($validated['interest_amount'] ?? 0);
            $interestRate = $principalAmount > 0 ? round($totalInterest / $principalAmount * 100, 2) : 0;
        } else {
            $interestRate = (float) ($validated['interest_rate'] ?? 0);
            $totalInterest = (int) round($principalAmount * $interestRate / 100);
        }

        $installmentAmount = (int) round(($principalAmount + $totalInterest) / $installmentMonths);
        $dueDate = now()->parse($validated['loan_date'])->addMonths($installmentMonths);
        $debtorType = $validated['type'] === 'employee_loan' ? User::class : Client::class;

        Receivable::create([
            'receivable_number' => $this->generateReceivableNumber(),
            'type' => $validated['type'],
            'debtor_type' => $debtorType,
            'debtor_id' => $validated['debtor_id'],
            'principal_amount' => $principalAmount,
            'interest_rate' => $interestRate,
            'installment_months' => $installmentMonths,
            'installment_amount' => $installmentAmount,
            'loan_date' => $validated['loan_date'],
            'due_date' => $dueDate,
            'status' => 'draft',
            'purpose' => $validated['purpose'],
            'notes' => $validated['notes'],
            'disbursement_account' => $validated['disbursement_account'],
            'contract_attachment_path' => $attachmentPath,
            'contract_attachment_name' => $attachmentName,
        ]);

        return back()->with('success', 'Piutang berhasil dibuat');
    }

    public function update(UpdateReceivableRequest $request, Receivable $receivable): RedirectResponse
    {
        abort_if(! in_array($receivable->status, ['draft', 'rejected']), 403, 'Piutang ini tidak dapat diedit');

        $validated = $request->validated();

        $attachmentPath = $receivable->contract_attachment_path;
        $attachmentName = $receivable->contract_attachment_name;

        if ($request->boolean('remove_attachment') && $attachmentPath) {
            Storage::disk('public')->delete($attachmentPath);
            $attachmentPath = null;
            $attachmentName = null;
        }

        if ($request->hasFile('contract_attachment')) {
            if ($attachmentPath) {
                Storage::disk('public')->delete($attachmentPath);
            }
            $attachmentPath = $request->file('contract_attachment')->store('receivables', 'public');
            $attachmentName = $request->file('contract_attachment')->getClientOriginalName();
        }

        $principalAmount = $validated['principal_amount'];
        $installmentMonths = $validated['installment_months'];

        if ($validated['interest_type'] === 'fixed') {
            $totalInterest = (int) ($validated['interest_amount'] ?? 0);
            $interestRate = $principalAmount > 0 ? round($totalInterest / $principalAmount * 100, 2) : 0;
        } else {
            $interestRate = (float) ($validated['interest_rate'] ?? 0);
            $totalInterest = (int) round($principalAmount * $interestRate / 100);
        }

        $installmentAmount = (int) round(($principalAmount + $totalInterest) / $installmentMonths);
        $dueDate = now()->parse($validated['loan_date'])->addMonths($installmentMonths);
        $debtorType = $validated['type'] === 'employee_loan' ? User::class : Client::class;

        $receivable->update([
            'type' => $validated['type'],
            'debtor_type' => $debtorType,
            'debtor_id' => $validated['debtor_id'],
            'principal_amount' => $principalAmount,
            'interest_rate' => $interestRate,
            'installment_months' => $installmentMonths,
            'installment_amount' => $installmentAmount,
            'loan_date' => $validated['loan_date'],
            'due_date' => $dueDate,
            'purpose' => $validated['purpose'],
            'notes' => $validated['notes'],
            'disbursement_account' => $validated['disbursement_account'],
            'contract_attachment_path' => $attachmentPath,
            'contract_attachment_name' => $attachmentName,
            'status' => 'draft',
            'rejection_reason' => null,
        ]);

        return back()->with('success', 'Piutang berhasil diperbarui');
    }

    public function destroy(Receivable $receivable): RedirectResponse
    {
        abort_if($receivable->status !== 'draft', 403, 'Piutang ini tidak dapat dihapus');
        abort_if($receivable->payments()->exists(), 403, 'Piutang yang sudah memiliki pembayaran tidak dapat dihapus');

        if ($receivable->contract_attachment_path) {
            Storage::disk('public')->delete($receivable->contract_attachment_path);
        }

        $receivable->delete();

        return back()->with('success', 'Piutang berhasil dihapus');
    }

    public function submit(Receivable $receivable): RedirectResponse
    {
        abort_if($receivable->status !== 'draft', 403, 'Piutang ini tidak dapat diajukan');

        $receivable->update(['status' => 'pending_approval']);

        return back()->with('success', 'Piutang berhasil diajukan untuk persetujuan');
    }

    public function approve(ApproveReceivableRequest $request, Receivable $receivable): RedirectResponse
    {
        abort_if(! auth()->user()->can('approve receivables'), 403);
        abort_if($receivable->status !== 'pending_approval', 403, 'Piutang ini tidak dapat diproses');

        $validated = $request->validated();

        if ($validated['action'] === 'approve') {
            DB::transaction(function () use ($receivable, $validated) {
                $category = TransactionCategory::findSystem('FIN-RCV-OUT');

                BankTransaction::create([
                    'bank_account_id' => $validated['bank_account_id'],
                    'amount' => $receivable->principal_amount,
                    'transaction_date' => now()->format('Y-m-d'),
                    'transaction_type' => 'debit',
                    'description' => "Piutang diberikan: {$receivable->receivable_number} - {$receivable->debtor?->name}",
                    'reference_number' => $receivable->receivable_number,
                    'category_id' => $category?->id,
                ]);

                $receivable->update([
                    'status' => 'active',
                    'approved_by' => auth()->id(),
                    'approved_at' => now(),
                    'review_notes' => $validated['notes'] ?? null,
                ]);
            });

            return back()->with('success', 'Piutang berhasil disetujui');
        }

        $receivable->update([
            'status' => 'rejected',
            'approved_by' => auth()->id(),
            'approved_at' => now(),
            'rejection_reason' => $validated['notes'] ?? null,
        ]);

        return back()->with('success', 'Piutang telah ditolak');
    }

    public function pay(PayReceivableRequest $request, Receivable $receivable): RedirectResponse
    {
        abort_if(! auth()->user()->can('pay receivables'), 403);
        abort_if($receivable->status !== 'active', 403, 'Piutang ini tidak dapat dibayar');

        $paidPrincipal = (int) $receivable->payments()->sum('principal_paid');
        $remainingPrincipal = $receivable->principal_amount - $paidPrincipal;

        $totalInterest = (int) round($receivable->principal_amount * $receivable->interest_rate / 100);
        $paidInterest = (int) $receivable->payments()->sum('interest_paid');
        $remainingInterest = $totalInterest - $paidInterest;

        $validated = $request->validated();

        $principalPaid = (int) ($validated['principal_paid'] ?? 0);
        $interestPaid = (int) ($validated['interest_paid'] ?? 0);

        if ($principalPaid === 0 && $interestPaid === 0) {
            return back()->withErrors(['principal_paid' => 'Minimal salah satu harus diisi: Pembayaran Pokok atau Bunga']);
        }

        DB::transaction(function () use ($receivable, $validated, $principalPaid, $interestPaid, $remainingPrincipal) {
            ReceivablePayment::create([
                'receivable_id' => $receivable->id,
                'payment_date' => $validated['payment_date'],
                'principal_paid' => $principalPaid,
                'interest_paid' => $interestPaid,
                'total_paid' => $principalPaid + $interestPaid,
                'payment_method' => $validated['payment_method'],
                'reference_number' => $validated['reference_number'] ?? null,
                'notes' => $validated['notes'] ?? null,
            ]);

            if ($validated['payment_method'] === 'bank_transfer' && ($validated['bank_account_id'] ?? null)) {
                if ($principalPaid > 0) {
                    $cat = TransactionCategory::findSystem('FIN-RCV-IN');
                    BankTransaction::create([
                        'bank_account_id' => $validated['bank_account_id'],
                        'amount' => $principalPaid,
                        'transaction_date' => $validated['payment_date'],
                        'transaction_type' => 'credit',
                        'description' => "Pembayaran piutang pokok: {$receivable->receivable_number} - {$receivable->debtor?->name}",
                        'reference_number' => $validated['reference_number'] ?? null,
                        'category_id' => $cat?->id,
                    ]);
                }

                if ($interestPaid > 0) {
                    $cat = TransactionCategory::findSystem('REV-INTEREST');
                    BankTransaction::create([
                        'bank_account_id' => $validated['bank_account_id'],
                        'amount' => $interestPaid,
                        'transaction_date' => $validated['payment_date'],
                        'transaction_type' => 'credit',
                        'description' => "Pembayaran bunga piutang: {$receivable->receivable_number} - {$receivable->debtor?->name}",
                        'reference_number' => $validated['reference_number'] ?? null,
                        'category_id' => $cat?->id,
                    ]);
                }
            }

            $newRemaining = $remainingPrincipal - $principalPaid;
            if ($newRemaining <= 0) {
                $receivable->update(['status' => 'paid_off']);
            }
        });

        return back()->with('success', 'Pembayaran piutang berhasil dicatat');
    }

    private function generateReceivableNumber(): string
    {
        $last = Receivable::latest('id')->first();
        $nextId = $last ? $last->id + 1 : 1;

        return 'RCV-'.str_pad($nextId, 5, '0', STR_PAD_LEFT);
    }
}
