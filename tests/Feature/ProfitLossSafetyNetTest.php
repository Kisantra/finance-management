<?php

namespace Tests\Feature;

use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\TransactionCategory;
use App\Services\ProfitLossService;
use Carbon\Carbon;
use Database\Seeders\TransactionCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Regresi BUG-PL-01 (QA 2026-08-19): transaksi yang arahnya tidak cocok dengan
 * tipe kategorinya (mis. credit berkategori expense) tidak masuk baris laporan
 * mana pun DAN tidak masuk bucket "belum diklasifikasi" — uangnya hilang
 * diam-diam dari Laporan Laba Rugi.
 *
 * Juga menguji bahwa kategori sistem bunga punya pl_group, sehingga bunga
 * pinjaman/piutang benar-benar mengisi baris Beban Lain / Pendapatan Lain.
 */
class ProfitLossSafetyNetTest extends TestCase
{
    use RefreshDatabase;

    private BankAccount $rekening;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(TransactionCategorySeeder::class);
        $this->rekening = BankAccount::factory()->create(['initial_balance' => 0]);
    }

    private function transaksi(string $arah, int $jumlah, TransactionCategory $kategori): void
    {
        BankTransaction::create([
            'bank_account_id' => $this->rekening->id,
            'category_id' => $kategori->id,
            'amount' => $jumlah,
            'transaction_date' => '2026-07-15',
            'transaction_type' => $arah,
            'description' => 'Uji '.$arah,
        ]);
    }

    private function laporan(): array
    {
        return app(ProfitLossService::class)->generate(
            Carbon::parse('2026-07-01')->startOfDay(),
            Carbon::parse('2026-07-31')->endOfDay(),
        );
    }

    public function test_transaksi_dengan_arah_tidak_cocok_tipe_kategori_masuk_bucket_unclassified(): void
    {
        $kategoriBeban = TransactionCategory::where('type', 'expense')
            ->whereNotNull('parent_id')->firstOrFail();
        $kategoriBeban->update(['pl_group' => 'opex']);

        // Credit (uang masuk) tetapi berkategori BEBAN — kesalahan input yang
        // sebelumnya lolos dari seluruh baris laporan tanpa jejak.
        $this->transaksi('credit', 333000, $kategoriBeban);

        $laporan = $this->laporan();

        $totalUnclassified = $laporan['unclassified']['income']['total']
            + $laporan['unclassified']['expense']['total'];

        $this->assertSame(
            333000,
            $totalUnclassified,
            'Transaksi salah-arah harus tertangkap bucket belum diklasifikasi, bukan hilang.'
        );
    }

    public function test_transaksi_yang_benar_tetap_tidak_masuk_bucket(): void
    {
        $kategoriBeban = TransactionCategory::where('type', 'expense')
            ->whereNotNull('parent_id')->firstOrFail();
        $kategoriBeban->update(['pl_group' => 'opex']);

        $this->transaksi('debit', 250000, $kategoriBeban);

        $laporan = $this->laporan();

        $this->assertSame(0, $laporan['unclassified']['expense']['total']);
        $this->assertSame(250000, $laporan['opex']['total']);
    }

    public function test_kategori_sistem_bunga_punya_pl_group(): void
    {
        $this->assertSame(
            'other_expense',
            TransactionCategory::findSystem('EXP-INTEREST')?->pl_group,
            'Beban bunga pinjaman harus mengisi baris Beban Lain.'
        );

        $this->assertSame(
            'other_income',
            TransactionCategory::findSystem('REV-INTEREST')?->pl_group,
            'Pendapatan bunga piutang harus mengisi baris Pendapatan Lain.'
        );
    }

    public function test_bunga_pinjaman_masuk_baris_beban_lain(): void
    {
        $this->transaksi('debit', 150000, TransactionCategory::findSystem('EXP-INTEREST'));

        $laporan = $this->laporan();

        $this->assertSame(150000, $laporan['other_expense']['total']);
        $this->assertSame(0, $laporan['unclassified']['expense']['total']);
    }
}
