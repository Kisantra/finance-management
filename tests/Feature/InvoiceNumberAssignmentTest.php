<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Invoice;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InvoiceNumberAssignmentTest extends TestCase
{
    use RefreshDatabase;

    public function test_draft_invoice_can_be_created_without_invoice_number(): void
    {
        $client = Client::factory()->create();

        $invoice = Invoice::create([
            'billed_to_id' => $client->id,
            'subtotal' => 1_000_000,
            'total_amount' => 1_000_000,
            'issue_date' => now(),
            'due_date' => now()->addDays(30),
            'status' => 'draft',
        ]);

        $this->assertNull($invoice->invoice_number);
        $this->assertEquals('draft', $invoice->status);
    }

    public function test_generate_invoice_number_increments_sequence(): void
    {
        $client = Client::factory()->create(['name' => 'Client A', 'type' => 'individual']);

        // Existing invoice for same month
        Invoice::factory()->create([
            'invoice_number' => '001/INV/SPI-CA/III/2026',
            'issue_date' => '2026-03-01',
            'status' => 'sent',
            'billed_to_id' => $client->id,
        ]);

        $issueDate = Carbon::parse('2026-03-15');
        $number = Invoice::generateInvoiceNumber($issueDate, $client->id);

        $this->assertStringStartsWith('002/', $number);
        $this->assertStringContainsString('/INV/', $number);
        $this->assertStringContainsString('/III/', $number);
        $this->assertStringContainsString('/2026', $number);
    }

    public function test_generate_invoice_number_starts_at_001_for_new_month(): void
    {
        $client = Client::factory()->create(['name' => 'Client B', 'type' => 'individual']);

        // Invoice from different month should not affect sequence
        Invoice::factory()->create([
            'invoice_number' => '005/INV/SPI-CB/II/2026',
            'issue_date' => '2026-02-15',
            'status' => 'sent',
            'billed_to_id' => $client->id,
        ]);

        $issueDate = Carbon::parse('2026-03-01');
        $number = Invoice::generateInvoiceNumber($issueDate, $client->id);

        $this->assertStringStartsWith('001/', $number);
    }

    public function test_is_invoice_latest_in_month_true_for_highest_sequence(): void
    {
        $client = Client::factory()->create();

        $invoice1 = Invoice::factory()->create([
            'invoice_number' => '001/INV/T-C/III/2026',
            'issue_date' => '2026-03-01',
            'status' => 'sent',
            'billed_to_id' => $client->id,
        ]);

        $invoice2 = Invoice::factory()->create([
            'invoice_number' => '002/INV/T-C/III/2026',
            'issue_date' => '2026-03-10',
            'status' => 'sent',
            'billed_to_id' => $client->id,
        ]);

        $this->assertFalse(Invoice::isLatestInNumberingPeriod($invoice1));
        $this->assertTrue(Invoice::isLatestInNumberingPeriod($invoice2));
    }

    public function test_is_invoice_latest_in_month_false_for_null_invoice_number(): void
    {
        $client = Client::factory()->create();

        $invoice = Invoice::factory()->create([
            'invoice_number' => null,
            'issue_date' => '2026-03-01',
            'status' => 'draft',
            'billed_to_id' => $client->id,
        ]);

        $this->assertFalse(Invoice::isLatestInNumberingPeriod($invoice));
    }
}
