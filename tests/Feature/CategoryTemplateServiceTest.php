<?php

namespace Tests\Feature;

use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\FundRequest;
use App\Models\FundRequestItem;
use App\Models\Reimbursement;
use App\Models\TransactionCategory;
use App\Models\User;
use App\Services\CategoryTemplateService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Aturan "Pakai Template" kategori transaksi (docs/module/transaction-categories.md):
 * isi template, pencocokan nama ternormalisasi, penjaga induk, dan janji bahwa
 * kategori yang sudah ada tidak pernah diubah.
 */
class CategoryTemplateServiceTest extends TestCase
{
    use RefreshDatabase;

    private CategoryTemplateService $template;

    protected function setUp(): void
    {
        parent::setUp();

        $this->template = app(CategoryTemplateService::class);
    }

    private function kategori(string $label, string $type = 'expense', ?TransactionCategory $induk = null, ?string $plGroup = null): TransactionCategory
    {
        return TransactionCategory::create([
            'type' => $type,
            'label' => $label,
            'parent_id' => $induk?->id,
            'pl_group' => $plGroup,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function grup(array $rencana, string $label): array
    {
        return collect($rencana['groups'])->firstWhere('label', $label);
    }

    /**
     * @return array<string, mixed>
     */
    private function sub(array $rencana, string $grup, string $label): array
    {
        return collect($this->grup($rencana, $grup)['children'])->firstWhere('label', $label);
    }

    public function test_template_berisi_15_induk_dan_59_sub_dengan_pemasukan_lebih_dulu_dan_pendanaan_terakhir(): void
    {
        $template = CategoryTemplateService::TEMPLATE;

        $this->assertCount(15, $template);
        $this->assertSame(59, array_sum(array_map(fn (array $grup): int => count($grup['children']), $template)));

        // Urutan bagan akun: pendapatan (4, 7) dulu, baru beban (5, 6, 8, 9), terakhir pendanaan.
        $this->assertSame(['income', 'income'], array_column(array_slice($template, 0, 2), 'type'));
        $this->assertSame(array_fill(0, 10, 'expense'), array_column(array_slice($template, 2, 10), 'type'));
        $this->assertSame(array_fill(0, 3, 'financing'), array_column(array_slice($template, 12), 'type'));
        $this->assertSame('Pendapatan Usaha (Tanpa Invoice)', $template[0]['label']);
        $this->assertSame('Pajak Penghasilan Badan', $template[11]['label']);
    }

    public function test_bagian_pendanaan_berisi_nama_yang_disepakati_tanpa_grup_laba_rugi(): void
    {
        $pendanaan = array_values(array_filter(CategoryTemplateService::TEMPLATE, fn (array $grup): bool => $grup['type'] === 'financing'));

        $this->assertSame([
            ['type' => 'financing', 'label' => 'Setoran Modal', 'pl_group' => null, 'children' => ['Setoran Modal Pemilik']],
            ['type' => 'financing', 'label' => 'Penarikan Modal', 'pl_group' => null, 'children' => ['Prive Pemilik']],
            ['type' => 'financing', 'label' => 'Pajak Titipan & PPN', 'pl_group' => null, 'children' => ['Setor PPN', 'Setor Titipan Pajak Klien']],
        ], $pendanaan);
    }

    public function test_label_template_unik_per_tipe(): void
    {
        $perTipe = [];

        foreach (CategoryTemplateService::TEMPLATE as $grup) {
            foreach ([$grup['label'], ...$grup['children']] as $label) {
                $perTipe[$grup['type']][] = CategoryTemplateService::normalize($label);
            }
        }

        foreach ($perTipe as $tipe => $labels) {
            $this->assertSame(count($labels), count(array_unique($labels)), "Ada label kembar bertipe {$tipe}.");
        }
    }

    public function test_grup_laba_rugi_template_cocok_dengan_tipenya(): void
    {
        $boleh = [
            'income' => ['revenue', 'other_income'],
            'expense' => ['cogs', 'opex', 'other_expense', 'tax'],
        ];

        foreach (CategoryTemplateService::TEMPLATE as $grup) {
            if ($grup['type'] === 'financing') {
                $this->assertNull($grup['pl_group'], "{$grup['label']} pendanaan tidak boleh punya baris Laba Rugi.");

                continue;
            }

            $this->assertContains($grup['pl_group'], TransactionCategory::PL_GROUPS);
            $this->assertContains($grup['pl_group'], $boleh[$grup['type']], "{$grup['label']} bergrup L/R yang salah untuk tipenya.");
        }
    }

    public function test_normalisasi_mengabaikan_spasi_dan_huruf_besar(): void
    {
        $this->assertSame('beban kantor', CategoryTemplateService::normalize("  Beban \t  KANTOR "));
        $this->assertSame('pph final umkm 0,5%', CategoryTemplateService::normalize('PPh  Final UMKM 0,5%'));
        // Nama mirip tetap berbeda.
        $this->assertNotSame(
            CategoryTemplateService::normalize('Beban Kantor'),
            CategoryTemplateService::normalize('Beban Kantor Cabang'),
        );
    }

    public function test_menerapkan_pada_data_kosong_membuat_74_kategori_yang_terklasifikasi(): void
    {
        $hasil = $this->template->apply();

        $this->assertSame(['created' => 74, 'existing' => 0, 'skipped' => 0], $hasil);
        $this->assertSame(15, TransactionCategory::whereNull('parent_id')->count());
        $this->assertSame(59, TransactionCategory::whereNotNull('parent_id')->count());
        $this->assertSame(
            0,
            TransactionCategory::whereIn('type', ['income', 'expense'])->whereNull('pl_group')->count(),
            'Tidak boleh ada pemasukan/pengeluaran yang belum diklasifikasi.'
        );
        $this->assertSame(7, TransactionCategory::where('type', 'financing')->whereNull('pl_group')->count());

        foreach (CategoryTemplateService::TEMPLATE as $grup) {
            $induk = TransactionCategory::whereNull('parent_id')->where('label', $grup['label'])->sole();

            $this->assertSame($grup['type'], $induk->type);
            $this->assertSame($grup['pl_group'], $induk->pl_group);
            $this->assertEqualsCanonicalizing($grup['children'], $induk->children()->pluck('label')->all());

            foreach ($induk->children as $sub) {
                $this->assertSame($grup['type'], $sub->type, "{$sub->label} bertipe salah.");
                $this->assertSame($grup['pl_group'], $sub->pl_group, "{$sub->label} bergrup L/R salah.");
            }
        }

        $gaji = TransactionCategory::where('label', 'Gaji Karyawan')->sole();
        $this->assertSame('Beban Karyawan', $gaji->parent->label);
        $this->assertSame('opex', $gaji->pl_group);
    }

    public function test_menerapkan_ulang_tidak_membuat_apa_pun(): void
    {
        $this->template->apply();

        $this->assertSame(['created' => 0, 'existing' => 74, 'skipped' => 0], $this->template->apply());
        $this->assertSame(74, TransactionCategory::count());
        $this->assertSame(['new' => 0, 'existing' => 74, 'skipped' => 0], $this->template->plan()['summary']);
    }

    public function test_induk_lama_dicocokkan_tanpa_peka_huruf_dan_spasi_lalu_sub_ditempel_tanpa_mengubahnya(): void
    {
        $lama = $this->kategori('  beban   KANTOR ');
        $this->travel(5)->minutes();

        $rencana = $this->template->plan();
        $grup = $this->grup($rencana, 'Beban Kantor');

        $this->assertSame(CategoryTemplateService::STATUS_EXISTING, $grup['status']);
        $this->assertSame($lama->id, $grup['category_id']);
        $this->assertSame('  beban   KANTOR ', $grup['existing_label']);

        $this->template->apply();

        $this->assertSame(0, TransactionCategory::where('label', 'Beban Kantor')->count(), 'Induk kembar tidak boleh dibuat.');
        $this->assertEqualsCanonicalizing(
            ['Sewa Kantor', 'Listrik', 'Air', 'Internet & Telepon', 'Kebersihan & Keamanan', 'Konsumsi Kantor & Rapat'],
            $lama->children()->pluck('label')->all(),
        );

        $setelah = $lama->fresh();
        $this->assertSame('  beban   KANTOR ', $setelah->label);
        $this->assertNull($setelah->pl_group, 'Grup L/R induk lama tidak boleh diisi template.');
        $this->assertEquals($lama->updated_at, $setelah->updated_at);
    }

    public function test_induk_bertipe_lain_tidak_dianggap_sama(): void
    {
        $pemasukan = $this->kategori('Beban Kantor', 'income');

        $this->template->apply();

        $this->assertSame(0, $pemasukan->children()->count());
        $this->assertSame(1, TransactionCategory::whereNull('parent_id')->where('type', 'expense')->where('label', 'Beban Kantor')->count());
    }

    public function test_sub_yang_sudah_ada_di_induk_lain_dilewati(): void
    {
        $operasional = $this->kategori('Operasional');
        $listrik = $this->kategori(' LISTRIK', 'expense', $operasional);

        $sub = $this->sub($this->template->plan(), 'Beban Kantor', 'Listrik');
        $this->assertSame(CategoryTemplateService::STATUS_EXISTING, $sub['status']);
        $this->assertSame($operasional->id, $sub['existing_parent_id']);
        $this->assertSame('Operasional', $sub['existing_parent_label']);
        $this->assertNull($sub['existing_pl_group']);

        $hasil = $this->template->apply();

        $this->assertSame(73, $hasil['created']);
        $this->assertSame(1, $hasil['existing']);
        $this->assertSame(
            [$listrik->id],
            TransactionCategory::whereNotNull('parent_id')->get()
                ->filter(fn (TransactionCategory $c): bool => CategoryTemplateService::normalize($c->label) === 'listrik')
                ->pluck('id')->values()->all(),
            'Pemilih kategori tidak boleh berisi dua "Listrik".',
        );
        $this->assertSame($operasional->id, $listrik->fresh()->parent_id);
    }

    /**
     * @return array<string, array{string}>
     */
    public static function pemakaianLangsung(): array
    {
        return [
            'transaksi bank' => ['transaksi'],
            'item pengajuan dana' => ['item pengajuan dana'],
            'reimbursement' => ['reimbursement'],
        ];
    }

    #[DataProvider('pemakaianLangsung')]
    public function test_induk_yang_dipakai_langsung_membuat_grupnya_dilewati(string $pemakaian): void
    {
        $induk = $this->kategori('Beban Kantor');
        $this->pakaiLangsung($induk, $pemakaian);

        $rencana = $this->template->plan();
        $grup = $this->grup($rencana, 'Beban Kantor');

        $this->assertSame(CategoryTemplateService::STATUS_SKIPPED, $grup['status']);
        $this->assertStringContainsString("sudah dipakai langsung oleh 1 {$pemakaian}", $grup['reason']);
        $this->assertSame(
            array_fill(0, 6, CategoryTemplateService::STATUS_SKIPPED),
            array_column($grup['children'], 'status'),
        );
        $this->assertSame(['new' => 67, 'existing' => 0, 'skipped' => 7], $rencana['summary']);

        $hasil = $this->template->apply();

        $this->assertSame(['created' => 67, 'existing' => 0, 'skipped' => 7], $hasil);
        $this->assertSame(0, $induk->children()->count(), 'Induk yang dipakai langsung tidak boleh diberi sub.');
        $this->assertSame(0, TransactionCategory::where('label', 'Sewa Kantor')->count());
        $this->assertSame(1, TransactionCategory::where('label', 'Beban Kantor')->count());
    }

    public function test_kategori_sistem_tidak_dijadikan_grup(): void
    {
        $sistem = $this->kategori('Beban Lain-lain', 'expense', null, 'other_expense');
        $sistem->forceFill(['system_key' => 'UJI-SISTEM'])->save();

        $grup = $this->grup($this->template->plan(), 'Beban Lain-lain');
        $this->assertSame(CategoryTemplateService::STATUS_SKIPPED, $grup['status']);
        $this->assertStringContainsString('kategori sistem', $grup['reason']);

        $this->template->apply();

        $this->assertSame(0, $sistem->children()->count());
        $this->assertSame(0, TransactionCategory::where('label', 'Biaya Administrasi Bank')->count());
    }

    public function test_induk_kembar_memakai_yang_lolos_penjaga(): void
    {
        $dipakai = $this->kategori('Beban Kantor');
        $this->pakaiLangsung($dipakai, 'transaksi');
        $bersih = $this->kategori('beban kantor');

        $grup = $this->grup($this->template->plan(), 'Beban Kantor');
        $this->assertSame(CategoryTemplateService::STATUS_EXISTING, $grup['status']);
        $this->assertSame($bersih->id, $grup['category_id']);

        $this->template->apply();

        $this->assertSame(0, $dipakai->children()->count());
        $this->assertSame(6, $bersih->children()->count());
    }

    public function test_induk_baru_tidak_dibuat_bila_semua_subnya_sudah_ada_di_grup_lain(): void
    {
        $pajak = $this->kategori('Pajak', 'expense', null, 'tax');
        foreach (['PPh 25 (Angsuran Bulanan)', 'pph 29 (kurang bayar tahunan)', 'PPh Final UMKM 0,5%'] as $label) {
            $this->kategori($label, 'expense', $pajak, 'tax');
        }

        $grup = $this->grup($this->template->plan(), 'Pajak Penghasilan Badan');
        $this->assertSame(CategoryTemplateService::STATUS_SKIPPED, $grup['status']);
        $this->assertSame('Semua subkategorinya sudah ada di grup lain.', $grup['reason']);

        $this->template->apply();

        $this->assertSame(0, TransactionCategory::where('label', 'Pajak Penghasilan Badan')->count(), 'Judul grup kosong tidak boleh dibuat.');
        $this->assertSame(3, $pajak->children()->count());
    }

    public function test_kategori_yang_sudah_ada_tidak_pernah_diubah(): void
    {
        $kantor = $this->kategori('BEBAN KANTOR', 'expense', null, 'cogs');
        $this->kategori('Listrik', 'expense', $kantor, 'other_expense');
        $lain = $this->kategori('Pendapatan Lain-lain', 'income');
        $this->kategori('Pendapatan Sewa', 'income', $lain);
        $sistem = $this->kategori('Pendapatan Bunga', 'income', null, 'other_income');
        $sistem->forceFill(['system_key' => 'REV-INTEREST'])->save();
        $dipakai = $this->kategori('Beban Pemasaran');
        $this->pakaiLangsung($dipakai, 'transaksi');

        $sebelum = TransactionCategory::orderBy('id')->get()->map->getAttributes()->all();
        $this->travel(5)->minutes();

        $this->template->apply();

        $setelah = TransactionCategory::whereIn('id', array_column($sebelum, 'id'))->orderBy('id')->get()->map->getAttributes()->all();
        $this->assertSame($sebelum, $setelah);
    }

    public function test_perusahaan_lama_setoran_dan_penarikan_modal_tanpa_anak_dipakai_ulang_lalu_sub_ditempel(): void
    {
        // Persis isi seeder lama: dua induk pendanaan tanpa anak, plus kategori sistem pendanaan.
        $setoran = $this->kategori('Setoran Modal', 'financing');
        $penarikan = $this->kategori('Penarikan Modal', 'financing');
        $pinjaman = $this->kategori('Penerimaan Pinjaman', 'financing');
        $pinjaman->forceFill(['system_key' => 'FIN-LOAN-IN'])->save();

        $rencana = $this->template->plan();

        $grupSetoran = $this->grup($rencana, 'Setoran Modal');
        $this->assertSame(CategoryTemplateService::STATUS_EXISTING, $grupSetoran['status']);
        $this->assertSame($setoran->id, $grupSetoran['category_id']);
        $this->assertSame(CategoryTemplateService::STATUS_NEW, $grupSetoran['children'][0]['status']);
        $this->assertSame(CategoryTemplateService::STATUS_EXISTING, $this->grup($rencana, 'Penarikan Modal')['status']);
        $this->assertSame(CategoryTemplateService::STATUS_NEW, $this->grup($rencana, 'Pajak Titipan & PPN')['status']);

        $hasil = $this->template->apply();

        // 74 kategori template − 2 induk yang sudah ada.
        $this->assertSame(['created' => 72, 'existing' => 2, 'skipped' => 0], $hasil);
        $this->assertSame(['Setoran Modal Pemilik'], $setoran->children()->pluck('label')->all());
        $this->assertSame(['Prive Pemilik'], $penarikan->children()->pluck('label')->all());
        $this->assertSame(1, TransactionCategory::where('label', 'Setoran Modal')->count(), 'Induk kembar tidak boleh dibuat.');
        $this->assertSame(0, $pinjaman->children()->count());

        foreach (['Setoran Modal Pemilik', 'Prive Pemilik', 'Setor PPN', 'Setor Titipan Pajak Klien'] as $label) {
            $sub = TransactionCategory::where('label', $label)->sole();
            $this->assertSame('financing', $sub->type, "{$label} harus bertipe pendanaan.");
            $this->assertNull($sub->pl_group, "{$label} tidak boleh punya baris Laba Rugi.");
            $this->assertNull($sub->system_key);
        }

        $this->assertSame(['created' => 0, 'existing' => 74, 'skipped' => 0], $this->template->apply(), 'Penerapan ulang harus idempoten.');
    }

    public function test_rencana_tidak_mengubah_database(): void
    {
        $this->template->plan();

        $this->assertSame(0, TransactionCategory::count());
    }

    private function pakaiLangsung(TransactionCategory $kategori, string $pemakaian): void
    {
        $user = User::factory()->create();

        match ($pemakaian) {
            'transaksi' => BankTransaction::create([
                'bank_account_id' => BankAccount::factory()->create()->id,
                'category_id' => $kategori->id,
                'amount' => 150_000,
                'transaction_date' => '2026-10-01',
                'transaction_type' => 'debit',
                'description' => 'Listrik kantor Oktober',
            ]),
            'item pengajuan dana' => FundRequestItem::create([
                'fund_request_id' => FundRequest::create([
                    'request_number' => '001/TST/X/2026',
                    'user_id' => $user->id,
                    'title' => 'Kebutuhan kantor',
                    'purpose' => 'Kebutuhan kantor',
                    'total_amount' => 150_000,
                    'priority' => 'medium',
                    'needed_by_date' => now()->addDays(7)->toDateString(),
                    'status' => 'draft',
                ])->id,
                'description' => 'Air galon',
                'category_id' => $kategori->id,
                'quantity' => 1,
                'unit_price' => 150_000,
                'amount' => 150_000,
            ]),
            'reimbursement' => Reimbursement::create([
                'user_id' => $user->id,
                'title' => 'Token listrik',
                'amount' => 150_000,
                'expense_date' => now()->toDateString(),
                'category_input' => 'Listrik',
                'category_id' => $kategori->id,
            ]),
        };
    }
}
