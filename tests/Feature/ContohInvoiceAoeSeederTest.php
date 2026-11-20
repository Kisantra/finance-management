<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Company;
use App\Models\CompanyProfile;
use App\Models\Invoice;
use App\Models\User;
use Carbon\Carbon;
use Database\Seeders\ContohInvoiceAoeSeeder;
use Database\Seeders\ContohInvoiceMkbSeeder;
use Database\Seeders\MitraGroupSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Stancl\Tenancy\Events\TenantCreated;
use Tests\TestCase;

class ContohInvoiceAoeSeederTest extends TestCase
{
    use RefreshDatabase;

    private const AOE = 'abdi-ocean-energy';

    protected function setUp(): void
    {
        parent::setUp();

        // Jangan buat database tenant sungguhan di test
        Event::fake([TenantCreated::class]);
        Storage::fake('public');
    }

    public function test_menyiapkan_aoe_saja_dengan_akun_profil_dan_invoice_contoh(): void
    {
        $this->seed(ContohInvoiceAoeSeeder::class);

        $this->assertSame([self::AOE], Company::where('organization_id', Company::findOrFail(self::AOE)->organization_id)->pluck('id')->all());
        Event::assertDispatchedTimes(TenantCreated::class, 1);

        foreach (['admin.aoe@mitragroup.id' => 'admin', 'staff.aoe@mitragroup.id' => 'staff'] as $email => $role) {
            $user = User::where('email', $email)->firstOrFail();
            $this->assertSame([self::AOE], $user->companies()->pluck('companies.id')->all(), "{$email} hanya anggota AOE");
            $this->assertSame(ucfirst($role).' AOE', $user->name);

            setPermissionsTeamId(self::AOE);
            $this->assertTrue($user->unsetRelation('roles')->hasRole($role), "{$email} berperan {$role} di AOE");
        }

        $profile = CompanyProfile::current();
        $this->assertSame('PT. ABDI OCEAN ENERGY', $profile->name);
        $this->assertSame('AOE', $profile->abbreviation);
        $this->assertSame('{NO}/{PT}-{KLIEN}/{KODE}/{BLN_ROMAWI}/{THN}', $profile->invoice_number_format);
        $this->assertSame([], $profile->missingFields());
        $this->assertSame('Samarinda', $profile->signature_city);
        $this->assertSame('148-00-3122555-3', $profile->bank_accounts[0]['account_number']);
        $this->assertFalse($profile->needsInvoiceReview());

        // Tanda tangan CONTOH digambar dengan Carlito-Bold dari folder AOE.
        $this->assertSame('images/contoh-ttd-stempel.png', $profile->signature_path);
        $this->assertStringStartsWith("\x89PNG", Storage::disk('public')->get($profile->signature_path));

        $this->assertSame(
            [
                '115/AOE-CDS/INV-FINAL/XI/2026',
                '116/AOE-CDS/DN-PNBP/XI/2026',
                '117/AOE-CDS/DN-PNBP/XI/2026',
                '118/AOE-CDS/DN-DEM/XI/2026',
            ],
            Invoice::whereNotNull('invoice_number')->orderBy('invoice_number')->pluck('invoice_number')->all(),
        );
        $this->assertSame(1, Invoice::where('status', 'draft')->count());
        $this->assertSame([115, 116, 117, 118], Invoice::whereNotNull('invoice_number')->orderBy('invoice_number')->pluck('invoice_sequence')->all());
        $this->assertSame('119/AOE-CDS/INV-FINAL/XI/2026', Invoice::generateInvoiceNumber(Carbon::parse('2026-11-18'), Client::where('name', 'PT. CONTOH DAYA SAMUDRA')->value('id'), Invoice::TYPE_INVOICE, 'FINAL'));

        $final = Invoice::with('items')->where('invoice_number', '115/AOE-CDS/INV-FINAL/XI/2026')->sole();
        $this->assertSame('Invoice FINAL MV. CONTOH PROSPER', $final->subject);
        $this->assertSame('FINAL', $final->document_code);
        // 532.000.000 + PPN 58.520.000 − PPh 23 2% 10.640.000.
        $this->assertSame(532_000_000, (int) $final->subtotal);
        $this->assertSame(58_520_000, (int) $final->ppn_amount);
        $this->assertSame(10_640_000, (int) $final->pph_amount);
        $this->assertSame(579_880_000, (int) $final->total_amount);

        // Debit Note: talangan, tanpa PPN/PPh, total = yang dibayar AOE.
        $debitNotes = Invoice::with('items')->where('document_type', Invoice::TYPE_DEBIT_NOTE)->orderBy('invoice_number')->get();
        $this->assertSame(['PNBP', 'PNBP', 'DEM'], $debitNotes->pluck('document_code')->all());
        $this->assertSame([18_500_000, 25_000_000, 15_000_000], $debitNotes->pluck('total_amount')->all());
        $this->assertTrue($debitNotes->every(fn (Invoice $dn) => $dn->items->every('is_tax_deposit') && $dn->ppn_amount === 0 && $dn->pph_rate === null));
        $this->assertSame('3.000', $debitNotes[2]->items->first()->quantity);
    }

    public function test_bisa_dijalankan_ulang_dan_bersama_mitra_group_dan_contoh_mkb(): void
    {
        $this->seed(MitraGroupSeeder::class);
        $this->seed(ContohInvoiceAoeSeeder::class);
        $this->seed(ContohInvoiceAoeSeeder::class);
        $this->seed(ContohInvoiceMkbSeeder::class);

        // AOE & MKB sudah dibuat MitraGroupSeeder: tidak diprovisioning ulang.
        Event::assertDispatchedTimes(TenantCreated::class, 10);
        // Suite ini satu database: 5 dokumen AOE + 6 dokumen MKB, masing-masing satu klien.
        $this->assertSame(11, Invoice::count());
        $this->assertSame(1, Client::where('name', 'PT. CONTOH DAYA SAMUDRA')->count());
        $this->assertSame(1, User::where('email', 'admin.aoe@mitragroup.id')->count());
        $this->assertSame([self::AOE], User::where('email', 'admin.aoe@mitragroup.id')->sole()->companies()->pluck('companies.id')->all());
    }
}
