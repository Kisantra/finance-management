<?php

namespace Tests\Feature;

use App\Models\BankAccount;
use App\Models\TransactionCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Accessor `balance` menjalankan TIGA query agregat per rekening bila relasinya belum
 * dimuat, dan `$appends = ['balance']` memanggilnya di setiap serialisasi. Dashboard
 * memanggil `BankAccount::all()->sum(fn ($a) => $a->balance)` dua kali, ditambah sekali
 * lagi untuk daftar rekening — jadi 3 x (1 + 3N) query hanya untuk saldo.
 *
 * Scope `withBalance()` menghitung ketiganya sebagai subquery skalar dalam SATU statement.
 */
class BankAccountBalanceQueryTest extends TestCase
{
    use RefreshDatabase;

    /** @return list<BankAccount> */
    private function seedAccounts(int $jumlah): array
    {
        $kategori = TransactionCategory::create(['type' => 'income', 'label' => 'Pendapatan']);
        $accounts = [];

        foreach (range(1, $jumlah) as $i) {
            $account = BankAccount::factory()->create(['initial_balance' => 1_000_000 * $i]);

            $account->transactions()->create([
                'category_id' => $kategori->id,
                'amount' => 500_000,
                'transaction_date' => '2026-03-01',
                'transaction_type' => 'credit',
                'description' => 'Masuk',
            ]);
            $account->transactions()->create([
                'category_id' => $kategori->id,
                'amount' => 200_000,
                'transaction_date' => '2026-03-02',
                'transaction_type' => 'debit',
                'description' => 'Keluar',
            ]);

            $accounts[] = $account;
        }

        return $accounts;
    }

    public function test_with_balance_menghasilkan_saldo_yang_sama_dengan_accessor(): void
    {
        $this->seedAccounts(3);

        $lewatAccessor = BankAccount::orderBy('id')->get()->map(fn ($a) => $a->balance)->all();
        $lewatScope = BankAccount::withBalance()->orderBy('id')->get()->map(fn ($a) => $a->balance)->all();

        $this->assertSame($lewatAccessor, $lewatScope);
        $this->assertSame([1_300_000, 2_300_000, 3_300_000], $lewatScope);
    }

    public function test_with_balance_hanya_satu_query_berapa_pun_jumlah_rekeningnya(): void
    {
        $this->seedAccounts(5);

        DB::flushQueryLog();
        DB::enableQueryLog();
        $saldo = BankAccount::withBalance()->get()->sum(fn ($a) => $a->balance);
        $jumlahQuery = count(DB::getQueryLog());
        DB::disableQueryLog();

        // saldo awal 1+2+3+4+5 juta, tiap rekening +500rb kredit −200rb debit
        $this->assertSame(15_000_000 + (5 * 300_000), $saldo);
        $this->assertSame(1, $jumlahQuery, 'withBalance() harus cukup satu query, bukan 1 + 3N');
    }

    public function test_tanpa_scope_tetap_benar_walau_boros_query(): void
    {
        $this->seedAccounts(2);

        // Jalur lama tetap harus bekerja: kode yang belum memakai scope tidak boleh pecah.
        $this->assertSame(3_600_000, BankAccount::all()->sum(fn ($a) => $a->balance));
    }

    public function test_serialisasi_rekening_ber_scope_tidak_menambah_query(): void
    {
        $this->seedAccounts(3);

        $accounts = BankAccount::withBalance()->get();

        DB::flushQueryLog();
        DB::enableQueryLog();
        $json = $accounts->toJson();
        $jumlahQuery = count(DB::getQueryLog());
        DB::disableQueryLog();

        $this->assertSame(0, $jumlahQuery, '$appends tidak boleh memicu query bila saldo sudah dihitung');
        $this->assertStringContainsString('"balance":1300000', $json);
    }
}
