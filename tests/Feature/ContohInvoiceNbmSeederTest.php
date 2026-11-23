<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Company;
use App\Models\CompanyProfile;
use App\Models\Invoice;
use App\Models\User;
use Carbon\Carbon;
use Database\Seeders\ContohInvoiceAoeSeeder;
use Database\Seeders\ContohInvoiceNbmSeeder;
use Database\Seeders\MitraGroupSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Stancl\Tenancy\Events\TenantCreated;
use Tests\TestCase;

class ContohInvoiceNbmSeederTest extends TestCase
{
    use RefreshDatabase;

    private const NBM = 'namora-berlian-mahakam';

    protected function setUp(): void
    {
        parent::setUp();

        // Jangan buat database tenant sungguhan di test
        Event::fake([TenantCreated::class]);
        Storage::fake('public');
    }

    public function test_menyiapkan_nbm_saja_dengan_akun_profil_dan_invoice_contoh(): void
    {
        $this->seed(ContohInvoiceNbmSeeder::class);

        $this->assertSame([self::NBM], Company::where('organization_id', Company::findOrFail(self::NBM)->organization_id)->pluck('id')->all());
        Event::assertDispatchedTimes(TenantCreated::class, 1);

        foreach (['admin.nbm@mitragroup.id' => 'admin', 'staff.nbm@mitragroup.id' => 'staff'] as $email => $role) {
            $user = User::where('email', $email)->firstOrFail();
            $this->assertSame([self::NBM], $user->companies()->pluck('companies.id')->all(), "{$email} hanya anggota NBM");
            $this->assertSame(ucfirst($role).' NBM', $user->name);

            setPermissionsTeamId(self::NBM);
            $this->assertTrue($user->unsetRelation('roles')->hasRole($role), "{$email} berperan {$role} di NBM");
        }

        $profile = CompanyProfile::current();
        $this->assertSame('PT. NAMORA BERLIAN MAHAKAM', $profile->name);
        $this->assertSame('NBM', $profile->abbreviation);
        $this->assertSame('{NO}/{PT}-{KLIEN}/{KODE}/{BLN_ROMAWI}/{THN}', $profile->invoice_number_format);
        $this->assertSame([], $profile->missingFields());
        $this->assertSame('Samarinda', $profile->signature_city);
        $this->assertSame('Samarinda', $profile->bank_accounts[0]['branch']);
        $this->assertTrue((bool) $profile->debit_note_enabled);
        $this->assertFalse($profile->needsInvoiceReview());

        // Template NBM (salinan BCB) tidak memakai Carlito: tanda tangan CONTOH digambar dengan Tinos-Bold.
        $this->assertSame('images/contoh-ttd-stempel.png', $profile->signature_path);
        $this->assertStringStartsWith("\x89PNG", Storage::disk('public')->get($profile->signature_path));

        $this->assertSame(
            [
                '008/NBM-CPM/INV-FINAL/XI/2026',
                '009/NBM-CPM/INV-MOORING/XI/2026',
                '010/NBM-CPM/INV-FENDER/XI/2026',
                '011/NBM-CPM/DN-OT/XI/2026',
                '012/NBM-CPM/DN-DEM/XI/2026',
            ],
            Invoice::whereNotNull('invoice_number')->orderBy('invoice_number')->pluck('invoice_number')->all(),
        );
        $this->assertSame(1, Invoice::where('status', 'draft')->count());
        $this->assertSame([8, 9, 10, 11, 12], Invoice::whereNotNull('invoice_number')->orderBy('invoice_number')->pluck('invoice_sequence')->all());
        $this->assertSame('013/NBM-CPM/INV-FINAL/XI/2026', Invoice::generateInvoiceNumber(Carbon::parse('2026-11-18'), Client::where('name', 'PT. CONTOH PELABUHAN MAHAKAM')->value('id'), Invoice::TYPE_INVOICE, 'FINAL'));

        // FINAL bertarif USD: 50.000 MT × ($0,75 × kurs 17.813 = Rp 13.359,75) = 667.987.500 + PPN 73.478.625
        // − PPh 23 2% 13.359.750.
        $final = Invoice::with('items')->where('invoice_number', '008/NBM-CPM/INV-FINAL/XI/2026')->sole();
        $this->assertSame('FINAL', $final->document_code);
        $this->assertSame(17813.0, (float) $final->exchange_rate);
        $this->assertSame('13359.75', (string) $final->items->first()->unit_price);
        $this->assertSame(667_987_500, (int) $final->subtotal);
        $this->assertSame(73_478_625, (int) $final->ppn_amount);
        $this->assertSame(13_359_750, (int) $final->pph_amount);
        $this->assertSame(728_106_375, (int) $final->total_amount);
        $this->assertSame([21_800_000, 27_250_000], Invoice::whereIn('document_code', ['MOORING', 'FENDER'])->orderBy('invoice_number')->pluck('total_amount')->all());

        // Debit Note: talangan, tanpa PPN/PPh, total = yang dibayar NBM.
        $debitNotes = Invoice::with('items')->where('document_type', Invoice::TYPE_DEBIT_NOTE)->orderBy('invoice_number')->get();
        $this->assertSame(['OT', 'DEM'], $debitNotes->pluck('document_code')->all());
        $this->assertSame([25_000_000, 15_000_000], $debitNotes->pluck('total_amount')->all());
        $this->assertTrue($debitNotes->every(fn (Invoice $dn) => $dn->items->every('is_tax_deposit') && $dn->ppn_amount === 0 && $dn->pph_rate === null));
        $this->assertSame('3.000', $debitNotes[1]->items->first()->quantity);
    }

    public function test_bisa_dijalankan_ulang_dan_bersama_mitra_group_dan_contoh_aoe(): void
    {
        $this->seed(MitraGroupSeeder::class);
        $this->seed(ContohInvoiceNbmSeeder::class);
        $this->seed(ContohInvoiceNbmSeeder::class);
        $this->seed(ContohInvoiceAoeSeeder::class);

        // NBM & AOE sudah dibuat MitraGroupSeeder: tidak diprovisioning ulang.
        Event::assertDispatchedTimes(TenantCreated::class, 10);
        // Suite ini satu database: 6 dokumen NBM + 5 dokumen AOE, masing-masing satu klien.
        $this->assertSame(11, Invoice::count());
        $this->assertSame(1, Client::where('name', 'PT. CONTOH PELABUHAN MAHAKAM')->count());
        $this->assertSame(1, User::where('email', 'admin.nbm@mitragroup.id')->count());
        $this->assertSame([self::NBM], User::where('email', 'admin.nbm@mitragroup.id')->sole()->companies()->pluck('companies.id')->all());
    }
}
