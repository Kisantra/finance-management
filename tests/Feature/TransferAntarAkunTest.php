<?php

namespace Tests\Feature;

use App\Mcp\Servers\KeuanganServer;
use App\Mcp\Tools\RingkasanKeuangan;
use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\TransactionCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Mcp\Server\Testing\TestResponse;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Transfer antar akun sendiri di angka Pemasukan/Pengeluaran tingkat perusahaan (QA K-02,
 * docs/module/dashboard.md › Transfer antar akun sendiri): uang yang hanya pindah akun bukan
 * pemasukan maupun pengeluaran, biaya admin transfer tetap pengeluaran, dan angka satu rekening
 * tetap menghitung transfer sebagai uang masuk/keluar rekening itu.
 *
 * Angka yang diharapkan dihitung tangan dari data uji. "Hari ini" dipatok 15 November 2026, jadi
 * "bulan ini" = November dan grafik bulanan = Jun–Nov (indeks 5 = November).
 */
class TransferAntarAkunTest extends TestCase
{
    use RefreshDatabase;

    /** @var list<string> */
    private const IZIN = [
        'view dashboard', 'view bank-accounts', 'create transfer', 'create income', 'create expense', 'use claude',
    ];

    private User $admin;

    private BankAccount $bca;

    private BankAccount $kas;

    private TransactionCategory $antarRekening;

    private TransactionCategory $atk;

    protected function setUp(): void
    {
        parent::setUp();

        $this->travelTo(Carbon::parse('2026-11-15 10:00:00'));

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
        setPermissionsTeamId(null);
        foreach (self::IZIN as $izin) {
            Permission::firstOrCreate(['name' => $izin]);
        }
        Role::firstOrCreate(['name' => 'admin'])->syncPermissions(self::IZIN);
        setPermissionsTeamId(self::TEST_COMPANY);

        $this->admin = User::factory()->create();
        $this->admin->companies()->syncWithoutDetaching([self::TEST_COMPANY]);
        $this->admin->assignRole('admin');

        $this->bca = BankAccount::factory()->create(['account_name' => 'Operasional', 'bank_name' => 'BCA', 'initial_balance' => 10_000_000]);
        $this->kas = BankAccount::factory()->cash(cashLimit: 3_000_000)->create(['account_name' => 'Kas Kecil Kantor', 'initial_balance' => 500_000]);

        $this->antarRekening = $this->kategori('Antar Rekening Sendiri', 'transfer', $this->kategori('Transfer Internal', 'transfer'));
        $this->atk = $this->kategori('ATK', 'expense', $this->kategori('Beban Administrasi & Umum', 'expense'));
    }

    public function test_isi_ulang_kas_bukan_pemasukan_maupun_pengeluaran_tetapi_biaya_admin_tetap_pengeluaran(): void
    {
        $this->isiUlang(2_500_000, 6_500, '2026-11-10');
        $this->transaksi($this->bca, 'debit', 300_000, '2026-11-11', $this->atk);
        $this->bayar($this->bca, 1_000_000, '2026-11-12');

        // Transfer lewat endpoint aslinya: debit sumber 2.506.500 (jumlah + biaya admin) dan kredit kas 2.500.000.
        $this->assertSame(
            [['debit', 2_506_500], ['credit', 2_500_000]],
            BankTransaction::query()->whereNotNull('transfer_group_id')->orderBy('id')->get()
                ->map(fn (BankTransaction $kaki): array => [$kaki->transaction_type, $kaki->amount])->all(),
        );

        $this->dashboard()->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('stats.income_this_month', 1_000_000)
            ->where('stats.expenses_this_month', 306_500)
            ->where('stats.net_this_month', 693_500)
            ->where('stats.total_balance', 11_193_500)
            ->where('stats.total_cash', 3_000_000)
            // Donat: yang dipindahkan tidak tampil; biaya admin tampil sebagai irisan sendiri.
            ->where('expensesByCategory', [
                ['name' => 'ATK', 'value' => 300_000],
                ['name' => 'Biaya admin transfer', 'value' => 6_500],
            ])
            ->where('incomeByCategory', [['name' => 'Pembayaran invoice', 'value' => 1_000_000]])
            ->where('cashFlowChart.account', null)
            ->where('cashFlowChart.income.5', 1_000_000)
            ->where('cashFlowChart.expenses.5', 306_500)
        );

        // Ringkasan Total di Kas & Bank (semua akun, semua waktu) memakai aturan yang sama.
        $this->actingAs($this->admin)->get('/bank-accounts')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('overallSummary.income', 1_000_000)
            ->where('overallSummary.expense', 306_500)
            ->where('overallSummary.total_balance', 11_193_500)
        );

        // Alat Claude ringkasan-keuangan melaporkan angka yang sama dengan kartu Arus Kas.
        $kas = $this->isi(KeuanganServer::actingAs($this->admin)->tool(RingkasanKeuangan::class, ['perusahaan' => self::TEST_COMPANY]))['kas'];
        $this->assertSame(
            ['uang_masuk' => 1_000_000, 'uang_keluar' => 306_500, 'arus_bersih' => 693_500],
            array_intersect_key($kas, array_flip(['uang_masuk', 'uang_keluar', 'arus_bersih'])),
        );
    }

    public function test_pasangan_transfer_warisan_tanpa_transfer_group_id_juga_tidak_dihitung(): void
    {
        // Transfer lama ('TRF'.time(), sebelum kolom transfer_group_id ada): hanya referensi yang sama.
        $this->transaksi($this->bca, 'debit', 1_002_500, '2026-11-05', $this->antarRekening, [
            'reference_number' => 'TRF1762300000', 'description' => 'Transfer + Admin Fee - Isi kas',
        ]);
        $this->transaksi($this->kas, 'credit', 1_000_000, '2026-11-05', $this->antarRekening, [
            'reference_number' => 'TRF1762300000', 'description' => 'Transfer masuk - Isi kas',
        ]);
        $this->assertSame(0, BankTransaction::query()->whereNotNull('transfer_group_id')->count());

        $this->dashboard()->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('stats.income_this_month', 0)
            ->where('stats.expenses_this_month', 2_500)
            ->where('expensesByCategory', [['name' => 'Biaya admin transfer', 'value' => 2_500]])
            ->where('incomeByCategory', [])
            ->where('cashFlowChart.income.5', 0)
            ->where('cashFlowChart.expenses.5', 2_500)
        );
    }

    public function test_angka_satu_rekening_tetap_menghitung_transfer(): void
    {
        $this->isiUlang(2_500_000, 6_500, '2026-11-10');
        $this->bayar($this->bca, 1_000_000, '2026-11-12');

        // Filter rekening di grafik Ringkasan: bagi kas, isi ulang memang uang masuk.
        $this->dashboard(['chart_account' => $this->kas->id])->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('cashFlowChart.account.id', $this->kas->id)
            ->where('cashFlowChart.income.5', 2_500_000)
            ->where('cashFlowChart.expenses.5', 0)
            // Angka bulan ini tetap tingkat perusahaan.
            ->where('stats.income_this_month', 1_000_000)
            ->where('stats.expenses_this_month', 6_500)
        );

        // Bagi rekening sumber, transfer + biaya admin memang uang keluar.
        $this->dashboard(['chart_account' => $this->bca->id])->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('cashFlowChart.income.5', 1_000_000)
            ->where('cashFlowChart.expenses.5', 2_506_500)
        );

        // Statistik & grafik per akun di halaman Kas & Bank juga tetap menghitungnya.
        $this->actingAs($this->admin)->get('/bank-accounts?account='.$this->kas->id)->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('detail.stats.total_income', 2_500_000)
            ->where('detail.stats.total_expense', 0)
            ->where('detail.chart_months.11.income', 2_500_000)
            ->where('overallSummary.income', 1_000_000)
            ->where('overallSummary.expense', 6_500)
        );
        $this->actingAs($this->admin)->get('/bank-accounts?account='.$this->bca->id)->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('detail.stats.total_expense', 2_506_500)
            ->where('detail.category_breakdown', [['name' => 'Antar Rekening Sendiri', 'total' => 2_506_500]])
        );
    }

    public function test_penyesuaian_dan_pendanaan_tetap_dihitung(): void
    {
        // Penyesuaian = kategori bertipe adjustment, satu kaki, perubahan saldo yang nyata.
        $penyesuaian = $this->kategori('Koreksi Saldo', 'adjustment', $this->kategori('Penyesuaian', 'adjustment'));
        $pinjamanMasuk = $this->kategori('Penerimaan Pinjaman', 'financing');

        $this->transaksi($this->kas, 'credit', 50_000, '2026-11-03', $penyesuaian);
        $this->transaksi($this->bca, 'debit', 20_000, '2026-11-04', $penyesuaian);
        $this->transaksi($this->bca, 'credit', 5_000_000, '2026-11-06', $pinjamanMasuk);
        $this->isiUlang(1_000_000, 0, '2026-11-07');

        $this->dashboard()->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('stats.income_this_month', 5_050_000)
            ->where('stats.expenses_this_month', 20_000)
            ->where('incomeByCategory', [
                ['name' => 'Penerimaan Pinjaman', 'value' => 5_000_000],
                ['name' => 'Koreksi Saldo', 'value' => 50_000],
            ])
            ->where('expensesByCategory', [['name' => 'Koreksi Saldo', 'value' => 20_000]])
        );
    }

    public function test_kaki_berkategori_transfer_tanpa_pasangan_tetap_uang_masuk_atau_keluar(): void
    {
        // Dialog Pemasukan/Pengeluaran ikut menawarkan kategori transfer, dan
        // StoreBankTransactionRequest menerimanya: baris satu kaki berkategori transfer bisa ada.
        $catat = fn (BankAccount $akun, string $tipe, int $jumlah, string $tanggal, string $keterangan) => $this->actingAs($this->admin)
            ->post('/bank-transactions', [
                'bank_account_id' => $akun->id,
                'category_id' => $this->antarRekening->id,
                'amount' => $jumlah,
                'transaction_date' => $tanggal,
                'transaction_type' => $tipe,
                'description' => $keterangan,
            ])->assertSessionHasNoErrors();

        // Transfer yang dicatat manual sebagai dua kaki di tanggal yang sama: tetap transfer.
        $catat($this->bca, 'debit', 100_000, '2026-11-07', 'Tarik tunai untuk kas');
        $catat($this->kas, 'credit', 100_000, '2026-11-07', 'Setor dari BCA');
        // Kaki keluar tanpa lawan: uang benar-benar keluar, bukan biaya admin.
        $catat($this->bca, 'debit', 75_000, '2026-11-08', 'Pindah ke rekening di luar aplikasi');
        // Kaki masuk tanpa lawan: uang benar-benar masuk, bukan pengurang pengeluaran.
        $catat($this->kas, 'credit', 40_000, '2026-11-09', 'Setoran tunai direktur');

        $this->dashboard()->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('stats.income_this_month', 40_000)
            ->where('stats.expenses_this_month', 75_000)
            ->where('expensesByCategory', [['name' => 'Antar Rekening Sendiri', 'value' => 75_000]])
            ->where('incomeByCategory', [['name' => 'Antar Rekening Sendiri', 'value' => 40_000]])
            ->where('cashFlowChart.income.5', 40_000)
            ->where('cashFlowChart.expenses.5', 75_000)
        );
    }

    /**
     * Invarian penerimaan: untuk semua akun, Pemasukan − Pengeluaran suatu periode = perubahan total
     * saldo dalam periode itu (saldo = saldo awal + pembayaran + kredit − debit, rumus yang tidak
     * diubah). Saldo pembanding dihitung langsung dari tabel di sini, bukan lewat kode yang diuji.
     */
    public function test_pemasukan_dikurangi_pengeluaran_sama_dengan_perubahan_total_saldo(): void
    {
        $jasa = $this->kategori('Jasa Konsultasi', 'income', $this->kategori('Pendapatan Usaha (Tanpa Invoice)', 'income'));
        $penyesuaian = $this->kategori('Koreksi Saldo', 'adjustment', $this->kategori('Penyesuaian', 'adjustment'));
        $pinjamanMasuk = $this->kategori('Penerimaan Pinjaman', 'financing');
        $mandiri = BankAccount::factory()->create(['account_name' => 'Cadangan', 'bank_name' => 'Mandiri', 'initial_balance' => 2_000_000]);

        // Oktober.
        $this->isiUlang(400_000, 2_500, '2026-10-20');
        $this->transaksi($this->bca, 'debit', 100_000, '2026-10-25', $this->atk);
        $this->bayar($mandiri, 700_000, '2026-10-28');

        // November: semua jenis baris sekaligus.
        $this->isiUlang(2_500_000, 6_500, '2026-11-02');
        $this->transfer($mandiri, $this->bca, 1_000_000, 2_500, '2026-11-03');
        $this->transaksi($this->bca, 'debit', 1_005_000, '2026-11-04', $this->antarRekening, ['reference_number' => 'TRF1762200000']);
        $this->transaksi($this->kas, 'credit', 1_000_000, '2026-11-04', $this->antarRekening, ['reference_number' => 'TRF1762200000']);
        $this->transaksi($this->bca, 'credit', 250_000, '2026-11-05', $jasa);
        $this->transaksi($this->bca, 'debit', 300_000, '2026-11-06', $this->atk);
        $this->bayar($this->bca, 1_000_000, '2026-11-07');
        $this->transaksi($this->kas, 'credit', 50_000, '2026-11-08', $penyesuaian);
        $this->transaksi($mandiri, 'debit', 20_000, '2026-11-08', $penyesuaian);
        $this->transaksi($mandiri, 'credit', 5_000_000, '2026-11-09', $pinjamanMasuk);
        $this->transaksi($this->kas, 'debit', 10_000, '2026-11-10', null);
        $this->transaksi($this->bca, 'debit', 75_000, '2026-11-11', $this->antarRekening);
        $this->transaksi($this->kas, 'credit', 40_000, '2026-11-12', $this->antarRekening);

        $saldoAwalTotal = (int) BankAccount::query()->sum('initial_balance');
        $saldoAwalOktober = $this->saldoSebelum('2026-10-01');
        $saldoAwalNovember = $this->saldoSebelum('2026-11-01');
        $saldoAkhir = $this->saldoSebelum('2026-12-01');
        $this->assertSame($saldoAwalTotal, $saldoAwalOktober, 'Data uji dimulai Oktober.');

        $halaman = $this->dashboard()->assertOk()->viewData('page')['props'];
        $stats = $halaman['stats'];
        $grafik = $halaman['cashFlowChart'];

        $this->assertSame($saldoAkhir, $stats['total_balance']);
        $this->assertSame($saldoAkhir - $saldoAwalNovember, $stats['income_this_month'] - $stats['expenses_this_month']);
        $this->assertGreaterThanOrEqual(0, $stats['income_this_month']);
        $this->assertGreaterThanOrEqual(0, $stats['expenses_this_month']);

        // Hitungan tangan November: masuk = 250.000 jasa + 1.000.000 invoice + 50.000 koreksi
        // + 5.000.000 pinjaman + 40.000 kaki transfer tanpa pasangan; keluar = 300.000 ATK + 20.000
        // koreksi + 10.000 tanpa kategori + 75.000 kaki tanpa pasangan + biaya admin 6.500 + 2.500 + 5.000.
        $this->assertSame(6_340_000, $stats['income_this_month']);
        $this->assertSame(419_000, $stats['expenses_this_month']);

        // Donat = angka kartu.
        $this->assertSame($stats['expenses_this_month'], array_sum(array_column($halaman['expensesByCategory'], 'value')));
        $this->assertSame($stats['income_this_month'], array_sum(array_column($halaman['incomeByCategory'], 'value')));

        // Grafik bulanan (Jun–Nov): tiap bucket = perubahan saldo bulan itu, November = kartu.
        $this->assertSame($saldoAwalNovember - $saldoAwalOktober, $grafik['income'][4] - $grafik['expenses'][4]);
        $this->assertSame($stats['income_this_month'], $grafik['income'][5]);
        $this->assertSame($stats['expenses_this_month'], $grafik['expenses'][5]);
        $this->assertSame($saldoAkhir - $saldoAwalTotal, array_sum($grafik['income']) - array_sum($grafik['expenses']));

        // Ringkasan Total Kas & Bank: semua waktu.
        $ringkasan = $this->actingAs($this->admin)->get('/bank-accounts')->assertOk()->viewData('page')['props']['overallSummary'];
        $this->assertSame($saldoAkhir - $saldoAwalTotal, $ringkasan['income'] - $ringkasan['expense']);

        // Alat Claude: periode bawaan = November.
        $kas = $this->isi(KeuanganServer::actingAs($this->admin)->tool(RingkasanKeuangan::class, ['perusahaan' => self::TEST_COMPANY]))['kas'];
        $this->assertSame($stats['income_this_month'], $kas['uang_masuk']);
        $this->assertSame($stats['expenses_this_month'], $kas['uang_keluar']);
        $this->assertSame($saldoAkhir - $saldoAwalNovember, $kas['arus_bersih']);
    }

    /**
     * @param  array<string, scalar>  $query
     */
    private function dashboard(array $query = []): \Illuminate\Testing\TestResponse
    {
        return $this->actingAs($this->admin)->get('/dashboard'.($query ? '?'.http_build_query($query) : ''));
    }

    /** Isi ulang kas kecil = transfer biasa lewat endpoint yang dipakai tombol Isi ulang. */
    private function isiUlang(int $jumlah, int $biayaAdmin, string $tanggal): void
    {
        $this->transfer($this->bca, $this->kas, $jumlah, $biayaAdmin, $tanggal);
    }

    private function transfer(BankAccount $asal, BankAccount $tujuan, int $jumlah, int $biayaAdmin, string $tanggal): void
    {
        $this->actingAs($this->admin)->post('/bank-transactions/transfer', [
            'from_account_id' => $asal->id,
            'to_account_id' => $tujuan->id,
            'category_id' => $this->antarRekening->id,
            'amount' => $jumlah,
            'admin_fee' => $biayaAdmin,
            'description' => 'Isi ulang '.$tujuan->account_name,
            'transfer_date' => $tanggal,
        ])->assertSessionHasNoErrors();
    }

    private function kategori(string $label, string $jenis, ?TransactionCategory $induk = null): TransactionCategory
    {
        return TransactionCategory::create(['label' => $label, 'type' => $jenis, 'parent_id' => $induk?->id]);
    }

    /**
     * @param  array<string, mixed>  $lain
     */
    private function transaksi(BankAccount $akun, string $tipe, int $jumlah, string $tanggal, ?TransactionCategory $kategori, array $lain = []): BankTransaction
    {
        return BankTransaction::factory()->create([
            'bank_account_id' => $akun->id,
            'transaction_type' => $tipe,
            'amount' => $jumlah,
            'transaction_date' => $tanggal,
            'category_id' => $kategori?->id,
            'description' => 'Transaksi uji',
            'reference_number' => null,
            ...$lain,
        ]);
    }

    private function bayar(BankAccount $akun, int $jumlah, string $tanggal): Payment
    {
        $invoice = Invoice::factory()->create([
            'billed_to_id' => Client::factory(),
            'status' => 'sent',
            'total_amount' => $jumlah * 2,
        ]);

        return Payment::factory()->create([
            'invoice_id' => $invoice->id,
            'bank_account_id' => $akun->id,
            'amount' => $jumlah,
            'payment_date' => $tanggal,
            'reference_number' => null,
        ]);
    }

    /** Total saldo semua akun sebelum tanggal itu, langsung dari tabel (rumus saldo BankAccount). */
    private function saldoSebelum(string $tanggal): int
    {
        return (int) BankAccount::query()->sum('initial_balance')
            + (int) Payment::query()->where('payment_date', '<', $tanggal)->sum('amount')
            + (int) BankTransaction::query()->where('transaction_type', 'credit')->where('transaction_date', '<', $tanggal)->sum('amount')
            - (int) BankTransaction::query()->where('transaction_type', 'debit')->where('transaction_date', '<', $tanggal)->sum('amount');
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
