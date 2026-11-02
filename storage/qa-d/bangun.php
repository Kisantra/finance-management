<?php
/**
 * Bangun lingkungan QA dua perusahaan (Gerbang 2 / Paket D).
 * Dijalankan setelah: database qa_central dibuat + migrate + MasterPermissionSeeder.
 */
require __DIR__.'/../../vendor/autoload.php';
$app = require_once __DIR__.'/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Client;
use App\Models\Company;
use App\Models\FundRequest;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Loan;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\Receivable;
use App\Models\Reimbursement;
use App\Models\Service;
use App\Models\TransactionCategory;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

$db = DB::connection()->getDatabaseName();
if (! str_starts_with($db, 'qa_')) {
    fwrite(STDERR, "PENJAGA: database '$db' bukan qa_* — dibatalkan.\n");
    exit(1);
}
echo "DB central: $db\n";

$org = Organization::firstOrCreate(['slug' => 'qa-grup'], ['name' => 'QA Grup', 'company_quota' => 10]);
echo "Organization: {$org->name} (id {$org->id})\n";

$spec = [
    ['qaalpha', 'PT Alpha Qa', 'ALP', 'ALPHA'],
    ['qabeta', 'PT Beta Qa', 'BTA', 'BETA'],
];

$companies = [];
foreach ($spec as [$slug, $name, $abbr, $tag]) {
    $c = Company::find($slug);
    if (! $c) {
        $c = Company::create(['id' => $slug, 'organization_id' => $org->id, 'name' => $name, 'abbreviation' => $abbr]);
        echo "Perusahaan dibuat: $slug ($name) status={$c->fresh()->status} db=tenant_$slug\n";
    } else {
        echo "Perusahaan sudah ada: $slug\n";
    }
    $companies[$slug] = $c;
}

$users = [
    ['alpha-admin@qa.test', 'Alpha Admin', ['qaalpha' => 'admin']],
    ['beta-admin@qa.test', 'Beta Admin', ['qabeta' => 'admin']],
    ['both-manager@qa.test', 'Both Manager', ['qaalpha' => 'finance manager', 'qabeta' => 'finance manager']],
    ['alpha-staff@qa.test', 'Alpha Staff', ['qaalpha' => 'staff']],
    ['nobody@qa.test', 'Nobody Qa', []],
];

foreach ($users as [$email, $name, $roles]) {
    $u = User::firstOrCreate(['email' => $email], [
        'name' => $name,
        'password' => Hash::make('QaGerbang#2026'),
        'email_verified_at' => now(),
    ]);
    $u->organization_id = $org->id;
    $u->save();
    foreach ($roles as $slug => $role) {
        $u->companies()->syncWithoutDetaching([$slug]);
        setPermissionsTeamId($slug);
        $u->unsetRelation('roles');
        if (! $u->hasRole($role)) {
            $u->assignRole($role);
        }
    }
    setPermissionsTeamId(null);
    echo "User: $email -> ".(count($roles) ? json_encode($roles) : 'TANPA perusahaan')."\n";
}

foreach ($spec as [$slug, $name, $abbr, $tag]) {
    $companies[$slug]->run(function () use ($slug, $tag) {
        echo "--- isi data tenant_$slug (penanda $tag) ---\n";

        // qabeta dimulai dari id 501 supaya id milik beta PASTI tidak ada di
        // database alpha — tanpa ini uji akses paksa lintas perusahaan
        // (D.3.2) tidak membuktikan apa pun: id 1 ada di kedua database.
        if ($slug === 'qabeta') {
            foreach (['clients', 'services', 'bank_accounts', 'transaction_categories',
                'invoices', 'invoice_items', 'payments', 'bank_transactions',
                'reimbursements', 'fund_requests', 'loans', 'receivables',
                'recurring_templates', 'recurring_invoices', 'pdf_templates'] as $t) {
                if (DB::table($t)->count() === 0) {
                    DB::statement("ALTER TABLE `$t` AUTO_INCREMENT = 501");
                }
            }
        }

        $client = Client::firstOrCreate(['name' => "$tag-KLIEN-01"], [
            'type' => 'company', 'email' => strtolower($tag).'-klien@qa.test',
            'address' => "$tag Jalan Uji 1", 'status' => 'Active', 'person_in_charge' => "$tag PIC",
        ]);
        Service::firstOrCreate(['name' => "$tag-LAYANAN-01"], ['price' => 5000000, 'type' => 'Perizinan']);

        $bank1 = BankAccount::firstOrCreate(['account_number' => $tag.'1000001'], [
            'account_name' => "$tag-REKENING-01", 'bank_name' => "Bank $tag", 'branch' => 'Pusat',
            'initial_balance' => 100000000,
        ]);
        BankAccount::firstOrCreate(['account_number' => $tag.'1000002'], [
            'account_name' => "$tag-REKENING-02", 'bank_name' => "Bank $tag", 'branch' => 'Cabang',
            'initial_balance' => 50000000,
        ]);

        $cat = TransactionCategory::firstOrCreate(['label' => "$tag-KATEGORI-01"], ['type' => 'expense']);

        $inv = Invoice::firstOrCreate(['invoice_number' => "$tag-INV-0001"], [
            'billed_to_id' => $client->id, 'subtotal' => 10000000, 'discount_amount' => 0,
            'ppn_rate' => 11, 'ppn_amount' => 1100000, 'total_amount' => 11100000,
            'issue_date' => now()->toDateString(), 'due_date' => now()->addDays(30)->toDateString(),
            'status' => 'sent',
        ]);
        InvoiceItem::firstOrCreate(['invoice_id' => $inv->id, 'service_name' => "$tag-ITEM-01"], [
            'client_id' => $client->id, 'quantity' => 1, 'unit' => 'paket',
            'unit_price' => 10000000, 'amount' => 10000000, 'cogs_amount' => 3000000,
        ]);
        Payment::firstOrCreate(['invoice_id' => $inv->id, 'reference_number' => "$tag-BAYAR-01"], [
            'bank_account_id' => $bank1->id, 'amount' => 5000000,
            'payment_date' => now()->toDateString(), 'payment_method' => 'bank_transfer',
        ]);
        $inv->updateStatus();

        BankTransaction::firstOrCreate(['reference_number' => "$tag-TRX-01"], [
            'bank_account_id' => $bank1->id, 'amount' => 2500000,
            'transaction_date' => now()->toDateString(), 'transaction_type' => 'debit',
            'description' => "$tag-TRANSAKSI-01", 'category_id' => $cat->id,
        ]);

        $lampiran = 'reimbursements/'.strtolower($tag).'-lampiran-01.txt';
        Storage::disk('public')->put($lampiran, "LAMPIRAN RAHASIA $tag - penanda $tag-LAMPIRAN-01\n");
        echo 'lampiran: '.Storage::disk('public')->path($lampiran)."\n";

        $pemohon = User::where('email', $tag === 'ALPHA' ? 'alpha-staff@qa.test' : 'beta-admin@qa.test')->first();
        Reimbursement::firstOrCreate(['title' => "$tag-REIMBURSEMENT-01"], [
            'user_id' => $pemohon->id, 'description' => "$tag uji", 'amount' => 750000,
            'expense_date' => now()->toDateString(), 'category_input' => 'Transport',
            'attachment_path' => $lampiran, 'attachment_name' => basename($lampiran),
            'status' => 'pending',
        ]);

        FundRequest::firstOrCreate(['title' => "$tag-FUNDREQUEST-01"], [
            'request_number' => "$tag-FR-0001", 'user_id' => $pemohon->id,
            'purpose' => "$tag keperluan uji", 'total_amount' => 2000000,
            'priority' => 'medium', 'needed_by_date' => now()->addDays(7)->toDateString(),
            'status' => 'pending',
        ]);

        Loan::firstOrCreate(['loan_number' => "$tag-LOAN-0001"], [
            'lender_name' => "$tag-PEMBERI-PINJAMAN", 'principal_amount' => 20000000,
            'interest_type' => 'percentage', 'interest_rate' => 10, 'interest_amount' => 2000000,
            'term_months' => 12, 'start_date' => now()->toDateString(),
            'maturity_date' => now()->addMonths(12)->toDateString(),
            'status' => 'active', 'purpose' => "$tag-PINJAMAN-01",
        ]);

        Receivable::firstOrCreate(['receivable_number' => "$tag-RCV-0001"], [
            'type' => 'company_loan', 'debtor_type' => Client::class, 'debtor_id' => $client->id,
            'principal_amount' => 3000000, 'interest_rate' => 0, 'installment_months' => 3,
            'installment_amount' => 1000000, 'loan_date' => now()->toDateString(),
            'due_date' => now()->addMonths(3)->toDateString(), 'status' => 'draft',
            'purpose' => "$tag-PIUTANG-01",
        ]);

        DB::table('recurring_templates')->insertOrIgnore([
            'client_id' => $client->id, 'template_name' => "$tag-RECURRING-01",
            'start_date' => now()->toDateString(), 'end_date' => now()->addYear()->toDateString(),
            'frequency' => 'monthly',
            'status' => 'active', 'invoice_template' => json_encode(['items' => []]),
            'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('pdf_templates')->insertOrIgnore([
            'name' => "$tag-PDFTEMPLATE-01", 'layout' => json_encode([]),
            'created_at' => now(), 'updated_at' => now(),
        ]);

        echo "data tenant_$slug: klien=".Client::count().' invoice='.Invoice::count()
            .' rekening='.BankAccount::count().' trx='.BankTransaction::count()
            .' reimb='.Reimbursement::count().' fr='.FundRequest::count()
            .' loan='.Loan::count().' rcv='.Receivable::count()."\n";
    });
}
echo "SELESAI\n";
