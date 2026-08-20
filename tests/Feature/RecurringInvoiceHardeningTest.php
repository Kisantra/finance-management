<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\RecurringInvoice;
use App\Models\RecurringTemplate;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

/**
 * Regresi BUG-RI-01, BUG-RI-02, BUG-RI-03.
 */
class RecurringInvoiceHardeningTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Client $klien;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'view recurring-invoices', 'create recurring-invoices',
            'edit recurring-invoices', 'delete recurring-invoices',
            'publish recurring-invoices', 'view invoices', 'create invoices',
        ] as $name) {
            Permission::findOrCreate($name, 'web');
        }

        setPermissionsTeamId(self::TEST_COMPANY);
        $this->admin = User::factory()->create();
        $this->admin->companies()->syncWithoutDetaching([self::TEST_COMPANY]);
        $this->admin->givePermissionTo(Permission::all());

        $this->klien = Client::factory()->create();
    }

    private function template(string $frequency = 'monthly'): RecurringTemplate
    {
        return RecurringTemplate::create([
            'template_name' => 'Template Uji',
            'client_id' => $this->klien->id,
            'frequency' => $frequency,
            'invoice_template' => 'kisantra-invoice',
            'start_date' => now()->startOfYear(),
            'end_date' => now()->endOfYear(),
            'status' => 'active',
        ]);
    }

    /** BUG-RI-01 — publish harus menyalin unit dan penanda titipan pajak. */
    public function test_publish_menyalin_unit_dan_penanda_titipan_pajak(): void
    {
        $template = $this->template();

        $recurring = RecurringInvoice::create([
            'template_id' => $template->id,
            'client_id' => $this->klien->id,
            'scheduled_date' => now(),
            'issue_date' => now(),
            'due_date' => now()->addDays(30),
            'status' => 'draft',
            'invoice_data' => [
                'total_amount' => 1_500_000,
                'subtotal' => 1_500_000,
                'items' => [
                    [
                        'service_name' => 'Jasa',
                        'quantity' => 1,
                        'unit' => 'bulan',
                        'unit_price' => 1_000_000,
                        'amount' => 1_000_000,
                        'cogs_amount' => 0,
                        'is_tax_deposit' => false,
                    ],
                    [
                        'service_name' => 'Titipan PPh',
                        'quantity' => 1,
                        'unit' => 'dokumen',
                        'unit_price' => 500_000,
                        'amount' => 500_000,
                        'cogs_amount' => 0,
                        'is_tax_deposit' => true,
                    ],
                ],
            ],
        ]);

        $invoice = $recurring->publish();

        $titipan = $invoice->items()->where('service_name', 'Titipan PPh')->firstOrFail();
        $biasa = $invoice->items()->where('service_name', 'Jasa')->firstOrFail();

        $this->assertTrue((bool) $titipan->is_tax_deposit,
            'Penanda titipan pajak harus ikut tersalin — basis PPh 0,5% bergantung padanya.');
        $this->assertFalse((bool) $biasa->is_tax_deposit);
        $this->assertSame('bulan', $biasa->unit, 'Satuan item harus ikut tersalin.');
        $this->assertSame('dokumen', $titipan->unit);
    }

    /** BUG-RI-02 — bulan di luar siklus template harus ditolak. */
    public function test_bulan_di_luar_siklus_template_ditolak(): void
    {
        $template = $this->template('quarterly');

        // start_date 1 Jan; siklus triwulanan jatuh pada Apr, Jul, Okt.
        // Februari bukan periode penagihan yang sah.
        $this->actingAs($this->admin)
            ->postJson('/recurring-invoices/monthly', [
                'template_id' => $template->id,
                'scheduled_date' => now()->startOfYear()->addMonth()->toDateString(),
                'issue_date' => now()->startOfYear()->addMonth()->toDateString(),
                'due_date' => now()->startOfYear()->addMonths(2)->toDateString(),
                'items' => [[
                    'service_name' => 'Jasa',
                    'quantity' => 1,
                    'unit_price' => 1_000_000,
                ]],
            ])
            ->assertStatus(422);

        $this->assertDatabaseCount('recurring_invoices', 0);
    }

    /** BUG-RI-03 — satuan yang terlalu panjang ditolak, bukan dipotong DB. */
    public function test_satuan_terlalu_panjang_ditolak(): void
    {
        $template = $this->template();

        $this->actingAs($this->admin)
            ->postJson('/recurring-invoices/monthly', [
                'template_id' => $template->id,
                'scheduled_date' => now()->startOfYear()->addMonth()->toDateString(),
                'issue_date' => now()->startOfYear()->addMonth()->toDateString(),
                'due_date' => now()->startOfYear()->addMonths(2)->toDateString(),
                'items' => [[
                    'service_name' => 'Jasa',
                    'quantity' => 1,
                    'unit' => str_repeat('A', 100),
                    'unit_price' => 1_000_000,
                ]],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('items.0.unit');
    }
}
