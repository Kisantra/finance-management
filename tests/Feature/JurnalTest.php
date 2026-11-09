<?php

namespace Tests\Feature;

use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Loan;
use App\Models\Payment;
use App\Models\Receivable;
use App\Models\TransactionCategory;
use App\Models\User;
use App\Services\CategoryTemplateService;
use App\Services\JournalService;
use App\Services\ProfitLossService;
use Carbon\Carbon;
use Database\Seeders\TransactionCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Jurnal tampilan ("Cara A"): debit/kredit diturunkan dari rekening + kategori + arah + jumlah, dan
 * untuk pembayaran invoice dari "titipan dulu" Laba Rugi. Tidak disimpan, bukan buku besar.
 * Lihat docs/module/cash-flow.md › Jurnal dan App\Services\JournalService.
 */
class JurnalTest extends TestCase
{
    use RefreshDatabase;

    private User $fm;

    private BankAccount $bca;

    private BankAccount $kas;

    private const BCA = 'BCA Operasional — BCA';

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(TransactionCategorySeeder::class);
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $izin = ['view income', 'view expense', 'view transfer', 'edit income', 'edit expense', 'view categories', 'view bank-accounts', 'view invoices'];
        foreach ($izin as $nama) {
            Permission::firstOrCreate(['name' => $nama]);
        }

        $this->fm = User::factory()->create(['name' => 'Rina Keuangan']);
        $this->fm->givePermissionTo($izin);

        $this->bca = BankAccount::factory()->create(['account_name' => 'BCA Operasional', 'bank_name' => 'BCA', 'initial_balance' => 50_000_000]);
        $this->kas = BankAccount::factory()->cash()->create(['account_name' => 'Kas Kecil', 'initial_balance' => 1_000_000]);
    }

    private function sub(string $label): TransactionCategory
    {
        return TransactionCategory::where('label', $label)->whereNotNull('parent_id')->sole();
    }

    private function tx(TransactionCategory $kategori, string $tipe, int $jumlah, array $lain = []): BankTransaction
    {
        return BankTransaction::factory()->create([
            'bank_account_id' => $this->bca->id,
            'category_id' => $kategori->id,
            'transaction_type' => $tipe,
            'amount' => $jumlah,
            'transaction_date' => '2026-11-05',
            'description' => 'Uji jurnal',
            'reference_number' => null,
            ...$lain,
        ]);
    }

    /** @return list<array{0: string, 1: string, 2: int}> [akun, sisi, jumlah] — bentuk ringkas untuk asersi. */
    private function ringkas(array $jurnal): array
    {
        return array_map(fn (array $b): array => [$b['account'], $b['side'], $b['amount']], $jurnal);
    }

    private function seimbang(array $jurnal): bool
    {
        $debit = array_sum(array_map(fn ($b) => $b['side'] === 'debit' ? $b['amount'] : 0, $jurnal));
        $kredit = array_sum(array_map(fn ($b) => $b['side'] === 'credit' ? $b['amount'] : 0, $jurnal));

        return $debit === $kredit && $debit > 0;
    }

    /* ─── Pemasukan, pengeluaran, nama rekening ─────────────────── */

    public function test_pemasukan_debit_rekening_kredit_label_kategori(): void
    {
        $t = $this->tx($this->sub('Pendapatan Jasa'), 'credit', 4_000_000);

        $this->assertSame([[self::BCA, 'debit', 4_000_000], ['Pendapatan Jasa', 'credit', 4_000_000]], $this->ringkas(JournalService::forTransaction($t)));
    }

    public function test_pengeluaran_debit_label_kategori_kredit_rekening_dan_kas_bernama_akunnya_saja(): void
    {
        $t = $this->tx($this->sub('Listrik'), 'debit', 950_000, ['bank_account_id' => $this->kas->id]);

        $this->assertSame([['Listrik', 'debit', 950_000], ['Kas Kecil', 'credit', 950_000]], $this->ringkas(JournalService::forTransaction($t)));
        $this->assertSame(self::BCA, $this->bca->journalName());
        $this->assertSame('Kas Kecil', $this->kas->journalName());
    }

    public function test_bunga_utang_dan_piutang_adalah_beban_dan_pendapatan_biasa_berlabel(): void
    {
        $beban = $this->tx(TransactionCategory::findSystem('EXP-INTEREST'), 'debit', 500_000);
        $pendapatan = $this->tx(TransactionCategory::findSystem('REV-INTEREST'), 'credit', 50_000);

        $this->assertSame([['Beban Bunga Pinjaman', 'debit', 500_000], [self::BCA, 'credit', 500_000]], $this->ringkas(JournalService::forTransaction($beban)));
        $this->assertSame([[self::BCA, 'debit', 50_000], ['Pendapatan Bunga', 'credit', 50_000]], $this->ringkas(JournalService::forTransaction($pendapatan)));
    }

    /* ─── Pendanaan ─────────────────────────────────────────────── */

    public function test_sub_pendanaan_template_memakai_akun_neraca_di_kedua_arah(): void
    {
        $kasus = [
            ['Setoran Modal Pemilik', 'credit', [[self::BCA, 'debit', 25_000_000], ['Modal Pemilik', 'credit', 25_000_000]]],
            ['Prive Pemilik', 'debit', [['Prive Pemilik', 'debit', 25_000_000], [self::BCA, 'credit', 25_000_000]]],
            ['Setor PPN', 'debit', [['PPN Keluaran', 'debit', 25_000_000], [self::BCA, 'credit', 25_000_000]]],
            ['Setor Titipan Pajak Klien', 'debit', [['Titipan Pajak Klien', 'debit', 25_000_000], [self::BCA, 'credit', 25_000_000]]],
            // Pendanaan tidak punya arah tetap: restitusi PPN masuk lewat kategori yang sama.
            ['Setor PPN', 'credit', [[self::BCA, 'debit', 25_000_000], ['PPN Keluaran', 'credit', 25_000_000]]],
        ];

        foreach ($kasus as [$label, $tipe, $harap]) {
            $this->assertSame($harap, $this->ringkas(JournalService::forTransaction($this->tx($this->sub($label), $tipe, 25_000_000))), "{$label} {$tipe}");
        }
    }

    public function test_akun_ppn_dan_titipan_sama_dengan_yang_dikredit_pembayaran_invoice(): void
    {
        $this->assertSame(JournalService::PPN_KELUARAN, CategoryTemplateService::JOURNAL_ACCOUNTS['Setor PPN']);
        $this->assertSame(JournalService::TAX_DEPOSIT, CategoryTemplateService::JOURNAL_ACCOUNTS['Setor Titipan Pajak Klien']);
    }

    public function test_kunci_akun_jurnal_adalah_sub_pendanaan_yang_ada_di_template(): void
    {
        $subPendanaan = collect(CategoryTemplateService::TEMPLATE)->where('type', 'financing')->pluck('children')->flatten()->all();

        foreach (array_keys(CategoryTemplateService::JOURNAL_ACCOUNTS) as $label) {
            $this->assertContains($label, $subPendanaan, "{$label} harus sub pendanaan di TEMPLATE");
        }
        $this->assertSame($subPendanaan, array_keys(CategoryTemplateService::JOURNAL_ACCOUNTS), 'setiap sub pendanaan template punya akun jurnal');
    }

    public function test_pencocokan_memakai_nama_ternormalisasi_dan_hanya_untuk_pendanaan(): void
    {
        $induk = TransactionCategory::create(['type' => 'financing', 'label' => 'Pajak Lama']);
        $mirip = TransactionCategory::create(['type' => 'financing', 'label' => '  setor   ppn ', 'parent_id' => $induk->id]);
        $beban = TransactionCategory::create(['type' => 'expense', 'label' => 'Setor PPN', 'pl_group' => 'opex']);

        $this->assertSame('PPN Keluaran', JournalService::counterAccountFor($mirip));
        $this->assertSame('Setor PPN', JournalService::counterAccountFor($beban), 'beban bernama sama tetap label sendiri');
        $this->assertNull(CategoryTemplateService::journalAccount('Setoran PPN'), 'nama yang hanya mirip tidak cocok');
    }

    public function test_pendanaan_buatan_pengguna_memakai_labelnya_sendiri(): void
    {
        $induk = TransactionCategory::create(['type' => 'financing', 'label' => 'Pendanaan Lain']);
        $sub = TransactionCategory::create(['type' => 'financing', 'label' => 'Pinjaman dari Direksi', 'parent_id' => $induk->id]);

        $this->assertSame([[self::BCA, 'debit', 3_000_000], ['Pinjaman dari Direksi', 'credit', 3_000_000]], $this->ringkas(JournalService::forTransaction($this->tx($sub, 'credit', 3_000_000))));
    }

    /* ─── Pokok utang/piutang ───────────────────────────────────── */

    public function test_pokok_utang_memakai_nama_pemberi_pinjaman_dan_cadangan_tanpa_nama(): void
    {
        Loan::create(['loan_number' => 'LOAN-00001', 'lender_name' => 'Bank BRI', 'principal_amount' => 50_000_000, 'interest_type' => 'fixed',
            'interest_amount' => 0, 'term_months' => 12, 'start_date' => '2026-11-01', 'maturity_date' => '2027-11-01', 'status' => 'active']);

        $masuk = $this->tx(TransactionCategory::findSystem('FIN-LOAN-IN'), 'credit', 50_000_000, ['reference_number' => 'LOAN-00001', 'description' => 'Penerimaan pinjaman dari Bank BRI']);
        $keluar = $this->tx(TransactionCategory::findSystem('FIN-LOAN-OUT'), 'debit', 2_000_000, ['reference_number' => 'BEBAS-1', 'description' => 'Pembayaran pokok pinjaman - Bank BRI']);
        $yatim = $this->tx(TransactionCategory::findSystem('FIN-LOAN-IN'), 'credit', 1_000_000, ['reference_number' => 'LOAN-HILANG', 'description' => 'Penerimaan pinjaman dari X']);
        $tanpaNama = $this->tx(TransactionCategory::findSystem('FIN-LOAN-OUT'), 'debit', 100_000, ['description' => 'Dicatat manual']);

        $this->assertSame([[self::BCA, 'debit', 50_000_000], ['Utang Pinjaman – Bank BRI', 'credit', 50_000_000]], $this->ringkas(JournalService::forTransaction($masuk)));
        $this->assertSame([['Utang Pinjaman – Bank BRI', 'debit', 2_000_000], [self::BCA, 'credit', 2_000_000]], $this->ringkas(JournalService::forTransaction($keluar)));
        $this->assertSame('Utang Pinjaman', JournalService::forTransaction($yatim)[1]['account']);
        $this->assertSame('Utang Pinjaman', JournalService::forTransaction($tanpaNama)[0]['account']);
    }

    public function test_pokok_piutang_memakai_nama_debitur_karyawan_maupun_klien_dan_cadangan(): void
    {
        $budi = User::factory()->create(['name' => 'Budi Kasir']);
        $klien = Client::factory()->create(['name' => 'PT Maju Jaya']);
        $piutang = fn (string $nomor, string $tipe, $debitur) => Receivable::create([
            'receivable_number' => $nomor, 'type' => $tipe, 'debtor_type' => $debitur::class, 'debtor_id' => $debitur->id,
            'principal_amount' => 5_000_000, 'interest_rate' => 0, 'loan_date' => '2026-11-01', 'status' => 'active',
        ]);
        $piutang('RCV-00001', 'employee_loan', $budi);
        $piutang('RCV-00002', 'company_loan', $klien);

        $cair = $this->tx(TransactionCategory::findSystem('FIN-RCV-OUT'), 'debit', 5_000_000, ['reference_number' => 'RCV-00001', 'description' => 'Piutang diberikan: RCV-00001 - Budi Kasir']);
        $cicil = $this->tx(TransactionCategory::findSystem('FIN-RCV-IN'), 'credit', 1_000_000, ['reference_number' => 'CICIL-1', 'description' => 'Pembayaran piutang pokok: RCV-00002 - PT Maju Jaya']);
        $tidakDikenal = $this->tx(TransactionCategory::findSystem('FIN-RCV-IN'), 'credit', 10_000, ['description' => 'Pembayaran piutang pokok: RCV-99999 - Siapa']);

        $this->assertSame([['Piutang – Budi Kasir', 'debit', 5_000_000], [self::BCA, 'credit', 5_000_000]], $this->ringkas(JournalService::forTransaction($cair)));
        $this->assertSame([[self::BCA, 'debit', 1_000_000], ['Piutang – PT Maju Jaya', 'credit', 1_000_000]], $this->ringkas(JournalService::forTransaction($cicil)));
        $this->assertSame('Piutang', JournalService::forTransaction($tidakDikenal)[1]['account']);
    }

    public function test_nama_pihak_dicari_sekali_per_halaman_bukan_per_baris(): void
    {
        $hitung = function (int $n): int {
            BankTransaction::query()->delete();
            Loan::query()->delete();
            Receivable::query()->delete();
            $budi = User::factory()->create();
            for ($i = 1; $i <= $n; $i++) {
                Loan::create(['loan_number' => "LOAN-{$i}", 'lender_name' => "Bank {$i}", 'principal_amount' => 1_000_000, 'interest_type' => 'fixed',
                    'interest_amount' => 0, 'term_months' => 12, 'start_date' => '2026-11-01', 'maturity_date' => '2027-11-01', 'status' => 'active']);
                Receivable::create(['receivable_number' => "RCV-{$i}", 'type' => 'employee_loan', 'debtor_type' => User::class, 'debtor_id' => $budi->id,
                    'principal_amount' => 1_000_000, 'interest_rate' => 0, 'loan_date' => '2026-11-01', 'status' => 'active']);
                $this->tx(TransactionCategory::findSystem('FIN-LOAN-IN'), 'credit', 1_000_000, ['reference_number' => "LOAN-{$i}"]);
                $this->tx(TransactionCategory::findSystem('FIN-RCV-OUT'), 'debit', 1_000_000, ['reference_number' => "RCV-{$i}"]);
            }

            DB::flushQueryLog();
            DB::enableQueryLog();
            $this->actingAs($this->fm)->get('/cash-flow/all')->assertOk();
            $jumlah = count(DB::getQueryLog());
            DB::disableQueryLog();

            return $jumlah;
        };

        $hitung(1); // pemanasan: cache izin dll. dimuat sekali pada permintaan pertama
        $this->assertSame($hitung(2), $hitung(8), 'jumlah query tidak boleh tumbuh mengikuti jumlah baris');
    }

    /* ─── Transfer & penyesuaian ────────────────────────────────── */

    private function transfer(int $jumlah, int $biaya): array
    {
        $kategori = $this->sub('Antar Rekening Sendiri');
        $ulid = (string) Str::ulid();
        $ref = 'TRF20261106-'.substr($ulid, -6);
        $keluar = $this->tx($kategori, 'debit', $jumlah + $biaya, ['reference_number' => $ref, 'transfer_group_id' => $ulid, 'description' => 'Transfer + Admin Fee - Isi kas']);
        $masuk = $this->tx($kategori, 'credit', $jumlah, ['bank_account_id' => $this->kas->id, 'reference_number' => $ref, 'transfer_group_id' => $ulid, 'description' => 'Transfer masuk - Isi kas']);

        return [$keluar, $masuk];
    }

    public function test_transfer_debit_rekening_tujuan_dan_biaya_admin_kredit_rekening_asal(): void
    {
        [$keluar, $masuk] = $this->transfer(1_000_000, 2_500);
        $harap = [['Kas Kecil', 'debit', 1_000_000], ['Biaya Admin Transfer', 'debit', 2_500], [self::BCA, 'credit', 1_002_500]];

        // Kedua kaki menampilkan jurnal transfer yang sama (Kas & Bank menampilkan kaki per rekening).
        $this->assertSame($harap, $this->ringkas(JournalService::forTransaction($keluar)));
        $this->assertSame($harap, $this->ringkas(JournalService::forTransaction($masuk)));

        $this->actingAs($this->fm)->get('/cash-flow/transfers')
            ->assertInertia(fn (Assert $page) => $page->where('rows.0.journal', fn ($j) => $this->ringkas(collect($j)->all()) === $harap));
    }

    public function test_transfer_tanpa_biaya_admin_dan_kaki_tanpa_pasangan(): void
    {
        [$keluar] = $this->transfer(500_000, 0);
        $this->assertSame([['Kas Kecil', 'debit', 500_000], [self::BCA, 'credit', 500_000]], $this->ringkas(JournalService::forTransaction($keluar)));

        $sendiri = $this->tx($this->sub('Antar Rekening Sendiri'), 'credit', 300_000, ['description' => 'Dicatat sendiri lewat Catat Pemasukan']);
        $this->assertSame([[self::BCA, 'debit', 300_000], ['Antar Rekening Sendiri', 'credit', 300_000]], $this->ringkas(JournalService::forTransaction($sendiri)));
    }

    public function test_penyesuaian_memakai_label_kategori_sesuai_arah(): void
    {
        $induk = TransactionCategory::create(['type' => 'adjustment', 'label' => 'Penyesuaian']);
        $selisih = TransactionCategory::create(['type' => 'adjustment', 'label' => 'Selisih Kas', 'parent_id' => $induk->id]);

        $this->assertSame([['Selisih Kas', 'debit', 25_000], [self::BCA, 'credit', 25_000]], $this->ringkas(JournalService::forTransaction($this->tx($selisih, 'debit', 25_000))));
        $this->assertSame([[self::BCA, 'debit', 25_000], ['Selisih Kas', 'credit', 25_000]], $this->ringkas(JournalService::forTransaction($this->tx($selisih, 'credit', 25_000))));
    }

    /* ─── Pembayaran invoice: "titipan dulu" ────────────────────── */

    private function invoice(int $jasa, int $titipan, int $ppn): Invoice
    {
        $invoice = Invoice::factory()->create([
            'subtotal' => $jasa + $titipan, 'ppn_rate' => $ppn > 0 ? 11 : 0, 'ppn_amount' => $ppn,
            'total_amount' => $jasa + $titipan + $ppn, 'issue_date' => '2026-10-01', 'status' => 'sent',
        ]);
        InvoiceItem::factory()->create(['invoice_id' => $invoice->id, 'quantity' => 1, 'unit_price' => $jasa, 'amount' => $jasa, 'cogs_amount' => 0, 'is_tax_deposit' => false]);
        if ($titipan > 0) {
            InvoiceItem::factory()->create(['invoice_id' => $invoice->id, 'quantity' => 1, 'unit_price' => $titipan, 'amount' => $titipan, 'cogs_amount' => 0, 'is_tax_deposit' => true]);
        }

        return $invoice;
    }

    private function bayar(Invoice $invoice, int $jumlah, string $tanggal): Payment
    {
        return Payment::factory()->create(['invoice_id' => $invoice->id, 'bank_account_id' => $this->bca->id, 'amount' => $jumlah, 'payment_date' => $tanggal]);
    }

    public function test_pembayaran_tanpa_titipan_dan_tanpa_ppn_seluruhnya_pendapatan(): void
    {
        $p = $this->bayar($this->invoice(6_000_000, 0, 0), 6_000_000, '2026-11-04');

        $this->assertSame([[self::BCA, 'debit', 6_000_000], ['Pendapatan dari Invoice', 'credit', 6_000_000]], $this->ringkas(JournalService::forPayment($p)));
    }

    public function test_pembayaran_titipan_saja_menutup_titipan_dulu(): void
    {
        $inv = $this->invoice(2_000_000, 500_000, 0);
        $dp = $this->bayar($inv, 300_000, '2026-11-01');
        $lanjut = $this->bayar($inv, 1_000_000, '2026-11-02');

        $this->assertSame([[self::BCA, 'debit', 300_000], ['Titipan Pajak Klien', 'credit', 300_000]], $this->ringkas(JournalService::forPayment($dp)));
        $this->assertSame([[self::BCA, 'debit', 1_000_000], ['Titipan Pajak Klien', 'credit', 200_000], ['Pendapatan dari Invoice', 'credit', 800_000]], $this->ringkas(JournalService::forPayment($lanjut)));
    }

    public function test_pembayaran_ppn_saja_menutup_ppn_dulu(): void
    {
        $inv = $this->invoice(5_000_000, 0, 550_000);
        $p = $this->bayar($inv, 2_000_000, '2026-11-09');

        $this->assertSame([[self::BCA, 'debit', 2_000_000], ['PPN Keluaran', 'credit', 550_000], ['Pendapatan dari Invoice', 'credit', 1_450_000]], $this->ringkas(JournalService::forPayment($p)));
    }

    public function test_pembayaran_titipan_dan_ppn_dp_lebih_kecil_dari_titipan_lalu_melewati_semua_batas(): void
    {
        $inv = $this->invoice(10_000_000, 500_000, 1_100_000);
        $dp = $this->bayar($inv, 300_000, '2026-11-03');
        $termin = $this->bayar($inv, 4_000_000, '2026-11-05');
        $lunas = $this->bayar($inv, 7_300_000, '2026-11-20');

        $this->assertSame([[self::BCA, 'debit', 300_000], ['Titipan Pajak Klien', 'credit', 300_000]], $this->ringkas(JournalService::forPayment($dp)));
        $this->assertSame([
            [self::BCA, 'debit', 4_000_000], ['Titipan Pajak Klien', 'credit', 200_000], ['PPN Keluaran', 'credit', 1_100_000], ['Pendapatan dari Invoice', 'credit', 2_700_000],
        ], $this->ringkas(JournalService::forPayment($termin)));
        $this->assertSame([[self::BCA, 'debit', 7_300_000], ['Pendapatan dari Invoice', 'credit', 7_300_000]], $this->ringkas(JournalService::forPayment($lunas)));
    }

    public function test_pembayaran_bertanggal_sama_diurutkan_id_dan_pembayaran_mundur_tanggal_ikut_urutan_tanggal(): void
    {
        $inv = $this->invoice(10_000_000, 500_000, 1_100_000);
        $a = $this->bayar($inv, 400_000, '2026-11-10');
        $b = $this->bayar($inv, 400_000, '2026-11-10');
        // Dicatat belakangan tetapi bertanggal lebih awal: ia yang pertama menutup titipan.
        $c = $this->bayar($inv, 100_000, '2026-11-01');

        $this->assertSame([[self::BCA, 'debit', 100_000], ['Titipan Pajak Klien', 'credit', 100_000]], $this->ringkas(JournalService::forPayment($c)));
        $this->assertSame([[self::BCA, 'debit', 400_000], ['Titipan Pajak Klien', 'credit', 400_000]], $this->ringkas(JournalService::forPayment($a)));
        $this->assertSame([[self::BCA, 'debit', 400_000], ['PPN Keluaran', 'credit', 400_000]], $this->ringkas(JournalService::forPayment($b)));
    }

    public function test_alokasi_pembayaran_satu_rumus_dan_selalu_berjumlah_yang_dibayar(): void
    {
        foreach ([0, 1, 300_000, 500_000, 1_000_000, 1_600_000, 1_600_001, 12_000_000] as $dibayar) {
            $a = Invoice::allocatePayments($dibayar, 500_000, 1_100_000);
            $this->assertSame($dibayar, $a['tax_deposit'] + $a['ppn'] + $a['revenue'], "dibayar {$dibayar}");
        }
        $this->assertSame(['tax_deposit' => 500_000, 'ppn' => 500_000, 'revenue' => 0], Invoice::allocatePayments(1_000_000, 500_000, 1_100_000));
    }

    /**
     * Invarian: dalam satu periode, Σ kredit "Pendapatan dari Invoice" jurnal pembayaran = pendapatan
     * invoice Laba Rugi, dan Σ kredit "PPN Keluaran" = memo PPN Keluaran — termasuk pembayaran sebelum
     * dan sesudah periode, tanggal sama, dan pembayaran yang melewati batas titipan/PPN.
     */
    public function test_jurnal_pembayaran_periode_sama_dengan_laba_rugi(): void
    {
        $a = $this->invoice(10_000_000, 500_000, 1_100_000);
        $this->bayar($a, 300_000, '2026-10-20');      // sebelum periode
        $this->bayar($a, 4_000_000, '2026-11-05');
        $this->bayar($a, 1_000_000, '2026-11-05');
        $this->bayar($a, 6_300_000, '2026-12-02');    // sesudah periode
        $b = $this->invoice(5_000_000, 0, 550_000);
        $this->bayar($b, 200_000, '2026-11-01');
        $this->bayar($b, 5_350_000, '2026-11-30');
        $c = $this->invoice(2_000_000, 750_000, 0);
        $this->bayar($c, 2_750_000, '2026-11-15');
        $d = $this->invoice(3_000_000, 0, 0);
        $this->bayar($d, 1_000_000, '2026-10-01');
        $this->bayar($d, 2_000_000, '2026-11-11');

        $mulai = Carbon::parse('2026-11-01')->startOfDay();
        $akhir = Carbon::parse('2026-11-30')->endOfDay();
        $laporan = app(ProfitLossService::class)->generate($mulai, $akhir);

        $jurnal = collect(Payment::whereBetween('payment_date', ['2026-11-01', '2026-11-30'])->get())
            ->flatMap(fn (Payment $p) => JournalService::forPayment($p));
        $kredit = fn (string $akun) => $jurnal->where('account', $akun)->where('side', 'credit')->sum('amount');

        $this->assertSame($laporan['revenue']['invoice'], $kredit('Pendapatan dari Invoice'));
        $this->assertSame($laporan['ppn_output'], $kredit('PPN Keluaran'));
        $this->assertGreaterThan(0, $laporan['ppn_output']);
        $this->assertTrue($jurnal->isNotEmpty());
    }

    /* ─── Halaman & data untuk klien ────────────────────────────── */

    public function test_setiap_baris_daftar_arus_kas_membawa_jurnal_seimbang(): void
    {
        Loan::create(['loan_number' => 'LOAN-00001', 'lender_name' => 'Bank BRI', 'principal_amount' => 50_000_000, 'interest_type' => 'fixed',
            'interest_amount' => 0, 'term_months' => 12, 'start_date' => '2026-11-01', 'maturity_date' => '2027-11-01', 'status' => 'active']);
        $this->tx(TransactionCategory::findSystem('FIN-LOAN-IN'), 'credit', 50_000_000, ['reference_number' => 'LOAN-00001']);
        $this->tx($this->sub('Pendapatan Jasa'), 'credit', 4_000_000);
        $this->tx($this->sub('Setor PPN'), 'debit', 1_100_000);
        $inv = $this->invoice(10_000_000, 500_000, 1_100_000);
        $this->bayar($inv, 4_300_000, '2026-11-05');

        foreach (['/cash-flow/all' => 4, '/cash-flow/income' => 3, '/cash-flow/expenses' => 1] as $url => $jumlah) {
            $this->actingAs($this->fm)->get($url)->assertInertia(fn (Assert $page) => $page
                ->has('rows', $jumlah)
                ->where('rows', fn ($baris) => collect($baris)->every(fn ($b) => $this->seimbang(collect($b['journal'])->map(fn ($l) => collect($l)->all())->all())))
            );
        }

        $this->actingAs($this->fm)->get('/cash-flow/income')->assertInertia(fn (Assert $page) => $page
            ->where('rows', fn ($baris) => collect($baris)->contains(fn ($b) => $b['source_type'] === 'payment'
                && $this->ringkas(collect($b['journal'])->map(fn ($l) => collect($l)->all())->all()) === [
                    [self::BCA, 'debit', 4_300_000], ['Titipan Pajak Klien', 'credit', 500_000], ['PPN Keluaran', 'credit', 1_100_000], ['Pendapatan dari Invoice', 'credit', 2_700_000],
                ]))
            ->where('rows', fn ($baris) => collect($baris)->contains(fn ($b) => $b['managed_by'] !== null
                && $b['journal'][1]['account'] === 'Utang Pinjaman – Bank BRI'))
        );
    }

    public function test_opsi_kategori_rekening_dan_invoice_membawa_data_pratinjau(): void
    {
        $opsi = collect($this->actingAs($this->fm)->getJson('/api/transaction-categories?type=debit')->assertOk()->json());
        $this->assertSame('PPN Keluaran', $opsi->firstWhere('label', '↳ Setor PPN')['journal_account']);
        $this->assertSame('Listrik', $opsi->firstWhere('label', '↳ Listrik')['journal_account']);
        $this->assertArrayNotHasKey('journal_account', $opsi->firstWhere('label', 'Beban Kantor'), 'judul grup tidak bisa dipilih');

        $pilihanUbah = collect(TransactionCategory::transactionOptions('income'));
        $this->assertSame('Modal Pemilik', $pilihanUbah->firstWhere('label', '↳ Setoran Modal Pemilik')['journal_account']);

        $rekening = collect($this->actingAs($this->fm)->getJson('/api/bank-accounts')->assertOk()->json());
        $this->assertSame(self::BCA, $rekening->firstWhere('value', $this->bca->id)['journal_name']);
        $this->assertSame('Kas Kecil', $rekening->firstWhere('value', $this->kas->id)['journal_name']);

        $this->actingAs($this->fm)->get('/cash-flow/expenses')
            ->assertInertia(fn (Assert $page) => $page->where('accounts', fn ($a) => collect($a)->firstWhere('id', $this->kas->id)['journal_name'] === 'Kas Kecil'));

        $inv = $this->invoice(10_000_000, 500_000, 1_100_000);
        $this->actingAs($this->fm)->getJson("/invoices/{$inv->id}/data")->assertOk()
            ->assertJsonPath('tax_deposit_total', 500_000)
            ->assertJsonPath('ppn_amount', 1_100_000);
    }

    public function test_tab_kas_bank_membawa_jurnal_transaksi_dan_pembayaran(): void
    {
        [$keluar] = $this->transfer(1_000_000, 2_500);
        $inv = $this->invoice(5_000_000, 0, 550_000);
        $this->bayar($inv, 2_000_000, '2026-11-09');

        $transaksi = $this->actingAs($this->fm)->getJson("/bank-accounts/transactions?account={$this->bca->id}")->assertOk()->json('data');
        $this->assertSame([['Kas Kecil', 'debit', 1_000_000], ['Biaya Admin Transfer', 'debit', 2_500], [self::BCA, 'credit', 1_002_500]],
            $this->ringkas(collect($transaksi)->firstWhere('id', $keluar->id)['journal']));

        $pembayaran = $this->actingAs($this->fm)->getJson("/bank-accounts/payments?account={$this->bca->id}")->assertOk()->json('data');
        $this->assertSame([[self::BCA, 'debit', 2_000_000], ['PPN Keluaran', 'credit', 550_000], ['Pendapatan dari Invoice', 'credit', 1_450_000]],
            $this->ringkas($pembayaran[0]['journal']));
    }

    public function test_jurnal_tidak_menyimpan_apa_pun(): void
    {
        $this->tx($this->sub('Pendapatan Jasa'), 'credit', 4_000_000);
        $tabel = collect(DB::select('SHOW TABLES'))->map(fn ($r) => array_values((array) $r)[0]);
        $this->assertFalse($tabel->contains(fn ($t) => str_contains($t, 'journal') || str_contains($t, 'jurnal')), 'tidak ada tabel jurnal');

        $sebelum = BankTransaction::count();
        $this->actingAs($this->fm)->get('/cash-flow/all')->assertOk();
        $this->assertSame($sebelum, BankTransaction::count());
    }
}
