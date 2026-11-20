<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Company;
use App\Models\CompanyProfile;
use App\Models\Invoice;
use App\Models\User;
use Carbon\Carbon;
use Database\Seeders\ContohInvoiceAoeSeeder;
use Database\Seeders\ContohInvoiceNaiSeeder;
use Database\Seeders\MitraGroupSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Stancl\Tenancy\Events\TenantCreated;
use Tests\TestCase;

class ContohInvoiceNaiSeederTest extends TestCase
{
    use RefreshDatabase;

    private const NAI = 'nusantara-armada-indonesia';

    protected function setUp(): void
    {
        parent::setUp();

        // Jangan buat database tenant sungguhan di test
        Event::fake([TenantCreated::class]);
        Storage::fake('public');
    }

    public function test_menyiapkan_nai_saja_dengan_akun_profil_dan_invoice_contoh(): void
    {
        $this->seed(ContohInvoiceNaiSeeder::class);

        $this->assertSame([self::NAI], Company::where('organization_id', Company::findOrFail(self::NAI)->organization_id)->pluck('id')->all());
        Event::assertDispatchedTimes(TenantCreated::class, 1);

        foreach (['admin.nai@mitragroup.id' => 'admin', 'staff.nai@mitragroup.id' => 'staff'] as $email => $role) {
            $user = User::where('email', $email)->firstOrFail();
            $this->assertSame([self::NAI], $user->companies()->pluck('companies.id')->all(), "{$email} hanya anggota NAI");
            $this->assertSame(ucfirst($role).' NAI', $user->name);

            setPermissionsTeamId(self::NAI);
            $this->assertTrue($user->unsetRelation('roles')->hasRole($role), "{$email} berperan {$role} di NAI");
        }

        $profile = CompanyProfile::current();
        $this->assertSame('PT. NUSANTARA ARMADA INDONESIA', $profile->name);
        $this->assertSame('NAI', $profile->abbreviation);
        $this->assertSame('{NO}/{PT}-{KLIEN}/{KODE}/{BLN_ROMAWI}/{THN}', $profile->invoice_number_format);
        $this->assertSame([], $profile->missingFields());
        $this->assertSame('Samarinda', $profile->signature_city);
        $this->assertSame('148-00-2312-8153', $profile->bank_accounts[0]['account_number']);
        $this->assertTrue($profile->foreign_currency_enabled);
        $this->assertFalse($profile->needsInvoiceReview());

        // Tanda tangan CONTOH digambar dengan Carlito-Bold dari folder NAI.
        $this->assertSame('images/contoh-ttd-stempel.png', $profile->signature_path);
        $this->assertStringStartsWith("\x89PNG", Storage::disk('public')->get($profile->signature_path));

        $this->assertSame(
            ['176/NAI-CAS/INV-FINAL/XI/2026', '177/NAI-CAS/INV-DEM/XI/2026', '178/NAI-CAS/INV/XI/2026'],
            Invoice::whereNotNull('invoice_number')->orderBy('invoice_number')->pluck('invoice_number')->all(),
        );
        $this->assertSame(1, Invoice::where('status', 'draft')->count());
        $this->assertSame([176, 177, 178], Invoice::whereNotNull('invoice_number')->orderBy('invoice_number')->pluck('invoice_sequence')->all());
        $this->assertSame('179/NAI-CAS/INV-FINAL/XI/2026', Invoice::generateInvoiceNumber(Carbon::parse('2026-11-18'), Client::where('name', 'PT. CONTOH ARMADA SAMUDRA')->value('id'), Invoice::TYPE_INVOICE, 'FINAL'));
        $this->assertSame(0, Invoice::where('document_type', Invoice::TYPE_DEBIT_NOTE)->count());

        // Invoice FINAL bertarif USD: 25.000 MT × $1,20 × 18.059 = 541.770.000, + PPN 59.594.700 − PPh 23 10.835.400.
        $final = Invoice::with('items')->where('invoice_number', '176/NAI-CAS/INV-FINAL/XI/2026')->sole();
        $this->assertSame('FINAL', $final->document_code);
        $this->assertSame('18059.00', $final->exchange_rate);
        $this->assertSame(Invoice::CURRENCY_IDR, $final->currency);
        $this->assertSame(541_770_000, (int) $final->subtotal);
        $this->assertSame(59_594_700, (int) $final->ppn_amount);
        $this->assertSame(10_835_400, (int) $final->pph_amount);
        $this->assertSame(590_529_300, (int) $final->total_amount);

        // Demurrage 3 hari & sewa alat berat: invoice biasa (pendapatan), dipotong PPh 23.
        $this->assertSame(12_262_500, Invoice::where('invoice_number', '177/NAI-CAS/INV-DEM/XI/2026')->value('total_amount'));
        $this->assertSame(163_500_000, Invoice::where('invoice_number', '178/NAI-CAS/INV/XI/2026')->value('total_amount'));
    }

    public function test_bisa_dijalankan_ulang_dan_bersama_mitra_group_dan_contoh_aoe(): void
    {
        $this->seed(MitraGroupSeeder::class);
        $this->seed(ContohInvoiceNaiSeeder::class);
        $this->seed(ContohInvoiceNaiSeeder::class);
        $this->seed(ContohInvoiceAoeSeeder::class);

        // NAI & AOE sudah dibuat MitraGroupSeeder: tidak diprovisioning ulang.
        Event::assertDispatchedTimes(TenantCreated::class, 10);
        // Suite ini satu database: 4 dokumen NAI + 5 dokumen AOE, masing-masing satu klien.
        $this->assertSame(9, Invoice::count());
        $this->assertSame(1, Client::where('name', 'PT. CONTOH ARMADA SAMUDRA')->count());
        $this->assertSame(1, User::where('email', 'admin.nai@mitragroup.id')->count());
        $this->assertSame([self::NAI], User::where('email', 'admin.nai@mitragroup.id')->sole()->companies()->pluck('companies.id')->all());
    }
}
