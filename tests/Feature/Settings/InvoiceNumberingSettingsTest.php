<?php

namespace Tests\Feature\Settings;

use App\Models\Client;
use App\Models\CompanyProfile;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class InvoiceNumberingSettingsTest extends TestCase
{
    use RefreshDatabase;

    private User $manager;

    private User $staff;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
        foreach (['manage invoice settings', 'edit invoices', 'view invoices'] as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
        }

        $this->manager = User::factory()->create();
        $this->manager->givePermissionTo(['manage invoice settings', 'edit invoices', 'view invoices']);
        $this->staff = User::factory()->create();

        CompanyProfile::factory()->create(['name' => 'PT Kisantra Sinergi Nusantara']);
    }

    public function test_page_requires_the_permission(): void
    {
        $this->actingAs($this->staff)->get('/settings/invoice-numbering')->assertForbidden();
        $this->actingAs($this->staff)->put('/settings/invoice-numbering', [])->assertForbidden();
    }

    public function test_page_shows_current_settings_and_preview_material(): void
    {
        $this->actingAs($this->manager)
            ->get('/settings/invoice-numbering')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('settings/invoice-numbering')
                ->where('settings.format', '{NO}/INV/{PT}-{KLIEN}/{BLN_ROMAWI}/{THN}')
                ->where('settings.padding', 3)
                ->where('settings.reset', 'monthly')
                ->where('sample.company_initials', 'KSN')
                ->where('sample.next_sequence.monthly', 1)
                ->has('tokens', 7));
    }

    public function test_saving_a_new_format_is_used_by_the_next_send(): void
    {
        $this->actingAs($this->manager)
            ->put('/settings/invoice-numbering', ['format' => 'INV-{THN}-{NO}', 'padding' => 4, 'reset' => 'yearly'])
            ->assertSessionHasNoErrors();

        $this->assertSame('INV-{THN}-{NO}', CompanyProfile::current()->invoice_number_format);

        $client = Client::factory()->create();
        $draft = Invoice::factory()->draft()->create(['invoice_number' => null, 'billed_to_id' => $client->id, 'issue_date' => '2026-10-08']);

        $this->actingAs($this->manager)
            ->getJson("/invoices/{$draft->id}/data")
            ->assertJsonPath('next_invoice_number', 'INV-2026-0001');
    }

    public function test_invalid_formats_are_rejected_with_a_readable_message(): void
    {
        $this->actingAs($this->manager)
            ->put('/settings/invoice-numbering', ['format' => 'INV-{THN}-{NO}', 'padding' => 3, 'reset' => 'monthly'])
            ->assertSessionHasErrors(['format' => 'Nomor kembali ke 1 tiap bulan, jadi pola wajib memuat bulan ({BLN_ROMAWI} atau {BLN}) dan tahun ({THN} atau {THN2}) agar tidak sama dengan nomor bulan lain.']);

        $this->actingAs($this->manager)
            ->put('/settings/invoice-numbering', ['format' => 'INV-{THN}', 'padding' => 3, 'reset' => 'never'])
            ->assertSessionHasErrors(['format' => 'Pola wajib berisi {NO} tepat satu kali.']);

        $this->actingAs($this->manager)
            ->put('/settings/invoice-numbering', ['format' => '{NO}', 'padding' => 7, 'reset' => 'never'])
            ->assertSessionHasErrors(['padding' => 'Jumlah digit harus antara 1 dan 5.']);

        $this->assertSame('{NO}/INV/{PT}-{KLIEN}/{BLN_ROMAWI}/{THN}', CompanyProfile::current()->invoice_number_format);
    }

    public function test_saving_without_a_company_profile_asks_to_fill_it_first(): void
    {
        CompanyProfile::query()->delete();

        $this->actingAs($this->manager)
            ->put('/settings/invoice-numbering', ['format' => '{NO}', 'padding' => 3, 'reset' => 'never'])
            ->assertSessionHasErrors(['format' => 'Lengkapi Profil Perusahaan terlebih dahulu; pengaturan penomoran disimpan di sana.']);
    }

    public function test_settings_hub_renders_for_any_signed_in_user(): void
    {
        $this->actingAs($this->staff)
            ->get('/settings')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('settings/index'));
    }
}
