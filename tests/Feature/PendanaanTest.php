<?php

namespace Tests\Feature;

use App\Exports\ArusKasExport;
use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Loan;
use App\Models\Payment;
use App\Models\Receivable;
use App\Models\TransactionCategory;
use App\Models\User;
use App\Services\CashFlowExportService;
use App\Services\ProfitLossService;
use Carbon\Carbon;
use Database\Seeders\TransactionCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Maatwebsite\Excel\Facades\Excel;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Pendanaan (Opsi A): kategori bertipe `financing` non-sistem bisa dicatat lewat Catat Pemasukan /
 * Catat Pengeluaran, tampil berpenanda di daftar Arus Kas, dirinci di kartu ringkasan & ekspor,
 * dan TIDAK menyentuh Laba Rugi. Pokok utang/piutang (kategori sistem) hanya-lihat di Arus Kas
 * dan Kas & Bank. Lihat docs/module/cash-flow.md › Pendanaan.
 */
class PendanaanTest extends TestCase
{
    use RefreshDatabase;

    private User $fm;

    private User $lihat;

    private BankAccount $bca;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(TransactionCategorySeeder::class);
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $izin = [
            'view income', 'view expense', 'create income', 'create expense', 'edit income', 'edit expense',
            'delete income', 'delete expense', 'view categories', 'view dashboard', 'view bank-accounts',
            'view loans', 'create loans', 'pay loans', 'delete loans',
            'view receivables', 'approve receivables', 'pay receivables',
        ];
        foreach ($izin as $nama) {
            Permission::firstOrCreate(['name' => $nama]);
        }

        $this->fm = User::factory()->create(['name' => 'Rina Keuangan']);
        $this->fm->givePermissionTo($izin);
        $this->lihat = User::factory()->create();
        $this->lihat->givePermissionTo(['view income', 'view expense', 'view categories']);

        $this->bca = BankAccount::factory()->create(['account_name' => 'BCA Operasional', 'bank_name' => 'BCA', 'initial_balance' => 50_000_000]);
    }

    private function sub(string $label): TransactionCategory
    {
        return TransactionCategory::where('label', $label)->whereNotNull('parent_id')->sole();
    }

    /** @return array<string, mixed> */
    private function payload(TransactionCategory $kategori, string $tipe, int $jumlah = 1_000_000, string $tanggal = '2026-11-10'): array
    {
        return [
            'bank_account_id' => $this->bca->id,
            'category_id' => $kategori->id,
            'amount' => $jumlah,
            'transaction_date' => $tanggal,
            'transaction_type' => $tipe,
            'description' => "Uji {$kategori->label}",
        ];
    }

    private function catat(TransactionCategory $kategori, string $tipe, int $jumlah, string $tanggal, string $keterangan): BankTransaction
    {
        return BankTransaction::factory()->create([
            'bank_account_id' => $this->bca->id,
            'category_id' => $kategori->id,
            'transaction_type' => $tipe,
            'amount' => $jumlah,
            'transaction_date' => $tanggal,
            'description' => $keterangan,
            'reference_number' => null,
            'created_by' => $this->fm->id,
        ]);
    }

    /* ─── Pencatatan & validasi ─────────────────────────────── */

    public function test_sub_pendanaan_non_sistem_diterima_untuk_pemasukan_dan_pengeluaran(): void
    {
        $saldoAwal = $this->bca->fresh()->balance;

        $this->actingAs($this->fm)->post('/bank-transactions', $this->payload($this->sub('Setoran Modal Pemilik'), 'credit', 25_000_000))
            ->assertSessionHasNoErrors()->assertRedirect();
        $this->actingAs($this->fm)->post('/bank-transactions', $this->payload($this->sub('Setor PPN'), 'debit', 3_300_000))
            ->assertSessionHasNoErrors()->assertRedirect();
        // Pendanaan tidak punya arah tetap: restitusi PPN masuk lewat kategori yang sama.
        $this->actingAs($this->fm)->post('/bank-transactions', $this->payload($this->sub('Setor PPN'), 'credit', 100_000))
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas('bank_transactions', ['category_id' => $this->sub('Setoran Modal Pemilik')->id, 'transaction_type' => 'credit', 'amount' => 25_000_000, 'created_by' => $this->fm->id]);
        $this->assertDatabaseHas('bank_transactions', ['category_id' => $this->sub('Setor PPN')->id, 'transaction_type' => 'debit', 'amount' => 3_300_000]);
        $this->assertSame($saldoAwal + 25_000_000 - 3_300_000 + 100_000, $this->bca->fresh()->balance);
    }

    public function test_kategori_sistem_induk_dan_induk_pendanaan_tanpa_anak_ditolak(): void
    {
        $sistem = TransactionCategory::findSystem('FIN-LOAN-IN');
        $this->actingAs($this->fm)->post('/bank-transactions', $this->payload($sistem, 'credit'))
            ->assertSessionHasErrors(['category_id' => 'Kategori "Penerimaan Pinjaman" dipakai otomatis oleh modul Utang/Piutang dan tidak bisa dipilih di sini. Catat lewat menu Utang atau Piutang.']);

        $this->actingAs($this->fm)->post('/bank-transactions', $this->payload(TransactionCategory::findSystem('FIN-RCV-OUT'), 'debit'))
            ->assertSessionHasErrors('category_id');
        $this->actingAs($this->fm)->post('/bank-transactions', $this->payload(TransactionCategory::findSystem('EXP-INTEREST'), 'debit'))
            ->assertSessionHasErrors('category_id');

        $induk = TransactionCategory::whereNull('parent_id')->where('label', 'Pajak Titipan & PPN')->sole();
        $this->actingAs($this->fm)->post('/bank-transactions', $this->payload($induk, 'debit'))
            ->assertSessionHasErrors(['category_id' => 'Kategori "Pajak Titipan & PPN" adalah kategori induk. Pilih salah satu sub-kategorinya.']);

        // Induk pendanaan tanpa anak (bentuk lama "Setoran Modal") juga ditolak: dipakai langsung,
        // ia membuat Pakai Template melewati grupnya.
        $datar = TransactionCategory::create(['type' => 'financing', 'label' => 'Hibah']);
        $this->actingAs($this->fm)->post('/bank-transactions', $this->payload($datar, 'credit'))
            ->assertSessionHasErrors('category_id');

        // Arah tetap diperiksa untuk pemasukan/pengeluaran.
        $this->actingAs($this->fm)->post('/bank-transactions', $this->payload($this->sub('Pendapatan Jasa'), 'debit'))
            ->assertSessionHasErrors(['category_id' => 'Kategori pengeluaran atau pendanaan diperlukan untuk transaksi keluar.']);

        $this->assertDatabaseCount('bank_transactions', 0);
    }

    public function test_ubah_kategori_ke_pendanaan_boleh_ke_sistem_tidak_dan_kategori_lama_tidak_diperiksa_ulang(): void
    {
        $gaji = $this->catat($this->sub('Gaji Karyawan'), 'debit', 1_000_000, '2026-11-05', 'Salah catat');

        $this->actingAs($this->fm)->put("/bank-transactions/{$gaji->id}", [
            'transaction_date' => '2026-11-05', 'description' => 'Setor PPN', 'amount' => 1_000_000, 'category_id' => $this->sub('Setor PPN')->id,
        ])->assertSessionHasNoErrors();
        $this->assertSame($this->sub('Setor PPN')->id, $gaji->fresh()->category_id);

        $this->actingAs($this->fm)->put("/bank-transactions/{$gaji->id}", [
            'transaction_date' => '2026-11-05', 'description' => 'x', 'amount' => 1_000_000, 'category_id' => TransactionCategory::findSystem('FIN-LOAN-OUT')->id,
        ])->assertSessionHasErrors('category_id');
        $this->assertSame($this->sub('Setor PPN')->id, $gaji->fresh()->category_id);

        // Bunga utang (kategori sistem EXP-INTEREST) tetap beban biasa: boleh diubah selama kategorinya tidak diganti.
        $bunga = $this->catat(TransactionCategory::findSystem('EXP-INTEREST'), 'debit', 50_000, '2026-11-05', 'Bunga');
        $this->actingAs($this->fm)->put("/bank-transactions/{$bunga->id}", [
            'transaction_date' => '2026-11-06', 'description' => 'Bunga November', 'amount' => 50_000, 'category_id' => $bunga->category_id,
        ])->assertSessionHasNoErrors();
        $this->assertSame('Bunga November', $bunga->fresh()->description);
    }

    public function test_opsi_kategori_formulir_berisi_grup_pendanaan_terakhir_tanpa_kategori_sistem(): void
    {
        $debit = collect($this->actingAs($this->fm)->getJson('/api/transaction-categories?type=debit')->assertOk()->json());

        $pendanaan = $debit->filter(fn (array $o): bool => $o['financing'] ?? false)->values();
        $this->assertSame(
            ['Pajak Titipan & PPN', '↳ Setor PPN', '↳ Setor Titipan Pajak Klien', 'Penarikan Modal', '↳ Prive Pemilik', 'Setoran Modal', '↳ Setoran Modal Pemilik'],
            $pendanaan->pluck('label')->all()
        );
        $this->assertSame($pendanaan->all(), $debit->slice(-7)->values()->all(), 'Grup Pendanaan harus terakhir.');
        $this->assertFalse($debit->contains('label', '↳ Penerimaan Pinjaman'));
        $this->assertTrue($pendanaan->first()['disabled']);

        $kredit = collect($this->actingAs($this->fm)->getJson('/api/transaction-categories?type=credit')->json());
        $this->assertTrue($kredit->contains(fn (array $o): bool => $o['label'] === '↳ Setoran Modal Pemilik' && ($o['financing'] ?? false)));

        // Tanpa type (filter tab transaksi Kas & Bank): pokok utang/piutang ikut, di bawah judul sendiri.
        $semua = collect($this->actingAs($this->fm)->getJson('/api/transaction-categories')->json());
        $this->assertTrue($semua->contains(fn (array $o): bool => $o['label'] === 'Dari Utang & Piutang' && $o['disabled']));
        $this->assertTrue($semua->contains('label', '↳ Penerimaan Pinjaman'));
    }

    /* ─── Daftar & kartu ringkasan ──────────────────────────── */

    private function isiData(): void
    {
        $this->catat($this->sub('Gaji Karyawan'), 'debit', 8_500_000, '2026-11-05', 'Gaji karyawan Oktober');
        $this->catat($this->sub('Sewa Kantor'), 'debit', 3_000_000, '2026-11-07', 'Sewa kantor November');
        $this->catat($this->sub('Setor PPN'), 'debit', 3_300_000, '2026-11-10', 'Setor PPN masa Oktober');
        $this->catat($this->sub('Prive Pemilik'), 'debit', 5_000_000, '2026-11-08', 'Prive pemilik');
        $this->catat($this->sub('Pendapatan Jasa'), 'credit', 4_000_000, '2026-11-03', 'Pendapatan jasa');
        $this->catat($this->sub('Setoran Modal Pemilik'), 'credit', 25_000_000, '2026-11-02', 'Setoran modal');
        Payment::factory()->create([
            'invoice_id' => Invoice::factory()->sent()->create(['billed_to_id' => Client::factory()->create()->id])->id,
            'bank_account_id' => $this->bca->id,
            'amount' => 11_000_000,
            'payment_date' => '2026-11-04',
        ]);
        // Bukan pemasukan/pengeluaran/pendanaan: tidak ikut daftar.
        $transfer = TransactionCategory::where('label', 'Antar Rekening Sendiri')->sole();
        $this->catat($transfer, 'credit', 1_000_000, '2026-11-02', 'Pindah dana');
    }

    public function test_tab_pengeluaran_menampilkan_pendanaan_berpenanda_dan_kartu_terpisah(): void
    {
        $this->isiData();

        $this->actingAs($this->fm)->get('/cash-flow/expenses?date_from=2026-11-01&date_to=2026-11-30')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('cash-flow/expenses')
                ->where('stats', ['total_amount' => 19_800_000, 'pl_amount' => 11_500_000, 'financing_amount' => 8_300_000, 'total_count' => 4])
                ->has('rows', 4)
                ->where('rows.0.description', 'Setor PPN masa Oktober')
                ->where('rows.0.is_financing', true)
                ->where('rows.0.category_type', 'financing')
                ->where('rows.0.managed_by', null)
                ->where('rows.2.description', 'Sewa kantor November')
                ->where('rows.2.is_financing', false)
                ->where('categoryOptions', fn ($opsi) => collect($opsi)->last()['financing'] === true)
                ->where('filterCategoryOptions', fn ($opsi) => collect($opsi)->contains('label', '↳ Pembayaran Pokok Pinjaman')
                    && ! collect($opsi)->contains('label', '↳ Penerimaan Pinjaman'))
            );
    }

    public function test_tab_pemasukan_kartu_pemasukan_termasuk_pembayaran_invoice_dan_pendanaan_terpisah(): void
    {
        $this->isiData();

        $this->actingAs($this->fm)->get('/cash-flow/income?date_from=2026-11-01&date_to=2026-11-30')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('cash-flow/income')
                ->where('stats', ['total_amount' => 40_000_000, 'pl_amount' => 15_000_000, 'financing_amount' => 25_000_000, 'total_count' => 3])
                ->has('rows', 3)
                ->where('rows.0.source_type', 'payment')
                ->where('rows.0.is_financing', false)
                ->where('rows.2.description', 'Setoran modal')
                ->where('rows.2.is_financing', true)
            );
    }

    public function test_tab_semua_menyebut_porsi_pendanaan_di_masuk_dan_keluar(): void
    {
        $this->isiData();

        $this->actingAs($this->fm)->get('/cash-flow/all?date_from=2026-11-01&date_to=2026-11-30')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('cash-flow/all')
                ->where('stats.total_in', 40_000_000)
                ->where('stats.total_out', 19_800_000)
                ->where('stats.net', 20_200_000)
                ->where('stats.financing_in', 25_000_000)
                ->where('stats.financing_out', 8_300_000)
                ->where('stats.total_count', 7)
                ->has('filterCategoryOptions')
            );

        // Filter kategori pendanaan.
        $this->actingAs($this->fm)->get('/cash-flow/all?categories='.$this->sub('Setor PPN')->id)
            ->assertInertia(fn (Assert $page) => $page->has('rows', 1)->where('rows.0.is_financing', true));
    }

    /* ─── Pokok utang/piutang: hanya-lihat ──────────────────── */

    /** @return array{0: Loan, 1: BankTransaction, 2: BankTransaction} [utang, penerimaan, pembayaran pokok] */
    private function utangLewatModul(): array
    {
        $this->actingAs($this->fm)->post('/loans', [
            'loan_number' => 'LOAN-QA-01', 'lender_name' => 'Bank BRI', 'principal_amount' => 50_000_000,
            'interest_type' => 'fixed', 'interest_amount' => 1_000_000, 'term_months' => 12,
            'start_date' => '2026-11-01', 'maturity_date' => '2027-11-01', 'bank_account_id' => $this->bca->id,
        ])->assertSessionHasNoErrors();
        $utang = Loan::where('loan_number', 'LOAN-QA-01')->sole();

        $this->actingAs($this->fm)->post("/loans/{$utang->id}/pay", [
            'bank_account_id' => $this->bca->id, 'payment_date' => '2026-11-04', 'principal_paid' => 4_000_000, 'interest_paid' => 200_000,
        ])->assertSessionHasNoErrors();

        return [
            $utang,
            BankTransaction::where('category_id', TransactionCategory::findSystem('FIN-LOAN-IN')->id)->sole(),
            BankTransaction::where('category_id', TransactionCategory::findSystem('FIN-LOAN-OUT')->id)->sole(),
        ];
    }

    public function test_pokok_utang_tampil_hanya_lihat_dengan_tautan_ke_utangnya_dan_bunga_tetap_beban(): void
    {
        $this->utangLewatModul();

        $this->actingAs($this->fm)->get('/cash-flow/expenses')
            ->assertInertia(fn (Assert $page) => $page
                ->has('rows', 2)
                ->where('stats.financing_amount', 4_000_000)
                ->where('stats.pl_amount', 200_000)
                ->where('rows', fn ($baris) => collect($baris)->contains(fn ($b) => $b['description'] === 'Pembayaran pokok pinjaman - Bank BRI'
                    && $b['is_financing'] === true
                    && $b['managed_by'] === ['module' => 'loans', 'label' => 'Utang', 'search' => 'Bank BRI'])
                    && collect($baris)->contains(fn ($b) => $b['description'] === 'Pembayaran bunga pinjaman - Bank BRI'
                    && $b['is_financing'] === false && $b['managed_by'] === null))
            );

        $this->actingAs($this->fm)->get('/cash-flow/income')
            ->assertInertia(fn (Assert $page) => $page
                ->has('rows', 1)
                ->where('rows.0.managed_by', ['module' => 'loans', 'label' => 'Utang', 'search' => 'LOAN-QA-01'])
            );
    }

    public function test_pokok_piutang_tampil_hanya_lihat_dengan_nomor_piutangnya(): void
    {
        $piutang = Receivable::create([
            'receivable_number' => 'RCV-00042', 'type' => 'employee_loan', 'debtor_type' => User::class,
            'debtor_id' => $this->lihat->id, 'principal_amount' => 2_000_000, 'interest_rate' => 0,
            'loan_date' => '2026-11-01', 'status' => 'pending_approval',
        ]);
        $this->actingAs($this->fm)->post("/receivables/{$piutang->id}/approve", ['action' => 'approve', 'bank_account_id' => $this->bca->id])
            ->assertSessionHasNoErrors();
        $this->actingAs($this->fm)->post("/receivables/{$piutang->id}/pay", [
            'bank_account_id' => $this->bca->id, 'payment_date' => '2026-11-05', 'principal_paid' => 500_000, 'payment_method' => 'bank_transfer',
        ])->assertSessionHasNoErrors();

        $harap = ['module' => 'receivables', 'label' => 'Piutang', 'search' => 'RCV-00042'];
        $this->actingAs($this->fm)->get('/cash-flow/all')
            ->assertInertia(fn (Assert $page) => $page
                ->has('rows', 2)
                ->where('rows.0.managed_by', $harap)
                ->where('rows.1.managed_by', $harap)
                ->where('stats.financing_in', 500_000)
                ->where('stats.financing_out', 2_000_000)
            );
    }

    public function test_server_menolak_ubah_dan_hapus_pokok_utang_lewat_arus_kas_dan_kas_bank(): void
    {
        [, $masuk, $keluar] = $this->utangLewatModul();
        $pesan = 'Transaksi ini pokok utang yang dicatat otomatis oleh modul Utang, jadi tidak bisa diubah atau dihapus dari sini. Kelola lewat menu Utang.';

        $this->actingAs($this->fm)->putJson("/bank-transactions/{$keluar->id}", [
            'transaction_date' => '2026-11-04', 'description' => 'diubah', 'amount' => 1,
        ])->assertForbidden()->assertJson(['message' => $pesan]);
        $this->actingAs($this->fm)->deleteJson("/bank-transactions/{$masuk->id}")->assertForbidden()->assertJson(['message' => $pesan]);
        $this->actingAs($this->fm)->postJson('/bank-transactions/bulk-delete', ['ids' => [$keluar->id]])->assertForbidden();
        $this->actingAs($this->fm)->postJson('/cash-flow/bulk-delete', ['uids' => ["transaction-{$masuk->id}"]])->assertForbidden();

        $this->assertSame('Pembayaran pokok pinjaman - Bank BRI', $keluar->fresh()->description);
        $this->assertSame(4_000_000, $keluar->fresh()->amount);
        $this->assertNotNull($masuk->fresh());

        // Kas & Bank: barisnya ditandai agar tombol hapus tidak tampil.
        $data = collect($this->actingAs($this->fm)->getJson("/bank-accounts/transactions?account={$this->bca->id}")->assertOk()->json('data'));
        $this->assertSame('loans', $data->firstWhere('id', $masuk->id)['managed_by']['module']);
        $this->assertSame('financing', $data->firstWhere('id', $masuk->id)['category']['type']);
        $this->assertNull($data->firstWhere('description', 'Pembayaran bunga pinjaman - Bank BRI')['managed_by']);
    }

    public function test_penerimaan_utang_yatim_dari_data_lama_tidak_dikunci(): void
    {
        $this->actingAs($this->fm)->post('/loans', [
            'loan_number' => 'LOAN-QA-02', 'lender_name' => 'Koperasi', 'principal_amount' => 7_000_000,
            'interest_type' => 'fixed', 'interest_amount' => 0, 'term_months' => 6,
            'start_date' => '2026-11-01', 'maturity_date' => '2027-05-01', 'bank_account_id' => $this->bca->id,
        ])->assertSessionHasNoErrors();
        $utang = Loan::where('loan_number', 'LOAN-QA-02')->sole();
        $masuk = BankTransaction::where('reference_number', 'LOAN-QA-02')->sole();
        $this->assertNotNull($masuk->moduleLockMessage());

        // Sekarang LoanController::destroy ikut membalik pencairannya. Data lama bisa saja masih
        // menyimpan pencairan yatim dari utang yang dihapus sebelum perbaikan itu — tiru di sini.
        Loan::whereKey($utang->id)->delete();
        $this->assertNull($masuk->fresh()->moduleLockMessage());

        $this->actingAs($this->fm)->get('/cash-flow/income')
            ->assertInertia(fn (Assert $page) => $page->where('rows.0.managed_by', null)->where('rows.0.is_financing', true));
        $this->actingAs($this->fm)->delete("/bank-transactions/{$masuk->id}")->assertRedirect();
        $this->assertNull($masuk->fresh());
    }

    /* ─── Ekspor ─────────────────────────────────────────────── */

    public function test_ekspor_excel_memuat_pendanaan_dengan_kolom_jenis_di_akhir(): void
    {
        Excel::fake();
        $this->isiData();

        $this->actingAs($this->fm)->get('/cash-flow/all/export/excel?date_from=2026-11-01&date_to=2026-11-30')->assertOk();

        Excel::assertDownloaded('arus-kas_2026-11-01_2026-11-30.xlsx', function (ArusKasExport $ekspor): bool {
            $judul = $ekspor->headings();
            $baris = collect($ekspor->array());
            $setoran = $baris->first(fn (array $b): bool => $b[4] === 'Setoran modal');
            $gaji = $baris->first(fn (array $b): bool => $b[4] === 'Gaji karyawan Oktober');

            return count($baris) === 7
                && count($judul) === 11
                && $judul[1] === 'Jenis' && $judul[9] === 'No. Referensi'
                && $judul[10] === 'Jenis (Laba Rugi/Pendanaan)'
                && $setoran[1] === 'Masuk' && $setoran[7] === 25_000_000 && $setoran[10] === 'Pendanaan'
                && $gaji[8] === 8_500_000 && $gaji[10] === 'Laba Rugi';
        });
    }

    public function test_pdf_arus_kas_menandai_baris_pendanaan(): void
    {
        $this->isiData();

        $data = app(CashFlowExportService::class)->buildReportData(null, '2026-11-01', '2026-11-30');
        $setoran = collect($data['transactions'])->firstWhere('description', 'Setoran modal');
        $gaji = collect($data['transactions'])->firstWhere('description', 'Gaji karyawan Oktober');

        $this->assertSame('Pendanaan · Setoran Modal → Setoran Modal Pemilik', $setoran['category']);
        $this->assertSame('Beban Karyawan → Gaji Karyawan', $gaji['category']);
    }

    /* ─── Laba Rugi & Dashboard ─────────────────────────────── */

    public function test_transaksi_pendanaan_manual_tidak_mengubah_laba_rugi(): void
    {
        $this->catat($this->sub('Gaji Karyawan'), 'debit', 8_500_000, '2026-11-05', 'Gaji');
        $this->catat($this->sub('Pendapatan Jasa'), 'credit', 4_000_000, '2026-11-03', 'Jasa');
        $periode = [Carbon::parse('2026-11-01')->startOfDay(), Carbon::parse('2026-11-30')->endOfDay()];
        $sebelum = app(ProfitLossService::class)->generate(...$periode);

        foreach ([['Setoran Modal Pemilik', 'credit', 25_000_000], ['Prive Pemilik', 'debit', 5_000_000], ['Setor PPN', 'debit', 3_300_000], ['Setor Titipan Pajak Klien', 'debit', 2_200_000]] as [$label, $tipe, $jumlah]) {
            $this->actingAs($this->fm)->post('/bank-transactions', $this->payload($this->sub($label), $tipe, $jumlah, '2026-11-12'))
                ->assertSessionHasNoErrors();
        }

        $sesudah = app(ProfitLossService::class)->generate(...$periode);

        $this->assertSame($sebelum, $sesudah, 'Pendanaan tidak boleh mengubah satu angka pun di Laba Rugi.');
        $this->assertSame(-4_500_000, $sesudah['net_profit']);
        $this->assertSame([], $sesudah['unclassified']['income']['by_category']);
        $this->assertSame([], $sesudah['unclassified']['expense']['by_category']);
    }

    public function test_tanpa_transfer_dan_penyesuaian_selisih_arus_kas_semua_sama_dengan_dashboard(): void
    {
        Carbon::setTestNow('2026-11-20 10:00:00');
        $this->isiData();
        BankTransaction::where('description', 'Pindah dana')->delete();
        $this->utangLewatModul();

        $dashboard = $this->actingAs($this->fm)->get('/dashboard')->assertOk()->viewData('page')['props']['stats'];
        $semua = $this->actingAs($this->fm)->get('/cash-flow/all?date_from=2026-11-01&date_to=2026-11-30')->viewData('page')['props']['stats'];

        $this->assertSame($dashboard['income_this_month'], $semua['total_in']);
        $this->assertSame($dashboard['expenses_this_month'], $semua['total_out']);
        $this->assertSame($dashboard['net_this_month'], $semua['net']);

        Carbon::setTestNow();
    }

    public function test_pengguna_hanya_lihat_melihat_pendanaan_tanpa_bisa_mencatat(): void
    {
        $this->isiData();

        $this->actingAs($this->lihat)->get('/cash-flow/expenses')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('stats.financing_amount', 8_300_000));
        $this->actingAs($this->lihat)->post('/bank-transactions', $this->payload($this->sub('Setor PPN'), 'debit'))->assertForbidden();
    }
}
