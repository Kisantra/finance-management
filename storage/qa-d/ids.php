<?php
/** Kumpulkan id baris nyata tiap tenant → storage/qa-d/ids.json */
require __DIR__.'/../../vendor/autoload.php';
$app = require_once __DIR__.'/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Company;
use Illuminate\Support\Facades\DB;

$out = [];
foreach (['qaalpha', 'qabeta'] as $slug) {
    $out[$slug] = Company::find($slug)->run(function () use ($slug) {
        $satu = function (string $tabel, string $kolom = 'id') {
            try {
                return DB::table($tabel)->orderBy('id')->value($kolom);
            } catch (Throwable $e) {
                return null;
            }
        };

        return [
            'invoice' => $satu('invoices'),
            'invoice_number' => $satu('invoices', 'invoice_number'),
            'reimbursement' => $satu('reimbursements'),
            'fundRequest' => $satu('fund_requests'),
            'template' => $satu('recurring_templates'),
            'pdfTemplate' => $satu('pdf_templates'),
            'client' => $satu('clients'),
            'bankAccount' => $satu('bank_accounts'),
            'bankTransaction' => $satu('bank_transactions'),
            'payment' => $satu('payments'),
            'loan' => $satu('loans'),
            'receivable' => $satu('receivables'),
            'service' => $satu('services'),
            'transactionCategory' => $satu('transaction_categories'),
            'attachment' => $satu('reimbursements', 'attachment_path'),
            'tabel' => DB::select('show tables') ? count(DB::select('show tables')) : 0,
        ];
    });
}
file_put_contents(__DIR__.'/ids.json', json_encode($out, JSON_PRETTY_PRINT));
echo json_encode($out, JSON_PRETTY_PRINT), "\n";
