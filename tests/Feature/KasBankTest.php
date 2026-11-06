<?php

namespace Tests\Feature;

use App\Mcp\Servers\KeuanganServer;
use App\Mcp\Tools\RekeningBank;
use App\Mcp\Tools\RingkasanKeuangan;
use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Mcp\Server\Testing\TestResponse;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Jenis akun Kas & Bank: kas tunai / kas kecil di samping rekening bank, dengan penanggung jawab
 * dan plafon (docs/module/bank-accounts.md › Jenis akun Kas & Bank).
 */
class KasBankTest extends TestCase
{
    use RefreshDatabase;

    /** @var list<string> */
    private const IZIN = [
        'view bank-accounts', 'create bank-accounts', 'edit bank-accounts', 'delete bank-accounts',
        'view dashboard', 'use claude',
    ];

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
        setPermissionsTeamId(null);
        foreach (self::IZIN as $izin) {
            Permission::firstOrCreate(['name' => $izin]);
        }
        Role::firstOrCreate(['name' => 'admin'])->syncPermissions(self::IZIN);
        setPermissionsTeamId(self::TEST_COMPANY);

        $this->admin = User::factory()->create(['name' => 'Admin Uji']);
        $this->admin->companies()->syncWithoutDetaching([self::TEST_COMPANY]);
        $this->admin->assignRole('admin');
    }

    public function test_baris_lama_tanpa_jenis_tetap_rekening_bank(): void
    {
        // Baris yang sudah ada sebelum migrasi tidak mengisi kolom baru: nilai bawaan database berlaku.
        $id = DB::table('bank_accounts')->insertGetId([
            'account_name' => 'Rekening Lama',
            'account_number' => '1234567890',
            'bank_name' => 'BCA',
            'initial_balance' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $akun = BankAccount::findOrFail($id);

        $this->assertSame(BankAccount::TYPE_BANK, $akun->type);
        $this->assertFalse($akun->isCash());
        $this->assertNull($akun->custodian_id);
        $this->assertNull($akun->cash_limit);
        $this->assertSame(0, $akun->refillAmount());
    }

    public function test_kas_tanpa_nomor_dan_bank_diisi_tunai_dan_kode_kas(): void
    {
        $this->actingAs($this->admin)->post('/bank-accounts', [
            'type' => 'cash',
            'account_name' => 'Kas Kecil Kantor',
            'initial_balance' => 500_000,
        ])->assertSessionHasNoErrors()->assertRedirect();

        // Form kas mengirim kolom tersembunyi sebagai string kosong.
        $this->actingAs($this->admin)->post('/bank-accounts', [
            'type' => 'cash',
            'account_name' => 'Kas Proyek',
            'account_number' => '',
            'bank_name' => '',
            'initial_balance' => 0,
        ])->assertSessionHasNoErrors();

        $this->assertDatabaseHas('bank_accounts', [
            'account_name' => 'Kas Kecil Kantor', 'type' => 'cash', 'bank_name' => 'Tunai', 'account_number' => 'KAS-0001',
        ]);
        $this->assertDatabaseHas('bank_accounts', [
            'account_name' => 'Kas Proyek', 'type' => 'cash', 'bank_name' => 'Tunai', 'account_number' => 'KAS-0002',
        ]);
    }

    public function test_rekening_bank_tetap_wajib_nomor_dan_nama_bank(): void
    {
        $this->actingAs($this->admin)->post('/bank-accounts', [
            'type' => 'bank',
            'account_name' => 'BCA Operasional',
            'initial_balance' => 0,
        ])->assertSessionHasErrors([
            'account_number' => 'Nomor rekening wajib diisi untuk rekening bank.',
            'bank_name' => 'Nama bank wajib diisi untuk rekening bank.',
        ]);

        // Klien lama tanpa `type` tetap diperlakukan sebagai rekening bank.
        $this->actingAs($this->admin)->post('/bank-accounts', [
            'account_name' => 'BCA Operasional',
            'initial_balance' => 0,
        ])->assertSessionHasErrors(['account_number', 'bank_name']);

        $this->actingAs($this->admin)->post('/bank-accounts', [
            'type' => 'deposito',
            'account_name' => 'Deposito',
            'account_number' => '777',
            'bank_name' => 'BCA',
            'initial_balance' => 0,
        ])->assertSessionHasErrors(['type' => 'Jenis akun harus Bank atau Kas.']);

        $this->assertDatabaseCount('bank_accounts', 0);
    }

    public function test_penanggung_jawab_harus_anggota_perusahaan(): void
    {
        $orangLuar = User::factory()->create();
        $budi = $this->anggota('Budi Kasir');

        $this->actingAs($this->admin)->post('/bank-accounts', [
            'type' => 'cash',
            'account_name' => 'Kas Kecil',
            'initial_balance' => 0,
            'custodian_id' => $orangLuar->id,
        ])->assertSessionHasErrors(['custodian_id' => 'Penanggung jawab harus anggota perusahaan ini.']);

        $this->assertDatabaseCount('bank_accounts', 0);

        $this->actingAs($this->admin)->post('/bank-accounts', [
            'type' => 'cash',
            'account_name' => 'Kas Kecil',
            'initial_balance' => 0,
            'custodian_id' => $budi->id,
            'cash_limit' => 2_000_000,
        ])->assertSessionHasNoErrors();

        $this->assertDatabaseHas('bank_accounts', [
            'account_name' => 'Kas Kecil', 'custodian_id' => $budi->id, 'cash_limit' => 2_000_000,
        ]);
    }

    public function test_penanggung_jawab_dan_plafon_dibuang_untuk_rekening_bank(): void
    {
        $orangLuar = User::factory()->create();

        // Sisa isian kas di form (jenis diganti ke Bank) tidak divalidasi dan tidak disimpan.
        $this->actingAs($this->admin)->post('/bank-accounts', [
            'type' => 'bank',
            'account_name' => 'BCA Operasional',
            'account_number' => '1112223334',
            'bank_name' => 'BCA',
            'initial_balance' => 0,
            'custodian_id' => $orangLuar->id,
            'cash_limit' => 1_000_000,
        ])->assertSessionHasNoErrors();

        $this->assertDatabaseHas('bank_accounts', [
            'account_number' => '1112223334', 'type' => 'bank', 'custodian_id' => null, 'cash_limit' => null,
        ]);
    }

    public function test_edit_kas_mempertahankan_kode_dan_rekening_bisa_diubah_menjadi_kas(): void
    {
        $kas = BankAccount::factory()->cash(cashLimit: 1_000_000)->create(['account_name' => 'Kas Lama']);
        $this->assertSame('KAS-0001', $kas->account_number);
        $this->assertSame('Tunai', $kas->bank_name);

        // Form kas menyembunyikan nomor & bank lalu mengirimnya kosong: kode lama tidak diganti.
        $this->actingAs($this->admin)->put("/bank-accounts/{$kas->id}", [
            'type' => 'cash',
            'account_name' => 'Kas Kecil Kantor',
            'account_number' => '',
            'bank_name' => '',
            'initial_balance' => 100_000,
            'cash_limit' => 0,
        ])->assertSessionHasNoErrors();

        $kas->refresh();
        $this->assertSame('Kas Kecil Kantor', $kas->account_name);
        $this->assertSame('KAS-0001', $kas->account_number);
        $this->assertSame('Tunai', $kas->bank_name);
        $this->assertNull($kas->cash_limit, 'Plafon 0 berarti tanpa plafon.');

        // Rekening "CASH 0000" yang selama ini dipakai sebagai kas: jenisnya diubah tanpa kehilangan nomor.
        $palsu = BankAccount::factory()->create(['account_name' => 'CASH', 'account_number' => '0000', 'bank_name' => 'CASH']);

        $this->actingAs($this->admin)->put("/bank-accounts/{$palsu->id}", [
            'type' => 'cash',
            'account_name' => 'Kas Kecil Gudang',
            'account_number' => '',
            'bank_name' => '',
            'initial_balance' => 0,
        ])->assertSessionHasNoErrors();

        $palsu->refresh();
        $this->assertTrue($palsu->isCash());
        $this->assertSame('0000', $palsu->account_number);
        $this->assertSame('Tunai', $palsu->bank_name);

        // Kembali menjadi rekening bank: nomor & bank wajib lagi.
        $this->actingAs($this->admin)->put("/bank-accounts/{$palsu->id}", [
            'type' => 'bank',
            'account_name' => 'Kas Kecil Gudang',
            'account_number' => '',
            'bank_name' => '',
            'initial_balance' => 0,
        ])->assertSessionHasErrors(['account_number', 'bank_name']);
    }

    public function test_kas_terbaca_wajar_di_picker_rekening_modul_lain(): void
    {
        BankAccount::factory()->create(['account_name' => 'BCA Operasional', 'bank_name' => 'BCA']);
        BankAccount::factory()->cash()->create(['account_name' => 'Kas Kecil Kantor']);

        // Picker lintas modul (pembayaran invoice, dsb.) menyusun label "nama (bank)" tanpa tahu jenis akun.
        $this->actingAs($this->admin)->get('/api/bank-accounts')
            ->assertOk()
            ->assertJsonFragment(['label' => 'BCA Operasional (BCA)'])
            ->assertJsonFragment(['label' => 'Kas Kecil Kantor (Tunai)']);
    }

    public function test_halaman_memisahkan_total_kas_dan_bank_serta_kebutuhan_isi_ulang(): void
    {
        $budi = $this->anggota('Budi Kasir');
        BankAccount::factory()->create(['initial_balance' => 10_000_000]);
        $kas = BankAccount::factory()->cash(cashLimit: 2_000_000, custodianId: $budi->id)->create(['initial_balance' => 1_500_000]);
        BankTransaction::factory()->create([
            'bank_account_id' => $kas->id, 'transaction_type' => 'debit', 'amount' => 300_000, 'transaction_date' => now(),
        ]);

        $this->actingAs($this->admin)->get('/bank-accounts')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('overallSummary.total_balance', 11_200_000)
                ->where('overallSummary.total_bank', 10_000_000)
                ->where('overallSummary.total_cash', 1_200_000)
                ->where('accounts.0.type', 'bank')
                ->where('accounts.0.refill_amount', 0)
                ->where('accounts.1.type', 'cash')
                ->where('accounts.1.balance', 1_200_000)
                ->where('accounts.1.cash_limit', 2_000_000)
                ->where('accounts.1.refill_amount', 800_000)
                ->where('accounts.1.custodian_name', 'Budi Kasir')
                ->where('custodianOptions', fn ($opsi) => $opsi->pluck('label')->contains('Budi Kasir')));
    }

    public function test_ringkasan_memisahkan_total_kas_dan_bank(): void
    {
        BankAccount::factory()->create(['initial_balance' => 7_000_000]);
        BankAccount::factory()->cash()->create(['initial_balance' => 250_000]);

        $this->actingAs($this->admin)->get('/dashboard')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('stats.total_balance', 7_250_000)
                ->where('stats.total_bank', 7_000_000)
                ->where('stats.total_cash', 250_000)
                ->where('bankAccounts.0.type', 'bank')
                ->where('bankAccounts.1.type', 'cash'));
    }

    public function test_alat_claude_menyertakan_jenis_akun_dan_memisahkan_total(): void
    {
        $budi = $this->anggota('Budi Kasir');
        BankAccount::factory()->create(['account_name' => 'BCA Operasional', 'bank_name' => 'BCA', 'initial_balance' => 5_000_000]);
        BankAccount::factory()->cash(cashLimit: 1_000_000, custodianId: $budi->id)->create([
            'account_name' => 'Kas Kecil Kantor', 'initial_balance' => 400_000,
        ]);

        $rekening = $this->isi(KeuanganServer::actingAs($this->admin)->tool(RekeningBank::class, ['perusahaan' => self::TEST_COMPANY]));

        $this->assertSame(5_400_000, $rekening['total_saldo']);
        $this->assertSame(5_000_000, $rekening['total_bank']);
        $this->assertSame(400_000, $rekening['total_kas']);

        $perNama = collect($rekening['rekening'])->keyBy('nama');
        $this->assertSame(
            ['jenis' => 'bank', 'bank' => 'BCA', 'penanggung_jawab' => null, 'plafon' => null, 'kurang_dari_plafon' => null],
            Arr::only($perNama['BCA Operasional'], ['jenis', 'bank', 'penanggung_jawab', 'plafon', 'kurang_dari_plafon']),
        );
        $this->assertSame(
            ['jenis' => 'kas', 'bank' => 'Tunai', 'nomor' => 'KAS-0001', 'penanggung_jawab' => 'Budi Kasir', 'plafon' => 1_000_000, 'kurang_dari_plafon' => 600_000],
            Arr::only($perNama['Kas Kecil Kantor'], ['jenis', 'bank', 'nomor', 'penanggung_jawab', 'plafon', 'kurang_dari_plafon']),
        );

        $ringkasan = $this->isi(KeuanganServer::actingAs($this->admin)->tool(RingkasanKeuangan::class, ['perusahaan' => self::TEST_COMPANY]));

        $this->assertSame(
            ['total_saldo' => 5_400_000, 'total_bank' => 5_000_000, 'total_kas' => 400_000, 'jumlah_rekening' => 2],
            Arr::only($ringkasan['kas'], ['total_saldo', 'total_bank', 'total_kas', 'jumlah_rekening']),
        );
    }

    private function anggota(string $nama): User
    {
        $user = User::factory()->create(['name' => $nama]);
        $user->companies()->syncWithoutDetaching([self::TEST_COMPANY]);

        return $user;
    }

    /**
     * Isi JSON jawaban alat MCP (Response::json → satu konten teks).
     *
     * @return array<string, mixed>
     */
    private function isi(TestResponse $respons): array
    {
        $respons->assertOk();
        $mentah = (fn (): array => $this->response->toArray())->call($respons);

        return json_decode($mentah['result']['content'][0]['text'], true, 512, JSON_THROW_ON_ERROR);
    }
}
