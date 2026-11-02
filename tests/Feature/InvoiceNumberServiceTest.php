<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\CompanyProfile;
use App\Models\Invoice;
use App\Models\RecurringInvoice;
use App\Models\RecurringTemplate;
use App\Services\InvoiceNumberService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InvoiceNumberServiceTest extends TestCase
{
    use RefreshDatabase;

    private InvoiceNumberService $numbers;

    private Client $client;

    protected function setUp(): void
    {
        parent::setUp();

        $this->numbers = app(InvoiceNumberService::class);
        CompanyProfile::factory()->create(['name' => 'PT Kisantra Sinergi Nusantara']);
        $this->client = Client::factory()->create(['name' => 'PT. Sanjaya Sukses Raya', 'type' => 'individual']);
    }

    private function sent(string $number, string $issueDate): Invoice
    {
        return Invoice::factory()->create([
            'invoice_number' => $number,
            'issue_date' => $issueDate,
            'status' => 'sent',
            'billed_to_id' => $this->client->id,
        ]);
    }

    private function useFormat(string $format, int $padding = 3, string $reset = 'monthly'): void
    {
        CompanyProfile::current()->update([
            'invoice_number_format' => $format,
            'invoice_number_padding' => $padding,
            'invoice_number_reset' => $reset,
        ]);
    }

    public function test_default_format_matches_the_company_numbering(): void
    {
        $this->sent('015/INV/KSN-SSR/IX/2026', '2026-09-03');

        $this->assertSame('016/INV/KSN-SSR/IX/2026', $this->numbers->next(Carbon::parse('2026-09-20'), $this->client->id));
        $this->assertSame('001/INV/KSN-SSR/X/2026', $this->numbers->next(Carbon::parse('2026-10-01'), $this->client->id));
    }

    public function test_saving_a_number_stores_its_sequence_and_clearing_it_resets(): void
    {
        $invoice = $this->sent('007/INV/KSN-SSR/IX/2026', '2026-09-03');
        $this->assertSame(7, $invoice->invoice_sequence);

        $invoice->update(['invoice_number' => null, 'status' => 'draft']);
        $this->assertNull($invoice->fresh()->invoice_sequence);
    }

    public function test_custom_format_with_yearly_reset_and_four_digits(): void
    {
        $this->useFormat('INV-{THN}-{NO}', 4, 'yearly');
        $this->sent('INV-2026-0041', '2026-02-10');

        $this->assertSame('INV-2026-0042', $this->numbers->next(Carbon::parse('2026-11-30'), $this->client->id));
        $this->assertSame('INV-2027-0001', $this->numbers->next(Carbon::parse('2027-01-02'), $this->client->id));
    }

    public function test_two_digit_numbers_keep_growing_past_99(): void
    {
        $this->useFormat('{NO}/INV/{PT}/{BLN}.{THN2}', 2);
        $this->sent('08/INV/KSN/10.26', '2026-10-01');
        $this->assertSame('09/INV/KSN/10.26', $this->numbers->next(Carbon::parse('2026-10-08'), $this->client->id));

        $this->sent('99/INV/KSN/10.26', '2026-10-02');
        $this->assertSame('100/INV/KSN/10.26', $this->numbers->next(Carbon::parse('2026-10-08'), $this->client->id));
    }

    public function test_never_reset_keeps_counting_across_years(): void
    {
        $this->useFormat('{PT}/{NO}', 3, 'never');
        $this->sent('KSN/118', '2025-12-30');

        $this->assertSame('KSN/119', $this->numbers->next(Carbon::parse('2026-01-05'), $this->client->id));
    }

    public function test_sequence_is_read_from_numbers_without_separators(): void
    {
        $this->useFormat('{THN}{BLN}{NO}', 3, 'monthly');

        $this->assertSame(18, $this->numbers->sequenceOf('202610018'));
        $this->assertNull($this->numbers->sequenceOf('INV/02/KSN/02.26'));
    }

    public function test_old_numbers_keep_their_sequence_after_the_format_changes(): void
    {
        $this->sent('009/INV/KSN-SSR/X/2026', '2026-10-01');
        $this->useFormat('INV/{THN}/{BLN}/{NO}');

        $this->assertSame('INV/2026/10/010', $this->numbers->next(Carbon::parse('2026-10-08'), $this->client->id));
    }

    public function test_manual_number_outside_the_format_does_not_move_the_counter(): void
    {
        $this->sent('003/INV/KSN-SSR/X/2026', '2026-10-01');
        $manual = $this->sent('KHUSUS-ABC', '2026-10-02');

        $this->assertNull($manual->invoice_sequence);
        $this->assertSame('004/INV/KSN-SSR/X/2026', $this->numbers->next(Carbon::parse('2026-10-08'), $this->client->id));
        $this->assertFalse(Invoice::isLatestInNumberingPeriod($manual));
    }

    public function test_latest_in_period_follows_the_reset_setting(): void
    {
        $this->useFormat('INV-{THN}-{NO}', 3, 'yearly');
        $january = $this->sent('INV-2026-001', '2026-01-15');
        $october = $this->sent('INV-2026-002', '2026-10-01');

        $this->assertFalse(Invoice::isLatestInNumberingPeriod($january));
        $this->assertTrue(Invoice::isLatestInNumberingPeriod($october));
    }

    public function test_format_errors(): void
    {
        $this->assertNull($this->numbers->formatError(InvoiceNumberService::DEFAULT_FORMAT, 'monthly'));
        $this->assertStringContainsString('{NO}', $this->numbers->formatError('INV/{THN}/{BLN}', 'monthly'));
        $this->assertStringContainsString('{FOO}', $this->numbers->formatError('{NO}/{FOO}/{THN}/{BLN}', 'monthly'));
        $this->assertStringContainsString('tiap bulan', $this->numbers->formatError('INV-{THN}-{NO}', 'monthly'));
        $this->assertStringContainsString('tiap tahun', $this->numbers->formatError('INV-{NO}', 'yearly'));
        $this->assertNull($this->numbers->formatError('INV-{NO}', 'never'));
        $this->assertNotNull($this->numbers->formatError('INV-{NO}}', 'never'));
    }

    public function test_recurring_publish_creates_an_unnumbered_draft(): void
    {
        $template = RecurringTemplate::forceCreate([
            'client_id' => $this->client->id,
            'template_name' => 'Retainer',
            'start_date' => '2026-01-01',
            'end_date' => '2026-12-31',
            'frequency' => 'monthly',
            'invoice_template' => ['items' => [], 'subtotal' => 1_000_000, 'discount_amount' => 0, 'total_amount' => 1_000_000],
        ]);
        $recurring = RecurringInvoice::create([
            'template_id' => $template->id,
            'client_id' => $this->client->id,
            'scheduled_date' => '2026-10-01',
            'invoice_data' => [
                'items' => [['service_name' => 'Retainer', 'quantity' => 1, 'unit_price' => 1_000_000, 'amount' => 1_000_000]],
                'subtotal' => 1_000_000,
                'total_amount' => 1_000_000,
            ],
            'status' => 'draft',
        ]);

        $invoice = $recurring->publish();

        $this->assertNull($invoice->invoice_number);
        $this->assertSame('draft', $invoice->status);
    }
}
