<?php

namespace Tests\Feature;

use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Payment;
use App\Models\TransactionCategory;
use App\Services\ProfitLossService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ProfitLossServiceTest extends TestCase
{
    use RefreshDatabase;

    private ProfitLossService $service;

    private BankAccount $bank;

    private TransactionCategory $catRevenue;

    private TransactionCategory $catCogs;

    private TransactionCategory $catOpex;

    private TransactionCategory $catTax;

    private TransactionCategory $catOtherIncome;

    private TransactionCategory $catOtherExpense;

    private TransactionCategory $catFinancing;

    private TransactionCategory $catUnclassifiedExpense;

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = app(ProfitLossService::class);
        $this->bank = BankAccount::factory()->create(['initial_balance' => 0]);

        $this->catRevenue = TransactionCategory::create(['type' => 'income', 'pl_group' => 'revenue', 'label' => 'Penjualan Lain']);
        $this->catCogs = TransactionCategory::create(['type' => 'expense', 'pl_group' => 'cogs', 'label' => 'HPP Manual']);
        $this->catOpex = TransactionCategory::create(['type' => 'expense', 'pl_group' => 'opex', 'label' => 'Operasional']);
        $this->catTax = TransactionCategory::create(['type' => 'expense', 'pl_group' => 'tax', 'label' => 'PPh']);
        $this->catOtherIncome = TransactionCategory::create(['type' => 'income', 'pl_group' => 'other_income', 'label' => 'Bunga Bank']);
        $this->catOtherExpense = TransactionCategory::create(['type' => 'expense', 'pl_group' => 'other_expense', 'label' => 'Bunga Pinjaman']);
        $this->catFinancing = TransactionCategory::create(['type' => 'financing', 'label' => 'Pokok Pinjaman']);
        $this->catUnclassifiedExpense = TransactionCategory::create(['type' => 'expense', 'label' => 'Belum Diberi Grup']);
    }

    /** Helper: build an invoice with a single item and given cogs. */
    private function makeInvoice(int $amount, int $cogs, string $issueDate = '2026-01-01'): Invoice
    {
        $invoice = Invoice::factory()->create([
            'total_amount' => $amount,
            'issue_date' => $issueDate,
            'status' => 'partially_paid',
        ]);

        InvoiceItem::factory()->create([
            'invoice_id' => $invoice->id,
            'quantity' => 1,
            'unit_price' => $amount,
            'amount' => $amount,
            'cogs_amount' => $cogs,
        ]);

        return $invoice;
    }

    /**
     * Helper: invoice with a regular item (with cogs) PLUS a tax-deposit item
     * representing client tax money held in trust. total_amount = jasa + titipan.
     */
    private function makeInvoiceWithTitipan(int $jasaAmount, int $jasaCogs, int $titipan, string $issueDate = '2026-01-01'): Invoice
    {
        $invoice = Invoice::factory()->create([
            'total_amount' => $jasaAmount + $titipan,
            'issue_date' => $issueDate,
            'status' => 'partially_paid',
        ]);

        InvoiceItem::factory()->create([
            'invoice_id' => $invoice->id,
            'quantity' => 1,
            'unit_price' => $jasaAmount,
            'amount' => $jasaAmount,
            'cogs_amount' => $jasaCogs,
            'is_tax_deposit' => false,
        ]);

        InvoiceItem::factory()->create([
            'invoice_id' => $invoice->id,
            'quantity' => 1,
            'unit_price' => $titipan,
            'amount' => $titipan,
            'cogs_amount' => 0,
            'is_tax_deposit' => true,
        ]);

        return $invoice;
    }

    private function makePayment(Invoice $invoice, int $amount, string $paymentDate): Payment
    {
        return Payment::factory()->create([
            'invoice_id' => $invoice->id,
            'bank_account_id' => $this->bank->id,
            'amount' => $amount,
            'payment_date' => $paymentDate,
        ]);
    }

    private function makeTx(TransactionCategory $cat, string $direction, int $amount, string $date): BankTransaction
    {
        return BankTransaction::create([
            'bank_account_id' => $this->bank->id,
            'category_id' => $cat->id,
            'amount' => $amount,
            'transaction_type' => $direction,
            'transaction_date' => $date,
            'description' => "Test {$direction} {$cat->label}",
        ]);
    }

    public function test_empty_period_returns_all_zeros(): void
    {
        $report = $this->service->generate(Carbon::parse('2026-01-01'), Carbon::parse('2026-01-31'));

        $this->assertSame(0, $report['revenue']['total']);
        $this->assertSame(0, $report['cogs']['total']);
        $this->assertSame(0, $report['gross_profit']);
        $this->assertSame(0, $report['opex']['total']);
        $this->assertSame(0, $report['net_profit']);
        $this->assertSame(0, $report['unclassified']['income']['total']);
        $this->assertSame(0, $report['unclassified']['expense']['total']);
    }

    public function test_fully_paid_invoice_within_period(): void
    {
        $invoice = $this->makeInvoice(amount: 100_000, cogs: 60_000);
        $this->makePayment($invoice, 100_000, '2026-01-15');

        $report = $this->service->generate(Carbon::parse('2026-01-01'), Carbon::parse('2026-01-31'));

        $this->assertSame(100_000, $report['revenue']['invoice']);
        $this->assertSame(60_000, $report['cogs']['invoice']);
        $this->assertSame(40_000, $report['gross_profit']);
        $this->assertSame(40_000, $report['net_profit']);
    }

    public function test_cost_recovery_partial_payment_yields_zero_profit(): void
    {
        // Pay only 50% — by "tutup modal dulu" rule, all of it covers HPP first.
        $invoice = $this->makeInvoice(100_000, 60_000);
        $this->makePayment($invoice, 50_000, '2026-01-15');

        $report = $this->service->generate(Carbon::parse('2026-01-01'), Carbon::parse('2026-01-31'));

        $this->assertSame(50_000, $report['revenue']['invoice']);
        $this->assertSame(50_000, $report['cogs']['invoice'], 'All 50k payment should cover HPP first');
        $this->assertSame(0, $report['gross_profit']);
    }

    public function test_cost_recovery_across_two_periods(): void
    {
        // Invoice 100k, COGS 60k. Pay 50k in Jan, 50k in Feb.
        // Jan: revenue 50k, COGS 50k, profit 0
        // Feb: revenue 50k, COGS 10k (remaining HPP), profit 40k
        $invoice = $this->makeInvoice(100_000, 60_000);
        $this->makePayment($invoice, 50_000, '2026-01-15');
        $this->makePayment($invoice, 50_000, '2026-02-15');

        $jan = $this->service->generate(Carbon::parse('2026-01-01'), Carbon::parse('2026-01-31'));
        $this->assertSame(50_000, $jan['revenue']['invoice']);
        $this->assertSame(50_000, $jan['cogs']['invoice']);
        $this->assertSame(0, $jan['gross_profit']);

        $feb = $this->service->generate(Carbon::parse('2026-02-01'), Carbon::parse('2026-02-28'));
        $this->assertSame(50_000, $feb['revenue']['invoice']);
        $this->assertSame(10_000, $feb['cogs']['invoice']);
        $this->assertSame(40_000, $feb['gross_profit']);

        // Sanity: across both months totals equal the invoice's full gross profit.
        $this->assertSame(40_000, $jan['gross_profit'] + $feb['gross_profit']);
    }

    public function test_invoice_paid_before_period_contributes_nothing(): void
    {
        $invoice = $this->makeInvoice(100_000, 60_000);
        $this->makePayment($invoice, 100_000, '2025-12-15');

        $report = $this->service->generate(Carbon::parse('2026-01-01'), Carbon::parse('2026-01-31'));

        $this->assertSame(0, $report['revenue']['invoice']);
        $this->assertSame(0, $report['cogs']['invoice']);
    }

    public function test_non_invoice_revenue_and_manual_hpp(): void
    {
        $this->makeTx($this->catRevenue, 'credit', 200_000, '2026-01-10');
        $this->makeTx($this->catCogs, 'debit', 80_000, '2026-01-12');

        $report = $this->service->generate(Carbon::parse('2026-01-01'), Carbon::parse('2026-01-31'));

        $this->assertSame(0, $report['revenue']['invoice']);
        $this->assertSame(200_000, $report['revenue']['non_invoice']);
        $this->assertSame(200_000, $report['revenue']['total']);
        $this->assertSame(80_000, $report['cogs']['manual']);
        $this->assertSame(80_000, $report['cogs']['total']);
        $this->assertSame(120_000, $report['gross_profit']);
    }

    public function test_full_p_and_l_aggregation(): void
    {
        // Invoice fully paid in period — revenue 100k, cogs 60k, GP 40k
        $invoice = $this->makeInvoice(100_000, 60_000);
        $this->makePayment($invoice, 100_000, '2026-01-15');

        // Operating expenses
        $this->makeTx($this->catOpex, 'debit', 15_000, '2026-01-05');
        $this->makeTx($this->catOpex, 'debit', 5_000, '2026-01-20');

        // Other income / expense
        $this->makeTx($this->catOtherIncome, 'credit', 2_000, '2026-01-25');
        $this->makeTx($this->catOtherExpense, 'debit', 3_000, '2026-01-26');

        // Tax
        $this->makeTx($this->catTax, 'debit', 4_000, '2026-01-28');

        // Excluded: financing transactions
        $this->makeTx($this->catFinancing, 'credit', 1_000_000, '2026-01-10');
        $this->makeTx($this->catFinancing, 'debit', 500_000, '2026-01-15');

        $report = $this->service->generate(Carbon::parse('2026-01-01'), Carbon::parse('2026-01-31'));

        $this->assertSame(40_000, $report['gross_profit']);
        $this->assertSame(20_000, $report['opex']['total']);
        $this->assertSame(20_000, $report['operating_profit']);
        $this->assertSame(2_000, $report['other_income']['total']);
        $this->assertSame(3_000, $report['other_expense']['total']);
        $this->assertSame(19_000, $report['pre_tax_profit']);
        $this->assertSame(4_000, $report['tax']['total']);
        $this->assertSame(15_000, $report['net_profit']);
    }

    public function test_unclassified_bucket_surfaces_unmapped_transactions(): void
    {
        // expense category exists but no pl_group
        $this->makeTx($this->catUnclassifiedExpense, 'debit', 9_000, '2026-01-10');

        // transaction with no category at all
        BankTransaction::create([
            'bank_account_id' => $this->bank->id,
            'category_id' => null,
            'amount' => 1_000,
            'transaction_type' => 'debit',
            'transaction_date' => '2026-01-11',
            'description' => 'Orphan expense',
        ]);

        $report = $this->service->generate(Carbon::parse('2026-01-01'), Carbon::parse('2026-01-31'));

        $this->assertSame(10_000, $report['unclassified']['expense']['total']);
        $this->assertSame(0, $report['unclassified']['income']['total']);

        // Critical: unclassified is NOT rolled into opex / net_profit.
        $this->assertSame(0, $report['opex']['total']);
        $this->assertSame(0, $report['net_profit']);
    }

    public function test_financing_and_transfer_never_appear_anywhere(): void
    {
        $catTransfer = TransactionCategory::create(['type' => 'transfer', 'label' => 'Transfer Internal']);

        $this->makeTx($this->catFinancing, 'credit', 1_000_000, '2026-01-10');
        $this->makeTx($this->catFinancing, 'debit', 500_000, '2026-01-15');
        $this->makeTx($catTransfer, 'credit', 200_000, '2026-01-20');
        $this->makeTx($catTransfer, 'debit', 200_000, '2026-01-20');

        $report = $this->service->generate(Carbon::parse('2026-01-01'), Carbon::parse('2026-01-31'));

        $this->assertSame(0, $report['revenue']['total']);
        $this->assertSame(0, $report['cogs']['total']);
        $this->assertSame(0, $report['opex']['total']);
        $this->assertSame(0, $report['other_income']['total']);
        $this->assertSame(0, $report['other_expense']['total']);
        $this->assertSame(0, $report['tax']['total']);
        $this->assertSame(0, $report['unclassified']['income']['total']);
        $this->assertSame(0, $report['unclassified']['expense']['total']);
        $this->assertSame(0, $report['net_profit']);
    }

    public function test_titipan_excluded_from_revenue_when_invoice_fully_paid(): void
    {
        // Konsultan pajak: invoice Rp 100.5jt (jasa Rp 100jt + titipan Rp 500rb), modal Rp 60jt
        $invoice = $this->makeInvoiceWithTitipan(jasaAmount: 100_000_000, jasaCogs: 60_000_000, titipan: 500_000);
        $this->makePayment($invoice, 100_500_000, '2026-01-15');

        $report = $this->service->generate(Carbon::parse('2026-01-01'), Carbon::parse('2026-01-31'));

        $this->assertSame(100_000_000, $report['revenue']['invoice'], 'Titipan Rp 500rb harus dikecualikan dari pendapatan');
        $this->assertSame(60_000_000, $report['cogs']['invoice']);
        $this->assertSame(40_000_000, $report['gross_profit']);
    }

    public function test_titipan_dulu_partial_payment_covers_titipan_first(): void
    {
        // Invoice Rp 100.5jt (jasa 100jt + titipan 500rb), modal 60jt
        // Bayar Rp 300rb di bulan ini → semua nutup titipan, belum mulai recognize jasa
        $invoice = $this->makeInvoiceWithTitipan(100_000_000, 60_000_000, 500_000);
        $this->makePayment($invoice, 300_000, '2026-01-15');

        $report = $this->service->generate(Carbon::parse('2026-01-01'), Carbon::parse('2026-01-31'));

        $this->assertSame(0, $report['revenue']['invoice'], 'Pembayaran 300rb masih nutup titipan, belum ada pendapatan');
        $this->assertSame(0, $report['cogs']['invoice']);
        $this->assertSame(0, $report['gross_profit']);
    }

    public function test_titipan_dulu_across_period_boundary(): void
    {
        // Invoice 100.5jt (jasa 100jt + titipan 500rb), modal 60jt
        // Jan: bayar 1jt → titipan lunas (500rb), sisa 500rb jadi pendapatan; cost-recovery: HPP 500rb diakui, laba 0
        // Feb: bayar 99.5jt → semua pendapatan; HPP 59.5jt sisanya diakui, lalu 40jt laba kotor
        $invoice = $this->makeInvoiceWithTitipan(100_000_000, 60_000_000, 500_000);
        $this->makePayment($invoice, 1_000_000, '2026-01-15');
        $this->makePayment($invoice, 99_500_000, '2026-02-15');

        $jan = $this->service->generate(Carbon::parse('2026-01-01'), Carbon::parse('2026-01-31'));
        $this->assertSame(500_000, $jan['revenue']['invoice']);
        $this->assertSame(500_000, $jan['cogs']['invoice']);
        $this->assertSame(0, $jan['gross_profit']);

        $feb = $this->service->generate(Carbon::parse('2026-02-01'), Carbon::parse('2026-02-28'));
        $this->assertSame(99_500_000, $feb['revenue']['invoice']);
        $this->assertSame(59_500_000, $feb['cogs']['invoice']);
        $this->assertSame(40_000_000, $feb['gross_profit']);

        // Sanity check across both months — total revenue = jasa only, never the titipan
        $this->assertSame(100_000_000, $jan['revenue']['invoice'] + $feb['revenue']['invoice']);
        $this->assertSame(40_000_000, $jan['gross_profit'] + $feb['gross_profit']);
    }

    public function test_invoice_with_only_titipan_recognizes_nothing(): void
    {
        // Edge case: invoice yang isinya cuma titipan klien (jasa = 0)
        $invoice = $this->makeInvoiceWithTitipan(jasaAmount: 0, jasaCogs: 0, titipan: 500_000);
        $this->makePayment($invoice, 500_000, '2026-01-15');

        $report = $this->service->generate(Carbon::parse('2026-01-01'), Carbon::parse('2026-01-31'));

        $this->assertSame(0, $report['revenue']['invoice']);
        $this->assertSame(0, $report['cogs']['invoice']);
        $this->assertSame(0, $report['gross_profit']);
    }

    public function test_by_category_breakdown_includes_label_and_amount(): void
    {
        $this->makeTx($this->catOpex, 'debit', 15_000, '2026-01-05');
        $this->makeTx($this->catOpex, 'debit', 5_000, '2026-01-20');

        $report = $this->service->generate(Carbon::parse('2026-01-01'), Carbon::parse('2026-01-31'));

        $this->assertCount(1, $report['opex']['by_category']);
        $this->assertSame('Operasional', $report['opex']['by_category'][0]['category_label']);
        $this->assertSame(20_000, $report['opex']['by_category'][0]['amount']);
    }

    /**
     * GERBANG PERFORMA. Jumlah query laporan laba rugi tidak boleh tumbuh
     * mengikuti jumlah invoice.
     *
     * invoiceContributions() dulu memanggil Payment::sum() DUA KALI per invoice
     * di dalam loop. Terukur pada data nyata: 200 invoice menghasilkan 297 query
     * dan 130 ms waktu database — satu-satunya beban performa nyata yang tersisa
     * di aplikasi ini, dan jauh lebih besar daripada biaya multi-perusahaan itu
     * sendiri (+3 query, +2,33 ms per request).
     *
     * N+1 TIDAK PERNAH terlihat dari hasil laporannya: angkanya benar, hanya
     * lambat. Test nilai karena itu tidak akan pernah menangkapnya, dan gerbang
     * ini harus menghitung query, bukan rupiah.
     */
    public function test_jumlah_query_laba_rugi_tidak_tumbuh_mengikuti_jumlah_invoice(): void
    {
        $jalankan = fn (): array => $this->service->generate(
            Carbon::parse('2026-01-01'),
            Carbon::parse('2026-01-31')
        );

        $this->buatInvoiceBerbayar(3);
        $queryUntuk3 = $this->hitungQuery($jalankan);

        $this->buatInvoiceBerbayar(12);
        $queryUntuk15 = $this->hitungQuery($jalankan);

        $this->assertSame(
            $queryUntuk3,
            $queryUntuk15,
            "Jumlah query laba rugi naik dari {$queryUntuk3} (3 invoice) menjadi {$queryUntuk15} (15 invoice). "
            .'Berarti ada query yang dijalankan di dalam loop per-invoice lagi — periksa invoiceContributions().'
        );
    }

    private function buatInvoiceBerbayar(int $jumlah): void
    {
        for ($i = 0; $i < $jumlah; $i++) {
            $invoice = $this->makeInvoice(1_000_000, 400_000);
            $this->makePayment($invoice, 1_000_000, '2026-01-15');
        }
    }

    private function hitungQuery(callable $aksi): int
    {
        DB::flushQueryLog();
        DB::enableQueryLog();

        try {
            $aksi();

            return count(DB::getQueryLog());
        } finally {
            DB::disableQueryLog();
            DB::flushQueryLog();
        }
    }
}
