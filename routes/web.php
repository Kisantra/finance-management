<?php

use App\Http\Controllers\Admin\PermissionController;
use App\Http\Controllers\Admin\RoleController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\BankAccountController;
use App\Http\Controllers\BankTransactionController;
use App\Http\Controllers\CashFlowController;
use App\Http\Controllers\CashFlowExportController;
use App\Http\Controllers\ChooseCompanyController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\FeedbackController;
use App\Http\Controllers\FundRequestController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\LoanController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\ProfitLossReportController;
use App\Http\Controllers\ReceivableController;
use App\Http\Controllers\RecurringInvoiceController;
use App\Http\Controllers\ReimbursementController;
use App\Http\Controllers\ServiceController;
use App\Http\Controllers\Settings\CompanyController;
use App\Http\Controllers\Settings\CustomFontController;
use App\Http\Controllers\Settings\PasswordController as SettingsPasswordController;
use App\Http\Controllers\Settings\PdfTemplateController;
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\TemplateBuilderController;
use App\Http\Controllers\TransactionCategoryController;
use App\Http\Middleware\EnsureUserBelongsToCompany;
use App\Http\Middleware\SetCompanyUrlDefaults;
use App\Http\Middleware\SetPermissionsTeam;
use App\Models\BankAccount;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\PdfTemplate;
use App\Models\TransactionCategory;
use App\Services\BuilderInvoicePrinter;
use App\Services\FundRequestExportService;
use App\Services\InvoicePrintService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Stancl\Tenancy\Middleware\InitializeTenancyByPath;

// ============================================================================
// PUBLIC ROUTES
// ============================================================================

Route::redirect('/', '/choose-company')->name('home');

// ============================================================================
// CENTRAL ROUTES (tanpa konteks perusahaan)
// ============================================================================

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/choose-company', ChooseCompanyController::class)->name('choose-company');
});

// ============================================================================
// AUTHENTICATED ROUTES — konteks perusahaan aktif (/c/{company}/...)
// Urutan middleware group: tenancy path → cek keanggotaan → team Spatie → URL defaults
// ============================================================================

$companyMiddleware = [
    'auth',
    'verified',
    InitializeTenancyByPath::class,
    EnsureUserBelongsToCompany::class,
    SetPermissionsTeam::class,
    SetCompanyUrlDefaults::class,
];

Route::prefix('c/{company}')->middleware($companyMiddleware)->group(function () {

    Route::get('/api/transaction-categories', function (Request $request) {
        $type = $request->input('type');

        $categoryTypes = match ($type) {
            'credit' => ['income', 'adjustment', 'transfer'],
            'debit' => ['expense', 'adjustment', 'transfer'],
            'income' => ['income'],
            'expense' => ['expense'],
            'adjustment' => ['adjustment'],
            'transfer' => ['transfer'],
            default => ['income', 'expense', 'adjustment', 'transfer'],
        };

        return TransactionCategory::whereNull('parent_id')
            ->whereIn('type', $categoryTypes)
            ->with('children')
            ->orderBy('type')
            ->orderBy('label')
            ->get()
            ->flatMap(function ($parent) {
                $items = [];
                $items[] = ['label' => $parent->label, 'value' => $parent->id, 'disabled' => true];
                foreach ($parent->children as $child) {
                    $items[] = ['label' => '↳ '.$child->label, 'value' => $child->id];
                }

                return $items;
            })
            ->values();
    })->name('api.transaction-categories');

    Route::get('/api/bank-accounts', function () {
        return BankAccount::orderBy('bank_name')
            ->orderBy('account_name')
            ->get()
            ->map(fn ($account) => [
                'label' => $account->account_name.' ('.$account->bank_name.')',
                'value' => $account->id,
            ]);
    })->name('api.bank-accounts');

    Route::get('/api/clients', function () {
        return Client::orderBy('name')
            ->get(['id', 'name'])
            ->map(fn ($client) => [
                'label' => $client->name,
                'value' => $client->id,
            ]);
    })->name('api.clients');
});

Route::prefix('c/{company}')->middleware($companyMiddleware)->group(function () {

    // ------------------------------------------------------------------------
    // DASHBOARD
    // ------------------------------------------------------------------------
    Route::get('/dashboard', DashboardController::class)->name('dashboard');

    // ponytail: redirect sandbox GET to new module; keep save/pdf routes for test backward-compat.
    Route::get('/template-builder-test', fn () => redirect()->route('settings.pdf-templates.index'))->name('template-builder-test');
    Route::post('/template-builder-test', [TemplateBuilderController::class, 'save'])->name('template-builder-test.save');
    Route::get('/template-builder-test/pdf', [TemplateBuilderController::class, 'pdf'])->name('template-builder-test.pdf');

    // ------------------------------------------------------------------------
    // CLIENTS & SERVICES
    // ------------------------------------------------------------------------
    Route::middleware('can:view clients')->group(function () {
        Route::get('/clients', [ClientController::class, 'index'])->name('clients');
        Route::post('/clients', [ClientController::class, 'store'])->middleware('can:create clients')->name('clients.store');
        Route::put('/clients/{client}', [ClientController::class, 'update'])->middleware('can:edit clients')->name('clients.update');
        Route::delete('/clients/{client}', [ClientController::class, 'destroy'])->middleware('can:delete clients')->name('clients.destroy');
    });

    Route::middleware('can:view services')->group(function () {
        Route::get('/services', [ServiceController::class, 'index'])->name('services');
        Route::post('/services', [ServiceController::class, 'store'])->middleware('can:create services')->name('services.store');
        Route::put('/services/{service}', [ServiceController::class, 'update'])->middleware('can:edit services')->name('services.update');
        Route::delete('/services/{service}', [ServiceController::class, 'destroy'])->middleware('can:delete services')->name('services.destroy');
    });

    // ------------------------------------------------------------------------
    // FINANCE - INVOICES
    // ------------------------------------------------------------------------
    Route::prefix('invoices')->name('invoices.')->middleware('can:view invoices')->group(function () {
        Route::get('/', [InvoiceController::class, 'index'])->name('index');
        Route::get('/create', [InvoiceController::class, 'create'])->middleware('can:create invoices')->name('create');
        Route::get('/export/excel', [InvoiceController::class, 'exportExcel'])->name('export.excel');
        Route::get('/export/pdf', [InvoiceController::class, 'exportPdf'])->name('export.pdf');
        Route::post('/', [InvoiceController::class, 'store'])->middleware('can:create invoices')->name('store');
        Route::get('/{invoice}', [InvoiceController::class, 'show'])->name('show');
        Route::get('/{invoice}/edit', [InvoiceController::class, 'edit'])->middleware('can:edit invoices')->name('edit');
        Route::put('/{invoice}', [InvoiceController::class, 'update'])->middleware('can:edit invoices')->name('update');
        Route::delete('/{invoice}', [InvoiceController::class, 'destroy'])->middleware('can:delete invoices')->name('destroy');
        Route::post('/{invoice}/send', [InvoiceController::class, 'send'])->name('send');
        Route::post('/{invoice}/rollback', [InvoiceController::class, 'rollback'])->name('rollback');
        Route::post('/{invoice}/payments', [PaymentController::class, 'store'])->middleware('can:create invoices')->name('payments.store');
    });

    Route::prefix('payments')->name('payments.')->middleware('can:edit invoices')->group(function () {
        Route::post('/{payment}', [PaymentController::class, 'update'])->name('update');
        Route::delete('/{payment}', [PaymentController::class, 'destroy'])->name('destroy');
    });

    // Invoice PDF Operations
    Route::prefix('invoice')->name('invoice.')->group(function () {
        Route::get('/{invoice}/download', function (Invoice $invoice, Request $request) {
            $dpAmount = $request->query('dp_amount') ? (int) $request->query('dp_amount') : null;
            $pelunasanAmount = $request->query('pelunasan_amount') ? (int) $request->query('pelunasan_amount') : null;
            $template = $request->query('template', 'kisantra-invoice');

            // Builder template: template=builder:{id}
            if (str_starts_with((string) $template, 'builder:')) {
                $templateId = (int) substr((string) $template, 8);
                $pdfTemplate = PdfTemplate::findOrFail($templateId);
                $printer = new BuilderInvoicePrinter;
                $pdf = $printer->render($pdfTemplate, $invoice, $dpAmount, $pelunasanAmount);
                $filename = $printer->filename($invoice, $dpAmount, $pelunasanAmount);
            } else {
                $service = new InvoicePrintService;
                $pdf = $service->generateSingleInvoicePdf($invoice, $dpAmount, $pelunasanAmount, $template);
                $invoiceType = $dpAmount ? 'DP-' : ($pelunasanAmount ? 'Pelunasan-' : '');
                $filename = $invoiceType.'Invoice-'.str_replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], '-', $invoice->invoice_number).'.pdf';
            }

            return response()->streamDownload(function () use ($pdf) {
                echo $pdf->output();
            }, $filename, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'attachment; filename="'.$filename.'"',
            ]);
        })->middleware('can:view invoices')->name('download');

        Route::get('/{invoice}/preview', function (Invoice $invoice, Request $request) {
            $dpAmount = $request->query('dp_amount') ? (int) $request->query('dp_amount') : null;
            $pelunasanAmount = $request->query('pelunasan_amount') ? (int) $request->query('pelunasan_amount') : null;
            $template = $request->query('template', 'kisantra-invoice');

            // Builder template: template=builder:{id}
            if (str_starts_with((string) $template, 'builder:')) {
                $templateId = (int) substr((string) $template, 8);
                $pdfTemplate = PdfTemplate::findOrFail($templateId);
                $printer = new BuilderInvoicePrinter;
                $pdf = $printer->render($pdfTemplate, $invoice, $dpAmount, $pelunasanAmount);
            } else {
                $service = new InvoicePrintService;
                $pdf = $service->generateSingleInvoicePdf($invoice, $dpAmount, $pelunasanAmount, $template);
            }

            return response($pdf->output(), 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'inline',
            ]);
        })->middleware('can:view invoices')->name('preview');
    });

    // ------------------------------------------------------------------------
    // FINANCE - RECURRING INVOICES
    // ------------------------------------------------------------------------
    Route::prefix('recurring-invoices')->name('recurring-invoices.')->group(function () {
        Route::get('/', [RecurringInvoiceController::class, 'index'])
            ->middleware('can:view recurring-invoices')
            ->name('index');

        // Templates
        Route::get('/templates/create', [RecurringInvoiceController::class, 'createTemplate'])
            ->middleware('can:create recurring-invoices')
            ->name('templates.create');
        Route::get('/templates/{template}/edit', [RecurringInvoiceController::class, 'editTemplate'])
            ->middleware('can:edit recurring-invoices')
            ->name('templates.edit');
        Route::post('/templates', [RecurringInvoiceController::class, 'storeTemplate'])
            ->middleware('can:create recurring-invoices')
            ->name('templates.store');
        Route::put('/templates/{template}', [RecurringInvoiceController::class, 'updateTemplate'])
            ->middleware('can:edit recurring-invoices')
            ->name('templates.update');
        Route::delete('/templates/{template}', [RecurringInvoiceController::class, 'destroyTemplate'])
            ->middleware('can:edit recurring-invoices')
            ->name('templates.destroy');
        Route::post('/templates/{template}/restore', [RecurringInvoiceController::class, 'restoreTemplate'])
            ->middleware('can:edit recurring-invoices')
            ->name('templates.restore');

        // Monthly invoices
        Route::post('/monthly/generate', [RecurringInvoiceController::class, 'generateMonthly'])
            ->middleware('can:create recurring-invoices')
            ->name('monthly.generate');
        Route::post('/monthly', [RecurringInvoiceController::class, 'storeMonthly'])
            ->middleware('can:create recurring-invoices')
            ->name('monthly.store');
        Route::put('/monthly/{invoice}', [RecurringInvoiceController::class, 'updateMonthly'])
            ->middleware('can:edit recurring-invoices')
            ->name('monthly.update');
        Route::delete('/monthly/{invoice}', [RecurringInvoiceController::class, 'destroyMonthly'])
            ->middleware('can:edit recurring-invoices')
            ->name('monthly.destroy');
        Route::post('/monthly/{invoice}/publish', [RecurringInvoiceController::class, 'publishMonthly'])
            ->middleware('can:edit recurring-invoices')
            ->name('monthly.publish');
        Route::post('/monthly/bulk-destroy', [RecurringInvoiceController::class, 'bulkDestroyMonthly'])
            ->middleware('can:edit recurring-invoices')
            ->name('monthly.bulk-destroy');
        Route::post('/monthly/bulk-publish', [RecurringInvoiceController::class, 'bulkPublishMonthly'])
            ->middleware('can:edit recurring-invoices')
            ->name('monthly.bulk-publish');
    });

    // ------------------------------------------------------------------------
    // FINANCE - BANK & CASH FLOW
    // ------------------------------------------------------------------------
    Route::middleware('can:view bank-accounts')->group(function () {
        Route::get('/bank-accounts', [BankAccountController::class, 'index'])->name('bank-accounts.index');
        Route::post('/bank-accounts', [BankAccountController::class, 'store'])
            ->middleware('can:create bank-accounts')
            ->name('bank-accounts.store');
        Route::put('/bank-accounts/{bankAccount}', [BankAccountController::class, 'update'])
            ->middleware('can:edit bank-accounts')
            ->name('bank-accounts.update');
        Route::delete('/bank-accounts/{bankAccount}', [BankAccountController::class, 'destroy'])
            ->middleware('can:delete bank-accounts')
            ->name('bank-accounts.destroy');

        // Transactions for the selected account (JSON endpoints)
        Route::get('/bank-accounts/transactions', [BankTransactionController::class, 'indexTransactions'])
            ->name('bank-accounts.transactions');
        Route::get('/bank-accounts/payments', [BankTransactionController::class, 'indexPayments'])
            ->name('bank-accounts.payments');

    });

    // Income/expense/transfer are authorized inside the FormRequests/controller
    // based on the transaction's feature (credit=income, debit=expense, TRF=transfer),
    // since these endpoints are shared across all three cash-flow features and
    // must stay reachable for users with cash-flow permissions but no bank-accounts access.
    Route::post('/bank-transactions', [BankTransactionController::class, 'store'])
        ->name('bank-transactions.store');
    Route::put('/bank-transactions/{bankTransaction}', [BankTransactionController::class, 'update'])
        ->name('bank-transactions.update');
    Route::delete('/bank-transactions/{bankTransaction}', [BankTransactionController::class, 'destroy'])
        ->name('bank-transactions.destroy');
    Route::post('/bank-transactions/bulk-delete', [BankTransactionController::class, 'bulkDestroy'])
        ->name('bank-transactions.bulk-destroy');
    Route::post('/bank-transactions/transfer', [BankTransactionController::class, 'transfer'])
        ->name('bank-transactions.transfer');

    Route::get('/bank-account/export/pdf', [CashFlowExportController::class, 'exportPdf'])
        ->middleware('can:view bank-accounts')
        ->name('bank-account.export.pdf');

    Route::get('/bank-account/export/pdf/preview', [CashFlowExportController::class, 'previewPdf'])
        ->middleware('can:view bank-accounts')
        ->name('bank-account.export.pdf.preview');

    Route::prefix('cash-flow')->name('cash-flow.')->group(function () {
        // Redirect to the first tab the user is allowed to see.
        Route::get('/', function () {
            $user = request()->user();
            if ($user?->can('view income')) {
                return redirect()->route('cash-flow.income');
            }
            if ($user?->can('view expense')) {
                return redirect()->route('cash-flow.expenses');
            }
            if ($user?->can('view transfer')) {
                return redirect()->route('cash-flow.transfers');
            }
            abort(403);
        })->name('index');
        Route::get('/income', [CashFlowController::class, 'income'])->middleware('can:view income')->name('income');
        Route::get('/expenses', [CashFlowController::class, 'expenses'])->middleware('can:view expense')->name('expenses');
        Route::get('/transfers', [CashFlowController::class, 'transfers'])->middleware('can:view transfer')->name('transfers');
        // Bulk delete is authorized per-feature inside the controller.
        Route::post('/bulk-delete', [CashFlowController::class, 'bulkDestroy'])->name('bulk-destroy');

        // Cash-flow statement export is an account-level report (same controller as the
        // bank-account export above), so it stays gated by bank-account access.
        Route::get('/export/pdf', [CashFlowExportController::class, 'exportPdf'])
            ->middleware('can:view bank-accounts')->name('export.pdf');
        Route::get('/export/pdf/preview', [CashFlowExportController::class, 'previewPdf'])
            ->middleware('can:view bank-accounts')->name('export.pdf.preview');
    });

    // ------------------------------------------------------------------------
    // CATEGORIES
    // ------------------------------------------------------------------------
    Route::middleware('can:view categories')->group(function () {
        Route::get('/transaction-categories', [TransactionCategoryController::class, 'index'])->name('transaction-categories.index');
        Route::post('/transaction-categories', [TransactionCategoryController::class, 'store'])->middleware('can:manage categories')->name('transaction-categories.store');
        Route::put('/transaction-categories/{transactionCategory}', [TransactionCategoryController::class, 'update'])->middleware('can:manage categories')->name('transaction-categories.update');
        Route::patch('/transaction-categories/{transactionCategory}/pl-group', [TransactionCategoryController::class, 'updatePlGroup'])->middleware('can:manage categories')->name('transaction-categories.pl-group');
        Route::delete('/transaction-categories/{transactionCategory}', [TransactionCategoryController::class, 'destroy'])->middleware('can:manage categories')->name('transaction-categories.destroy');
    });

    // ------------------------------------------------------------------------
    // REIMBURSEMENTS
    // ------------------------------------------------------------------------
    Route::middleware('can:view reimbursements')->group(function () {
        Route::get('/reimbursements', [ReimbursementController::class, 'index'])->name('reimbursements.index');
        Route::get('/reimbursements/create', [ReimbursementController::class, 'create'])->middleware('can:create reimbursements')->name('reimbursements.create');
        Route::post('/reimbursements', [ReimbursementController::class, 'store'])->middleware('can:create reimbursements')->name('reimbursements.store');
        Route::get('/reimbursements/{reimbursement}/edit', [ReimbursementController::class, 'edit'])->middleware('can:edit reimbursements')->name('reimbursements.edit');
        Route::put('/reimbursements/{reimbursement}', [ReimbursementController::class, 'update'])->middleware('can:edit reimbursements')->name('reimbursements.update');
        Route::delete('/reimbursements/{reimbursement}', [ReimbursementController::class, 'destroy'])->middleware('can:delete reimbursements')->name('reimbursements.destroy');
        Route::post('/reimbursements/{reimbursement}/submit', [ReimbursementController::class, 'submit'])->name('reimbursements.submit');
        Route::post('/reimbursements/{reimbursement}/review', [ReimbursementController::class, 'review'])->middleware('can:approve reimbursements')->name('reimbursements.review');
        Route::post('/reimbursements/{reimbursement}/pay', [ReimbursementController::class, 'pay'])->middleware('can:pay reimbursements')->name('reimbursements.pay');
    });

    // ------------------------------------------------------------------------
    // FUND REQUESTS
    // ------------------------------------------------------------------------
    Route::middleware('can:view fund requests')->group(function () {
        Route::get('/fund-requests', [FundRequestController::class, 'index'])->name('fund-requests.index');
        Route::get('/fund-requests/create', [FundRequestController::class, 'create'])->middleware('can:create fund requests')->name('fund-requests.create');
        Route::post('/fund-requests', [FundRequestController::class, 'store'])->middleware('can:create fund requests')->name('fund-requests.store');
        Route::get('/fund-requests/{fundRequest}/edit', [FundRequestController::class, 'edit'])->middleware('can:edit fund requests')->name('fund-requests.edit');
        Route::put('/fund-requests/{fundRequest}', [FundRequestController::class, 'update'])->middleware('can:edit fund requests')->name('fund-requests.update');
        Route::delete('/fund-requests/{fundRequest}', [FundRequestController::class, 'destroy'])->middleware('can:delete fund requests')->name('fund-requests.destroy');
        Route::post('/fund-requests/{fundRequest}/submit', [FundRequestController::class, 'submit'])->name('fund-requests.submit');
        Route::post('/fund-requests/{fundRequest}/review', [FundRequestController::class, 'review'])->middleware('can:approve fund requests')->name('fund-requests.review');
        Route::post('/fund-requests/{fundRequest}/disburse', [FundRequestController::class, 'disburse'])->middleware('can:disburse fund requests')->name('fund-requests.disburse');
    });

    Route::get('/fund-requests/export/pdf', function (Request $request) {
        $filters = [
            'month' => $request->query('month'),
            'status' => $request->query('status'),
            'priority' => $request->query('priority'),
            'user_id' => $request->query('user_id') ? (int) $request->query('user_id') : null,
            'search' => $request->query('search'),
        ];
        $showRequestor = (bool) $request->query('show_requestor', false);

        $service = new FundRequestExportService;
        $pdf = $service->generate($filters, $showRequestor);

        $month = $filters['month'] ?? 'all';
        $filename = 'Rekap-Pengajuan-Dana-'.$month.'.pdf';

        return response()->streamDownload(function () use ($pdf) {
            echo $pdf->output();
        }, $filename, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    })->middleware('can:view fund requests')->name('fund-requests.export.pdf');

    Route::get('/fund-requests/export/pdf/preview', function (Request $request) {
        $filters = [
            'month' => $request->query('month'),
            'status' => $request->query('status'),
            'priority' => $request->query('priority'),
            'user_id' => $request->query('user_id') ? (int) $request->query('user_id') : null,
            'search' => $request->query('search'),
        ];
        $showRequestor = (bool) $request->query('show_requestor', false);

        $service = new FundRequestExportService;
        $pdf = $service->generate($filters, $showRequestor);

        return response($pdf->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline',
        ]);
    })->middleware('can:view fund requests')->name('fund-requests.export.pdf.preview');

    // ------------------------------------------------------------------------
    // FEEDBACKS
    // ------------------------------------------------------------------------
    Route::middleware('can:view feedbacks')->group(function () {
        Route::get('/feedbacks', [FeedbackController::class, 'index'])->name('feedbacks.index');
        Route::post('/feedbacks', [FeedbackController::class, 'store'])
            ->middleware('can:create feedbacks')
            ->name('feedbacks.store');
        Route::put('/feedbacks/{feedback}', [FeedbackController::class, 'update'])
            ->middleware('can:edit feedbacks')
            ->name('feedbacks.update');
        Route::delete('/feedbacks/{feedback}', [FeedbackController::class, 'destroy'])
            ->middleware('can:delete feedbacks')
            ->name('feedbacks.destroy');
        Route::post('/feedbacks/{feedback}/respond', [FeedbackController::class, 'respond'])
            ->middleware('can:respond feedbacks')
            ->name('feedbacks.respond');
        Route::post('/feedbacks/{feedback}/status', [FeedbackController::class, 'changeStatus'])
            ->middleware('can:manage feedbacks')
            ->name('feedbacks.status');
    });

    // ------------------------------------------------------------------------
    // REPORTS
    // ------------------------------------------------------------------------
    Route::middleware('can:view profit-loss')->group(function () {
        Route::get('/reports/profit-loss', [ProfitLossReportController::class, 'index'])->name('reports.profit-loss');
        Route::get('/reports/profit-loss/pdf', [ProfitLossReportController::class, 'downloadPdf'])->name('reports.profit-loss.pdf');
    });

    // ------------------------------------------------------------------------
    // NOTIFICATIONS
    // ------------------------------------------------------------------------
    Route::prefix('notifications')->name('notifications.')->group(function () {
        Route::get('/', [NotificationController::class, 'index'])->name('index');
        Route::post('/{notification}/read', [NotificationController::class, 'markAsRead'])->name('read');
        Route::post('/mark-all-read', [NotificationController::class, 'markAllAsRead'])->name('mark-all-read');
    });

    // ------------------------------------------------------------------------
    // DEBT & RECEIVABLES
    // ------------------------------------------------------------------------
    Route::middleware('can:view loans')->group(function () {
        Route::get('/loans', [LoanController::class, 'index'])->name('loans.index');
        Route::post('/loans', [LoanController::class, 'store'])->middleware('can:create loans')->name('loans.store');
        Route::put('/loans/{loan}', [LoanController::class, 'update'])->middleware('can:edit loans')->name('loans.update');
        Route::delete('/loans/{loan}', [LoanController::class, 'destroy'])->middleware('can:delete loans')->name('loans.destroy');
        Route::post('/loans/{loan}/pay', [LoanController::class, 'pay'])->middleware('can:pay loans')->name('loans.pay');
    });

    Route::middleware('can:view receivables')->group(function () {
        Route::get('/receivables', [ReceivableController::class, 'index'])->name('receivables.index');
        Route::post('/receivables', [ReceivableController::class, 'store'])->middleware('can:create receivables')->name('receivables.store');
        Route::put('/receivables/{receivable}', [ReceivableController::class, 'update'])->middleware('can:edit receivables')->name('receivables.update');
        Route::delete('/receivables/{receivable}', [ReceivableController::class, 'destroy'])->middleware('can:delete receivables')->name('receivables.destroy');
        Route::post('/receivables/{receivable}/submit', [ReceivableController::class, 'submit'])->name('receivables.submit');
        Route::post('/receivables/{receivable}/approve', [ReceivableController::class, 'approve'])->middleware('can:approve receivables')->name('receivables.approve');
        Route::post('/receivables/{receivable}/pay', [ReceivableController::class, 'pay'])->middleware('can:pay receivables')->name('receivables.pay');
    });

    // ------------------------------------------------------------------------
    // ADMINISTRATION - PERMISSIONS & ROLES
    // ------------------------------------------------------------------------
    Route::prefix('admin')->name('admin.')->group(function () {
        Route::middleware('can:view permissions')->group(function () {
            Route::get('/permissions', [PermissionController::class, 'index'])->name('permissions.index');
            Route::post('/permissions/toggle', [PermissionController::class, 'togglePermission'])
                ->middleware('can:manage permissions')
                ->name('permissions.toggle');
            Route::post('/permissions/sync-module', [PermissionController::class, 'syncModule'])
                ->middleware('can:manage permissions')
                ->name('permissions.sync-module');
            Route::post('/permissions/sync-all', [PermissionController::class, 'syncAll'])
                ->middleware('can:manage permissions')
                ->name('permissions.sync-all');
            Route::delete('/permissions/{permission}', [PermissionController::class, 'destroy'])
                ->middleware('can:manage permissions')
                ->name('permissions.destroy');

            Route::post('/roles', [RoleController::class, 'store'])
                ->middleware('can:manage permissions')
                ->name('roles.store');
            Route::put('/roles/{role}', [RoleController::class, 'update'])
                ->middleware('can:manage permissions')
                ->name('roles.update');
            Route::delete('/roles/{role}', [RoleController::class, 'destroy'])
                ->middleware('can:manage permissions')
                ->name('roles.destroy');
        });

        // ------------------------------------------------------------------------
        // ADMINISTRATION - USERS
        // ------------------------------------------------------------------------
        Route::middleware('can:manage users')->group(function () {
            Route::get('/users', [UserController::class, 'index'])->name('users.index');
            Route::post('/users', [UserController::class, 'store'])->name('users.store');
            Route::put('/users/{user}', [UserController::class, 'update'])->name('users.update');
            Route::delete('/users/{user}', [UserController::class, 'destroy'])->name('users.destroy');
            Route::post('/users/bulk-delete', [UserController::class, 'bulkDestroy'])->name('users.bulk-destroy');
        });

        Route::middleware('can:manage companies')->group(function () {
            Route::get('/companies', [App\Http\Controllers\Admin\CompanyController::class, 'index'])->name('companies.index');
            Route::post('/companies', [App\Http\Controllers\Admin\CompanyController::class, 'store'])->name('companies.store');
            Route::post('/companies/{targetCompany}/retry', [App\Http\Controllers\Admin\CompanyController::class, 'retry'])->name('companies.retry');
        });
    });

    // Legacy redirect to support old "admin.users" route name from sidebar
    Route::get('/permissions', fn () => redirect()->route('admin.permissions.index'));

    // ------------------------------------------------------------------------
    // SETTINGS
    // ------------------------------------------------------------------------
    Route::prefix('settings')->name('settings.')->group(function () {
        Route::redirect('/', '/settings/profile');

        Route::get('/profile', [ProfileController::class, 'edit'])->name('profile');
        Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
        Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

        Route::get('/password', [SettingsPasswordController::class, 'edit'])->name('password');
        Route::put('/password', [SettingsPasswordController::class, 'update'])->name('password.update');

        Route::get('/company', [CompanyController::class, 'edit'])->name('company');
        Route::post('/company', [CompanyController::class, 'update'])->name('company.update');
        Route::delete('/company/assets/{asset}', [CompanyController::class, 'deleteAsset'])->name('company.delete-asset');

        // PDF Template Builder — gated by permission
        Route::prefix('pdf-templates')->name('pdf-templates.')->middleware('can:manage pdf templates')->group(function () {
            Route::get('/', [PdfTemplateController::class, 'index'])->name('index');
            Route::post('/', [PdfTemplateController::class, 'store'])->name('store');
            Route::put('/{pdfTemplate}', [PdfTemplateController::class, 'update'])->name('update');
            Route::delete('/{pdfTemplate}', [PdfTemplateController::class, 'destroy'])->name('destroy');
            Route::post('/{pdfTemplate}/duplicate', [PdfTemplateController::class, 'duplicate'])->name('duplicate');
            Route::post('/{pdfTemplate}/set-default', [PdfTemplateController::class, 'setDefault'])->name('set-default');
            Route::get('/{pdfTemplate}/edit', [PdfTemplateController::class, 'edit'])->name('edit');
            Route::post('/{pdfTemplate}/save', [PdfTemplateController::class, 'save'])->name('save');
            Route::get('/{pdfTemplate}/pdf', [PdfTemplateController::class, 'pdf'])->name('pdf');
            Route::get('/{pdfTemplate}/pdf/{invoice}', [PdfTemplateController::class, 'pdf'])->name('pdf.invoice');

            // Custom font library (global — shared across all templates)
            Route::get('/custom-fonts', [CustomFontController::class, 'index'])->name('custom-fonts.index');
            Route::post('/custom-fonts', [CustomFontController::class, 'store'])->name('custom-fonts.store');
            Route::delete('/custom-fonts/{customFont}', [CustomFontController::class, 'destroy'])->name('custom-fonts.destroy');
        });
    });

    // ------------------------------------------------------------------------
    // API ENDPOINTS
    // ------------------------------------------------------------------------

});

// Language switching (used by React AppLayout)
Route::post('/language', function (Request $request) {
    $locale = $request->input('locale');
    $available = config('app.available_locales', ['id', 'en', 'zh']);
    if (in_array($locale, $available)) {
        session(['locale' => $locale]);
        if (auth()->check()) {
            auth()->user()->update(['locale' => $locale]);
        }
    }

    return redirect()->back();
})->middleware('web')->name('language.switch');

require __DIR__.'/auth.php';
