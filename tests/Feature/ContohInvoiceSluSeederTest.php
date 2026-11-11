<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Company;
use App\Models\CompanyProfile;
use App\Models\Invoice;
use App\Models\User;
use Database\Seeders\ContohInvoiceSluSeeder;
use Database\Seeders\MitraGroupSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Stancl\Tenancy\Events\TenantCreated;
use Tests\TestCase;

class ContohInvoiceSluSeederTest extends TestCase
{
    use RefreshDatabase;

    private const SLU = 'samboja-laju-utama';

    protected function setUp(): void
    {
        parent::setUp();

        // Jangan buat database tenant sungguhan di test
        Event::fake([TenantCreated::class]);
        Storage::fake('public');
    }

    public function test_menyiapkan_slu_saja_dengan_akun_profil_dan_invoice_contoh(): void
    {
        $this->seed(ContohInvoiceSluSeeder::class);

        $this->assertSame([self::SLU], Company::where('organization_id', Company::findOrFail(self::SLU)->organization_id)->pluck('id')->all());
        Event::assertDispatchedTimes(TenantCreated::class, 1);

        foreach (['admin.slu@mitragroup.id' => 'admin', 'staff.slu@mitragroup.id' => 'staff'] as $email => $role) {
            $user = User::where('email', $email)->firstOrFail();
            $this->assertSame([self::SLU], $user->companies()->pluck('companies.id')->all(), "{$email} hanya anggota SLU");

            setPermissionsTeamId(self::SLU);
            $this->assertTrue($user->unsetRelation('roles')->hasRole($role), "{$email} berperan {$role} di SLU");
        }

        $profile = CompanyProfile::current();
        $this->assertSame('PT. SAMBOJA LAJU UTAMA', $profile->name);
        $this->assertSame('{NO}/{PT}-{KLIEN}/INV/{BLN_ROMAWI}/{THN}', $profile->invoice_number_format);
        $this->assertSame([], $profile->missingFields());
        $this->assertFalse($profile->needsInvoiceReview());

        // Tanda tangan CONTOH digambar seeder ke disk public perusahaan (bukan berkas asli di repo).
        $this->assertSame('images/contoh-ttd-stempel.png', $profile->signature_path);
        $this->assertStringStartsWith("\x89PNG", Storage::disk('public')->get($profile->signature_path));

        $this->assertSame(
            ['037/SLU-CBN/INV-FINAL/X/2026', '038/SLU-CBN/INV-DEM/X/2026', '039/SLU-CBN/INV-TKBM/X/2026'],
            Invoice::whereNotNull('invoice_number')->orderBy('invoice_number')->pluck('invoice_number')->all(),
        );
        $this->assertSame(1, Invoice::where('status', 'draft')->count());

        $final = Invoice::with('items')->where('invoice_number', '037/SLU-CBN/INV-FINAL/X/2026')->sole();
        $this->assertSame('Invoice FINAL MV. CONTOH JAYA', $final->subject);
        $this->assertSame(532_800_000, (int) $final->total_amount);
        $this->assertStringContainsString('Loading Port : Muara Jawa', $final->items->first()->description);

        $this->assertSame('Direktur Finance & Accounting', Client::where('name', 'PT. CONTOH BATUBARA NUSANTARA')->value('person_in_charge'));
    }

    public function test_bisa_dijalankan_ulang_dan_bersama_mitra_group_seeder(): void
    {
        $this->seed(MitraGroupSeeder::class);
        $this->seed(ContohInvoiceSluSeeder::class);
        $this->seed(ContohInvoiceSluSeeder::class);

        // SLU sudah dibuat MitraGroupSeeder: tidak diprovisioning ulang.
        Event::assertDispatchedTimes(TenantCreated::class, 10);
        $this->assertSame(4, Invoice::count());
        $this->assertSame(1, Client::where('name', 'PT. CONTOH BATUBARA NUSANTARA')->count());
        $this->assertSame(1, User::where('email', 'staff.slu@mitragroup.id')->count());
    }

    public function test_tidak_menimpa_tanda_tangan_yang_sudah_diunggah(): void
    {
        $this->seed(ContohInvoiceSluSeeder::class);
        CompanyProfile::current()->update(['signature_path' => 'images/pdf-signature-asli.png']);

        $this->seed(ContohInvoiceSluSeeder::class);

        $this->assertSame('images/pdf-signature-asli.png', CompanyProfile::current()->signature_path);
    }
}
