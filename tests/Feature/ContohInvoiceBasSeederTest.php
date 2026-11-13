<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Company;
use App\Models\CompanyProfile;
use App\Models\Invoice;
use App\Models\User;
use Database\Seeders\ContohInvoiceBasSeeder;
use Database\Seeders\ContohInvoiceSluSeeder;
use Database\Seeders\MitraGroupSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Stancl\Tenancy\Events\TenantCreated;
use Tests\TestCase;

class ContohInvoiceBasSeederTest extends TestCase
{
    use RefreshDatabase;

    private const BAS = 'berkah-andalan-samboja';

    protected function setUp(): void
    {
        parent::setUp();

        // Jangan buat database tenant sungguhan di test
        Event::fake([TenantCreated::class]);
        Storage::fake('public');
    }

    public function test_menyiapkan_bas_saja_dengan_akun_profil_dan_invoice_contoh(): void
    {
        $this->seed(ContohInvoiceBasSeeder::class);

        $this->assertSame([self::BAS], Company::where('organization_id', Company::findOrFail(self::BAS)->organization_id)->pluck('id')->all());
        Event::assertDispatchedTimes(TenantCreated::class, 1);

        foreach (['admin.bas@mitragroup.id' => 'admin', 'staff.bas@mitragroup.id' => 'staff'] as $email => $role) {
            $user = User::where('email', $email)->firstOrFail();
            $this->assertSame([self::BAS], $user->companies()->pluck('companies.id')->all(), "{$email} hanya anggota BAS");
            $this->assertSame(ucfirst($role).' BAS', $user->name);

            setPermissionsTeamId(self::BAS);
            $this->assertTrue($user->unsetRelation('roles')->hasRole($role), "{$email} berperan {$role} di BAS");
        }

        $profile = CompanyProfile::current();
        $this->assertSame('PT. BERKAH ANDALAN SAMBOJA', $profile->name);
        $this->assertSame('BAS', $profile->abbreviation);
        $this->assertSame('{NO}/{PT}-{KLIEN}/INV/{BLN_ROMAWI}/{THN}', $profile->invoice_number_format);
        $this->assertSame([], $profile->missingFields());
        // Data yang tercetak di template invoice perusahaan.
        $this->assertSame('Samarinda', $profile->signature_city);
        $this->assertSame('148-00-23719878', $profile->bank_accounts[0]['account_number']);
        $this->assertFalse($profile->needsInvoiceReview());

        // Tanda tangan CONTOH digambar seeder (font dari folder template BAS), bukan berkas asli di repo.
        $this->assertSame('images/contoh-ttd-stempel.png', $profile->signature_path);
        $this->assertStringStartsWith("\x89PNG", Storage::disk('public')->get($profile->signature_path));

        $this->assertSame(
            ['012/BAS-CES/INV-FINAL/X/2026', '013/BAS-CES/INV-FINAL/X/2026'],
            Invoice::whereNotNull('invoice_number')->orderBy('invoice_number')->pluck('invoice_number')->all(),
        );
        $this->assertSame(1, Invoice::where('status', 'draft')->count());

        $final = Invoice::with('items')->where('invoice_number', '012/BAS-CES/INV-FINAL/X/2026')->sole();
        $this->assertSame('Invoice FINAL MV. CONTOH SAMUDRA', $final->subject);
        $this->assertSame(520_000_000, (int) $final->subtotal);
        $this->assertSame(57_200_000, (int) $final->ppn_amount);
        $this->assertSame(577_200_000, (int) $final->total_amount);
        $this->assertSame('Loading Port : Muara Jawa Anchorage (stevedoring)', $final->items->first()->description);

        $twoItems = Invoice::with('items')->where('invoice_number', '013/BAS-CES/INV-FINAL/X/2026')->sole();
        $this->assertSame(['MT', 'Day'], $twoItems->items->pluck('unit')->all());
        $this->assertSame(425_130_000, (int) $twoItems->total_amount);

        $this->assertSame('Direktur Finance & Accounting', Client::where('name', 'PT. CONTOH ENERGI SAMUDRA')->value('person_in_charge'));
    }

    public function test_bisa_dijalankan_ulang_dan_bersama_mitra_group_dan_contoh_slu(): void
    {
        $this->seed(MitraGroupSeeder::class);
        $this->seed(ContohInvoiceBasSeeder::class);
        $this->seed(ContohInvoiceBasSeeder::class);
        $this->seed(ContohInvoiceSluSeeder::class);

        // BAS & SLU sudah dibuat MitraGroupSeeder: tidak diprovisioning ulang.
        Event::assertDispatchedTimes(TenantCreated::class, 10);
        // Suite ini satu database: 3 invoice BAS + 4 invoice SLU, masing-masing satu klien.
        $this->assertSame(7, Invoice::count());
        $this->assertSame(1, Client::where('name', 'PT. CONTOH ENERGI SAMUDRA')->count());
        $this->assertSame(1, User::where('email', 'admin.bas@mitragroup.id')->count());
        $this->assertSame([self::BAS], User::where('email', 'admin.bas@mitragroup.id')->sole()->companies()->pluck('companies.id')->all());
    }

    public function test_tidak_menimpa_tanda_tangan_yang_sudah_diunggah(): void
    {
        $this->seed(ContohInvoiceBasSeeder::class);
        CompanyProfile::current()->update(['signature_path' => 'images/pdf-signature-asli.png']);

        $this->seed(ContohInvoiceBasSeeder::class);

        $this->assertSame('images/pdf-signature-asli.png', CompanyProfile::current()->signature_path);
    }
}
