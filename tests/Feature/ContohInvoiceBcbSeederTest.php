<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Company;
use App\Models\CompanyProfile;
use App\Models\Invoice;
use App\Models\User;
use Carbon\Carbon;
use Database\Seeders\ContohInvoiceBcbSeeder;
use Database\Seeders\ContohInvoiceMkbSeeder;
use Database\Seeders\MitraGroupSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Stancl\Tenancy\Events\TenantCreated;
use Tests\TestCase;

class ContohInvoiceBcbSeederTest extends TestCase
{
    use RefreshDatabase;

    private const BCB = 'bahtera-cipta-bersama';

    protected function setUp(): void
    {
        parent::setUp();

        // Jangan buat database tenant sungguhan di test
        Event::fake([TenantCreated::class]);
        Storage::fake('public');
    }

    public function test_menyiapkan_bcb_saja_dengan_akun_profil_dan_invoice_contoh(): void
    {
        $this->seed(ContohInvoiceBcbSeeder::class);

        $this->assertSame([self::BCB], Company::where('organization_id', Company::findOrFail(self::BCB)->organization_id)->pluck('id')->all());
        Event::assertDispatchedTimes(TenantCreated::class, 1);

        foreach (['admin.bcb@mitragroup.id' => 'admin', 'staff.bcb@mitragroup.id' => 'staff'] as $email => $role) {
            $user = User::where('email', $email)->firstOrFail();
            $this->assertSame([self::BCB], $user->companies()->pluck('companies.id')->all(), "{$email} hanya anggota BCB");
            $this->assertSame(ucfirst($role).' BCB', $user->name);

            setPermissionsTeamId(self::BCB);
            $this->assertTrue($user->unsetRelation('roles')->hasRole($role), "{$email} berperan {$role} di BCB");
        }

        $profile = CompanyProfile::current();
        $this->assertSame('PT. BAHTERA CIPTA BERSAMA', $profile->name);
        $this->assertSame('BCB', $profile->abbreviation);
        $this->assertSame('{NO}/{PT}-{KLIEN}/{KODE}/{BLN_ROMAWI}/{THN}', $profile->invoice_number_format);
        $this->assertSame([], $profile->missingFields());
        $this->assertSame('Samarinda', $profile->signature_city);
        $this->assertSame('148-00-2281085-0', $profile->bank_accounts[0]['account_number']);
        $this->assertFalse($profile->needsInvoiceReview());

        // Template BCB tidak memakai Carlito: tanda tangan CONTOH digambar dengan Tinos-Bold dari folder BCB.
        $this->assertSame('images/contoh-ttd-stempel.png', $profile->signature_path);
        $this->assertStringStartsWith("\x89PNG", Storage::disk('public')->get($profile->signature_path));

        $this->assertSame(
            [
                '100/BCB-CBS/INV-FINAL/XI/2026',
                '101/BCB-CBS/INV-MOORING/XI/2026',
                '102/BCB-CBS/INV-FENDER/XI/2026',
                '103/BCB-CBS/DN-OT/XI/2026',
                '104/BCB-CBS/DN-DEM/XI/2026',
                '105/BCB-CBS/DN-ORBIT/XI/2026',
                '106/BCB-CBS/DN-FINAL/XI/2026',
            ],
            Invoice::whereNotNull('invoice_number')->orderBy('invoice_number')->pluck('invoice_number')->all(),
        );
        $this->assertSame(1, Invoice::where('status', 'draft')->count());
        $this->assertSame([100, 101, 102, 103, 104, 105, 106], Invoice::whereNotNull('invoice_number')->orderBy('invoice_number')->pluck('invoice_sequence')->all());
        $this->assertSame('107/BCB-CBS/INV-FINAL/XI/2026', Invoice::generateInvoiceNumber(Carbon::parse('2026-11-19'), Client::where('name', 'PT. CONTOH BINA SAMUDRA')->value('id'), Invoice::TYPE_INVOICE, 'FINAL'));

        $final = Invoice::with('items')->where('invoice_number', '100/BCB-CBS/INV-FINAL/XI/2026')->sole();
        $this->assertSame('Invoice FINAL MV. CONTOH GLORY', $final->subject);
        // 685.000.000 + PPN 75.350.000 − PPh 23 2% 13.700.000.
        $this->assertSame(685_000_000, (int) $final->subtotal);
        $this->assertSame(75_350_000, (int) $final->ppn_amount);
        $this->assertSame(13_700_000, (int) $final->pph_amount);
        $this->assertSame(746_650_000, (int) $final->total_amount);
        $this->assertSame(['FINAL', 'MOORING', 'FENDER'], Invoice::where('document_type', Invoice::TYPE_INVOICE)->whereNotNull('invoice_number')->orderBy('invoice_number')->pluck('document_code')->all());

        // Debit Note tagihan jasa dalam USD: 50.000 MT × $0,82 × 18.250 = Rp 748.250.000, utang $41.000,00, tanpa
        // PPN/PPh, dan pendapatan (bukan talangan); rekening USD tercetak.
        $usd = Invoice::with('items')->where('invoice_number', '105/BCB-CBS/DN-ORBIT/XI/2026')->sole();
        $this->assertTrue($usd->isDebitNote());
        $this->assertFalse($usd->isPassThrough());
        $this->assertFalse($usd->items->first()->is_tax_deposit);
        $this->assertSame(748_250_000, $usd->gross_profit);
        $this->assertSame('USD', $usd->currency);
        $this->assertSame(748_250_000, $usd->total_amount);
        $this->assertSame('41000.00', $usd->total_foreign);
        $this->assertSame('0.8200', $usd->items->first()->foreign_unit_price);
        $this->assertTrue($profile->foreign_currency_enabled);
        $this->assertSame('USD', $profile->bank_accounts[1]['currency']);

        // FINAL: sisa tagihan (pendapatan) + WHT 23 2% dari nilai final penuh sebagai baris titipan pajak.
        $final = Invoice::with('items')->where('invoice_number', '106/BCB-CBS/DN-FINAL/XI/2026')->sole();
        $this->assertFalse($final->isPassThrough());
        $this->assertSame([false, true], $final->items->pluck('is_tax_deposit')->all());
        $this->assertSame(26_413_225, $final->total_amount);
        $this->assertSame('1447.30', $final->total_foreign);
        $this->assertSame(0, $final->ppn_amount);
        $this->assertSame(11_223_750, $final->gross_profit);

        // Debit Note talangan: tanpa PPN/PPh, total = yang dibayar BCB.
        $debitNotes = Invoice::with('items')->where('document_type', Invoice::TYPE_DEBIT_NOTE)->where('is_pass_through', true)->orderBy('invoice_number')->get();
        $this->assertSame(['OT', 'DEM'], $debitNotes->pluck('document_code')->all());
        $this->assertSame([27_500_000, 15_000_000], $debitNotes->pluck('total_amount')->all());
        $this->assertTrue($debitNotes->every(fn (Invoice $dn) => $dn->items->every('is_tax_deposit') && $dn->ppn_amount === 0 && $dn->pph_rate === null));
        $this->assertSame('3.000', $debitNotes[1]->items->first()->quantity);
    }

    public function test_bisa_dijalankan_ulang_dan_bersama_mitra_group_dan_contoh_mkb(): void
    {
        $this->seed(MitraGroupSeeder::class);
        $this->seed(ContohInvoiceBcbSeeder::class);
        $this->seed(ContohInvoiceBcbSeeder::class);
        $this->seed(ContohInvoiceMkbSeeder::class);

        // BCB & MKB sudah dibuat MitraGroupSeeder: tidak diprovisioning ulang.
        Event::assertDispatchedTimes(TenantCreated::class, 10);
        // Suite ini satu database: 8 dokumen BCB + 6 dokumen MKB, masing-masing satu klien.
        $this->assertSame(14, Invoice::count());
        $this->assertSame(1, Client::where('name', 'PT. CONTOH BINA SAMUDRA')->count());
        $this->assertSame(1, User::where('email', 'admin.bcb@mitragroup.id')->count());
        $this->assertSame([self::BCB], User::where('email', 'admin.bcb@mitragroup.id')->sole()->companies()->pluck('companies.id')->all());
    }
}
