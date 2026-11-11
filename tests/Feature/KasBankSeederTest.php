<?php

namespace Tests\Feature;

use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\User;
use Database\Seeders\BankAccountSeeder;
use Database\Seeders\KasBankSeeder;
use Database\Seeders\TransactionCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Data demo Kas & Bank (database/seeders/KasBankSeeder.php). "Hari ini" dipatok 9 November 2026:
 * bulan lalu = Oktober, bulan berjalan = November.
 */
class KasBankSeederTest extends TestCase
{
    use RefreshDatabase;

    private User $staff;

    private User $manager;

    protected function setUp(): void
    {
        parent::setUp();

        $this->travelTo(Carbon::parse('2026-11-09 10:00:00'));

        $this->staff = User::factory()->create(['email' => 'staff@gmail.com']);
        $this->manager = User::factory()->create(['email' => 'manager@gmail.com']);

        $this->seed([TransactionCategorySeeder::class, BankAccountSeeder::class]);
    }

    public function test_membuat_dua_akun_kas_dengan_penanggung_jawab_plafon_dan_saldo(): void
    {
        $this->seed(KasBankSeeder::class);

        $kantor = BankAccount::where('account_name', 'Kas Kecil Kantor')->firstOrFail();
        $this->assertTrue($kantor->isCash());
        $this->assertSame('Tunai', $kantor->bank_name);
        $this->assertStringStartsWith('KAS-', $kantor->account_number);
        $this->assertSame($this->staff->id, $kantor->custodian_id);
        $this->assertSame(5_000_000, $kantor->cash_limit);
        $this->assertSame(2_825_000, $kantor->balance);
        $this->assertSame(2_175_000, $kantor->refillAmount());

        $proyek = BankAccount::where('account_name', 'Kas Tunai Proyek')->firstOrFail();
        $this->assertTrue($proyek->isCash());
        $this->assertSame($this->manager->id, $proyek->custodian_id);
        $this->assertNull($proyek->cash_limit);
        $this->assertSame(6_000_000, $proyek->balance);
        $this->assertSame(0, $proyek->refillAmount());

        $this->assertSame(
            $this->staff->id,
            BankTransaction::where('bank_account_id', $kantor->id)->where('transaction_type', 'debit')->value('created_by')
        );
    }

    public function test_setiap_transaksi_memakai_sub_kategori_template(): void
    {
        $this->seed(KasBankSeeder::class);

        $transaksi = BankTransaction::whereIn('bank_account_id', BankAccount::where('type', BankAccount::TYPE_CASH)->pluck('id'))
            ->with('category')
            ->get();

        $this->assertCount(12, $transaksi);
        foreach ($transaksi as $baris) {
            $this->assertNotNull($baris->category, "Transaksi \"{$baris->description}\" tanpa kategori: label tidak ada di template.");
            $this->assertNotNull($baris->category->parent_id);
        }
    }

    public function test_transfer_berpasangan_seperti_dialog_transfer_dan_tidak_melewati_hari_ini(): void
    {
        $this->seed(KasBankSeeder::class);

        $kelompok = BankTransaction::whereNotNull('transfer_group_id')->get()->groupBy('transfer_group_id');
        $this->assertCount(4, $kelompok);

        foreach ($kelompok as $kaki) {
            $debit = $kaki->firstWhere('transaction_type', 'debit');
            $kredit = $kaki->firstWhere('transaction_type', 'credit');
            $this->assertCount(2, $kaki);
            $this->assertSame($debit->reference_number, $kredit->reference_number);
            $this->assertStringStartsWith('TRF', $debit->reference_number);
            $this->assertGreaterThan($kredit->amount, $debit->amount);
        }

        $this->assertSame(32_500_000, BankTransaction::internalTransferTotal());
        $this->assertSame(0, BankTransaction::where('transaction_date', '>', today())->count());
        $this->assertSame(
            17_500_000,
            BankTransaction::internalTransferTotal(now()->startOfMonth(), now()->endOfDay())
        );
    }

    public function test_dilewati_bila_sudah_ada_akun_kas(): void
    {
        $this->seed(KasBankSeeder::class);
        $jumlahTransaksi = BankTransaction::count();

        $this->seed(KasBankSeeder::class);

        $this->assertSame(2, BankAccount::where('type', BankAccount::TYPE_CASH)->count());
        $this->assertSame($jumlahTransaksi, BankTransaction::count());
    }

    public function test_tanpa_pengguna_demo_penanggung_jawab_kosong(): void
    {
        User::query()->whereIn('email', ['staff@gmail.com', 'manager@gmail.com'])->delete();

        $this->seed(KasBankSeeder::class);

        $this->assertSame(0, BankAccount::where('type', BankAccount::TYPE_CASH)->whereNotNull('custodian_id')->count());
        $this->assertSame(2, BankAccount::where('type', BankAccount::TYPE_CASH)->count());
    }
}
