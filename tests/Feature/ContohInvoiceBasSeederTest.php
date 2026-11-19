<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Company;
use App\Models\CompanyProfile;
use App\Models\Invoice;
use App\Models\User;
use Carbon\Carbon;
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
        $this->assertSame('{NO}/{PT}-{KLIEN}/{KODE}/{BLN_ROMAWI}/{THN}', $profile->invoice_number_format);
        $this->assertSame([], $profile->missingFields());
        // Data yang tercetak di template invoice perusahaan.
        $this->assertSame('Samarinda', $profile->signature_city);
        $this->assertSame('148-00-23719878', $profile->bank_accounts[0]['account_number']);
        $this->assertFalse($profile->needsInvoiceReview());

        // Tanda tangan CONTOH digambar seeder (font dari folder template BAS), bukan berkas asli di repo.
        $this->assertSame('images/contoh-ttd-stempel.png', $profile->signature_path);
        $this->assertStringStartsWith("\x89PNG", Storage::disk('public')->get($profile->signature_path));

        $this->assertSame(
            [
                '012/BAS-CES/INV-FINAL/X/2026',
                '013/BAS-CES/INV-FINAL/X/2026',
                '014/BAS-CES/DN-PNBP/X/2026',
                '015/BAS-CES/DN-DEM/X/2026',
                '016/BAS-CES/DN-OPS/X/2026',
            ],
            Invoice::whereNotNull('invoice_number')->orderBy('invoice_number')->pluck('invoice_number')->all(),
        );
        $this->assertSame(1, Invoice::where('status', 'draft')->count());
        // Format {KODE} membaca urutan semua nomor contoh, jadi draft berikutnya melanjutkan 016.
        $this->assertSame([12, 13, 14, 15, 16], Invoice::whereNotNull('invoice_number')->orderBy('invoice_number')->pluck('invoice_sequence')->all());
        $this->assertSame('017/BAS-CES/INV-FINAL/XI/2026', Invoice::generateInvoiceNumber(Carbon::parse('2026-11-12'), Client::where('name', 'PT. CONTOH ENERGI SAMUDRA')->value('id'), Invoice::TYPE_INVOICE, 'FINAL'));

        $final = Invoice::with('items')->where('invoice_number', '012/BAS-CES/INV-FINAL/X/2026')->sole();
        $this->assertSame('Invoice FINAL MV. CONTOH SAMUDRA', $final->subject);
        $this->assertSame(520_000_000, (int) $final->subtotal);
        $this->assertSame(57_200_000, (int) $final->ppn_amount);
        // 520.000.000 + PPN 57.200.000 − PPh 23 0,5% 2.600.000.
        $this->assertSame(2_600_000, (int) $final->pph_amount);
        $this->assertSame(574_600_000, (int) $final->total_amount);
        $this->assertSame('Loading Port : Muara Jawa Anchorage (stevedoring)', $final->items->first()->description);

        $twoItems = Invoice::with('items')->where('invoice_number', '013/BAS-CES/INV-FINAL/X/2026')->sole();
        $this->assertSame(['MT', 'Day'], $twoItems->items->pluck('unit')->all());
        // 383.000.000 + PPN 42.130.000 − PPh 23 0,5% 1.915.000 (profil BAS memotong PPh 23).
        $this->assertSame(423_215_000, (int) $twoItems->total_amount);

        // Debit Note meniru dokumen Word BAS: talangan, tanpa PPN/PPh, total = yang dibayar BAS.
        $debitNotes = Invoice::with('items')->where('document_type', Invoice::TYPE_DEBIT_NOTE)->orderBy('invoice_number')->get();
        $this->assertSame(['PNBP', 'DEM', 'OPS'], $debitNotes->pluck('document_code')->all());
        $this->assertSame([12_500_000, 15_000_000, 30_000_000], $debitNotes->pluck('total_amount')->all());
        $this->assertTrue($debitNotes->every(fn (Invoice $dn) => $dn->items->every('is_tax_deposit') && $dn->ppn_amount === 0 && $dn->pph_rate === null));
        $this->assertSame(['FINAL', 'FINAL'], Invoice::where('document_type', Invoice::TYPE_INVOICE)->whereNotNull('invoice_number')->orderBy('invoice_number')->pluck('document_code')->all());
        $this->assertSame('3.000', $debitNotes[1]->items->first()->quantity);
        $this->assertSame('Day', $debitNotes[1]->items->first()->unit);

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
        // Suite ini satu database: 6 dokumen BAS + 5 dokumen SLU (termasuk Debit Note), masing-masing satu klien.
        $this->assertSame(11, Invoice::count());
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
