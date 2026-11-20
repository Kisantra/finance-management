<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Company;
use App\Models\CompanyProfile;
use App\Models\Invoice;
use App\Models\User;
use Carbon\Carbon;
use Database\Seeders\ContohInvoiceBasSeeder;
use Database\Seeders\ContohInvoiceMkbSeeder;
use Database\Seeders\MitraGroupSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Stancl\Tenancy\Events\TenantCreated;
use Tests\TestCase;

class ContohInvoiceMkbSeederTest extends TestCase
{
    use RefreshDatabase;

    private const MKB = 'mitra-kellian-baruna';

    protected function setUp(): void
    {
        parent::setUp();

        // Jangan buat database tenant sungguhan di test
        Event::fake([TenantCreated::class]);
        Storage::fake('public');
    }

    public function test_menyiapkan_mkb_saja_dengan_akun_profil_dan_invoice_contoh(): void
    {
        $this->seed(ContohInvoiceMkbSeeder::class);

        $this->assertSame([self::MKB], Company::where('organization_id', Company::findOrFail(self::MKB)->organization_id)->pluck('id')->all());
        Event::assertDispatchedTimes(TenantCreated::class, 1);

        foreach (['admin.mkb@mitragroup.id' => 'admin', 'staff.mkb@mitragroup.id' => 'staff'] as $email => $role) {
            $user = User::where('email', $email)->firstOrFail();
            $this->assertSame([self::MKB], $user->companies()->pluck('companies.id')->all(), "{$email} hanya anggota MKB");
            $this->assertSame(ucfirst($role).' MKB', $user->name);

            setPermissionsTeamId(self::MKB);
            $this->assertTrue($user->unsetRelation('roles')->hasRole($role), "{$email} berperan {$role} di MKB");
        }

        $profile = CompanyProfile::current();
        $this->assertSame('PT. MITRA KELLIAN BARUNA', $profile->name);
        $this->assertSame('MKB', $profile->abbreviation);
        $this->assertSame('{NO}/{PT}-{KLIEN}/{KODE}/{BLN_ROMAWI}/{THN}', $profile->invoice_number_format);
        $this->assertSame([], $profile->missingFields());
        $this->assertSame('Samarinda', $profile->signature_city);
        $this->assertSame('148-000-204198-9', $profile->bank_accounts[0]['account_number']);
        $this->assertFalse($profile->needsInvoiceReview());

        // Template MKB tidak memakai Carlito: tanda tangan CONTOH digambar dengan Tinos-Bold dari folder MKB.
        $this->assertSame('images/contoh-ttd-stempel.png', $profile->signature_path);
        $this->assertStringStartsWith("\x89PNG", Storage::disk('public')->get($profile->signature_path));

        $this->assertSame(
            [
                '046/MKB-CTB/INV-FINAL/X/2026',
                '047/MKB-CTB/INV-MOORING/X/2026',
                '048/MKB-CTB/INV-FENDER/X/2026',
                '049/MKB-CTB/DN-OT/X/2026',
                '050/MKB-CTB/DN-DEM/X/2026',
            ],
            Invoice::whereNotNull('invoice_number')->orderBy('invoice_number')->pluck('invoice_number')->all(),
        );
        $this->assertSame(1, Invoice::where('status', 'draft')->count());
        $this->assertSame([46, 47, 48, 49, 50], Invoice::whereNotNull('invoice_number')->orderBy('invoice_number')->pluck('invoice_sequence')->all());
        $this->assertSame('051/MKB-CTB/INV-FINAL/XI/2026', Invoice::generateInvoiceNumber(Carbon::parse('2026-11-12'), Client::where('name', 'PT. CONTOH TAMBANG BERSAUDARA')->value('id'), Invoice::TYPE_INVOICE, 'FINAL'));

        $final = Invoice::with('items')->where('invoice_number', '046/MKB-CTB/INV-FINAL/X/2026')->sole();
        $this->assertSame('Invoice FINAL MV. CONTOH HARMONY', $final->subject);
        // 675.000.000 + PPN 74.250.000 − PPh 23 2% 13.500.000.
        $this->assertSame(675_000_000, (int) $final->subtotal);
        $this->assertSame(74_250_000, (int) $final->ppn_amount);
        $this->assertSame(13_500_000, (int) $final->pph_amount);
        $this->assertSame(735_750_000, (int) $final->total_amount);
        $this->assertSame(['FINAL', 'MOORING', 'FENDER'], Invoice::where('document_type', Invoice::TYPE_INVOICE)->whereNotNull('invoice_number')->orderBy('invoice_number')->pluck('document_code')->all());

        // Debit Note: talangan, tanpa PPN/PPh, total = yang dibayar MKB.
        $debitNotes = Invoice::with('items')->where('document_type', Invoice::TYPE_DEBIT_NOTE)->orderBy('invoice_number')->get();
        $this->assertSame(['OT', 'DEM'], $debitNotes->pluck('document_code')->all());
        $this->assertSame([12_000_000, 15_000_000], $debitNotes->pluck('total_amount')->all());
        $this->assertTrue($debitNotes->every(fn (Invoice $dn) => $dn->items->every('is_tax_deposit') && $dn->ppn_amount === 0 && $dn->pph_rate === null));
        $this->assertSame('3.000', $debitNotes[1]->items->first()->quantity);
    }

    public function test_bisa_dijalankan_ulang_dan_bersama_mitra_group_dan_contoh_bas(): void
    {
        $this->seed(MitraGroupSeeder::class);
        $this->seed(ContohInvoiceMkbSeeder::class);
        $this->seed(ContohInvoiceMkbSeeder::class);
        $this->seed(ContohInvoiceBasSeeder::class);

        // MKB & BAS sudah dibuat MitraGroupSeeder: tidak diprovisioning ulang.
        Event::assertDispatchedTimes(TenantCreated::class, 10);
        // Suite ini satu database: 6 dokumen MKB + 6 dokumen BAS, masing-masing satu klien.
        $this->assertSame(12, Invoice::count());
        $this->assertSame(1, Client::where('name', 'PT. CONTOH TAMBANG BERSAUDARA')->count());
        $this->assertSame(1, User::where('email', 'admin.mkb@mitragroup.id')->count());
        $this->assertSame([self::MKB], User::where('email', 'admin.mkb@mitragroup.id')->sole()->companies()->pluck('companies.id')->all());
    }
}
