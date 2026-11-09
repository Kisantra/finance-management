<?php

namespace Tests\Feature;

use App\Models\BankTransaction;
use App\Models\TransactionCategory;
use App\Services\CategoryTemplateService;
use Database\Seeders\BankAccountSeeder;
use Database\Seeders\BankTransactionSeeder;
use Database\Seeders\TransactionCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Kategori awal perusahaan baru (TransactionCategorySeeder, dijalankan provisioning):
 * kategori sistem + transfer + template lewat CategoryTemplateService (termasuk bagian
 * Pendanaan: Setoran Modal, Penarikan Modal, Pajak Titipan & PPN), tanpa kategori khas
 * Kisantra, dan tetap idempoten.
 */
class TransactionCategorySeederTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Kategori bawaan lama yang khas satu perusahaan; tidak boleh lagi ikut ke perusahaan baru.
     *
     * @var list<string>
     */
    private const LABEL_LAMA = [
        'Operational Expenses', 'MAKAN MINUM', 'KASBON', 'PAJAK PERUSAHAAN', 'OPERASIONAL LUAR KOTA',
        'OPERASIONAL', 'OPEX BULANAN', 'PENGELUARAN LAIN-LAIN', 'ADMIN BANK', 'PEMBAYARAN PIUTANG',
        'HPP', 'HPP SISTEM DIGITAL', 'HPP LEGAL', 'HPP DIGITAL MARKETING', 'HPP PERPAJAKAN',
        'CAPEX', 'ASET PERUSAHAAN', 'Penghasilan', 'Kembali Dana',
    ];

    public function test_perusahaan_baru_mendapat_kategori_sistem_transfer_dan_template(): void
    {
        $this->seed(TransactionCategorySeeder::class);

        $this->assertSame('other_expense', TransactionCategory::findSystem('EXP-INTEREST')?->pl_group);
        $this->assertSame('other_income', TransactionCategory::findSystem('REV-INTEREST')?->pl_group);
        foreach (['FIN-LOAN-IN', 'FIN-LOAN-OUT', 'FIN-RCV-OUT', 'FIN-RCV-IN'] as $key) {
            $this->assertSame('financing', TransactionCategory::findSystem($key)?->type, "Kategori sistem {$key} hilang.");
        }

        // Setoran/Penarikan Modal kini dari template (satu definisi), lengkap dengan sub pendanaannya.
        foreach (['Setoran Modal' => ['Setoran Modal Pemilik'], 'Penarikan Modal' => ['Prive Pemilik'], 'Pajak Titipan & PPN' => ['Setor PPN', 'Setor Titipan Pajak Klien']] as $label => $sub) {
            $induk = TransactionCategory::whereNull('parent_id')->where('type', 'financing')->where('label', $label)->sole();
            $this->assertNull($induk->system_key);
            $this->assertEqualsCanonicalizing($sub, $induk->children()->where('type', 'financing')->pluck('label')->all(), "Sub {$label} salah.");
        }

        $antarRekening = TransactionCategory::where('label', 'Antar Rekening Sendiri')->sole();
        $this->assertSame('transfer', $antarRekening->type);
        $this->assertSame('Transfer Internal', $antarRekening->parent->label);

        // 6 kategori tetap (sistem) + 2 transfer + 74 template (15 induk, 59 sub).
        $this->assertSame(82, TransactionCategory::count());
        $this->assertSame(
            ['new' => 0, 'existing' => 74, 'skipped' => 0],
            app(CategoryTemplateService::class)->plan()['summary'],
            'Seluruh template harus sudah terpasang dan tidak ada grup yang tertahan penjaga.'
        );

        $this->assertSame(0, TransactionCategory::whereIn('label', self::LABEL_LAMA)->count(), 'Kategori khas Kisantra masih ikut.');
        $this->assertSame(
            0,
            TransactionCategory::whereIn('type', ['income', 'expense'])->whereNull('pl_group')->count(),
            'Perusahaan baru tidak boleh punya kategori pemasukan/pengeluaran yang belum diklasifikasi.'
        );
    }

    public function test_label_template_tidak_bentrok_dengan_kategori_di_luar_template(): void
    {
        $this->seed(TransactionCategorySeeder::class);

        $template = collect(CategoryTemplateService::TEMPLATE)
            ->flatMap(fn (array $grup): array => [$grup['label'], ...$grup['children']])
            ->map(fn (string $label): string => CategoryTemplateService::normalize($label));

        $luarTemplate = TransactionCategory::query()
            ->where(fn ($q) => $q->whereNotNull('system_key')->orWhere('type', 'transfer'))
            ->pluck('label');

        $this->assertCount(8, $luarTemplate);
        foreach ($luarTemplate as $label) {
            $this->assertNotContains(CategoryTemplateService::normalize($label), $template, "\"{$label}\" bentrok dengan template.");
        }
    }

    public function test_seeder_idempoten_dan_tidak_menimpa_grup_laba_rugi_pilihan_pengguna(): void
    {
        $this->seed(TransactionCategorySeeder::class);
        TransactionCategory::findSystem('EXP-INTEREST')->update(['pl_group' => 'opex']);

        $this->seed(TransactionCategorySeeder::class);

        $this->assertSame(82, TransactionCategory::count());
        $this->assertSame('opex', TransactionCategory::findSystem('EXP-INTEREST')->pl_group);
    }

    public function test_sub_template_bisa_dipilih_di_formulir_transaksi(): void
    {
        $this->seed(TransactionCategorySeeder::class);

        $pengeluaran = collect(TransactionCategory::selectOptions('expense'));
        $this->assertTrue($pengeluaran->contains('label', '↳ Gaji Karyawan'));
        $this->assertTrue($pengeluaran->contains(fn (array $o): bool => $o['label'] === 'Beban Karyawan' && ($o['disabled'] ?? false)));

        $this->assertTrue(collect(TransactionCategory::selectOptions('income'))->contains('label', '↳ Pendapatan Jasa'));
        $this->assertTrue(collect(TransactionCategory::selectOptions('transfer'))->contains('label', '↳ Antar Rekening Sendiri'));

        // Grup Pendanaan: sub template bisa dipilih di Catat Pemasukan & Pengeluaran, kategori sistem tidak.
        foreach (['income', 'expense'] as $tipe) {
            $opsi = collect(TransactionCategory::transactionOptions($tipe));
            $this->assertTrue($opsi->contains(fn (array $o): bool => $o['label'] === '↳ Setor PPN' && ($o['financing'] ?? false) && ! ($o['disabled'] ?? false)));
            $this->assertTrue($opsi->contains(fn (array $o): bool => $o['label'] === 'Pajak Titipan & PPN' && ($o['disabled'] ?? false)));
            $this->assertFalse($opsi->contains('label', '↳ Penerimaan Pinjaman'));
            $this->assertTrue($opsi->last()['financing'] ?? false, 'Grup Pendanaan harus terakhir.');
        }
    }

    public function test_seeder_transaksi_demo_hanya_memakai_sub_kategori(): void
    {
        $this->seed([TransactionCategorySeeder::class, BankAccountSeeder::class, BankTransactionSeeder::class]);

        $transaksi = BankTransaction::with('category')->get();

        $this->assertCount(10, $transaksi);
        foreach ($transaksi as $baris) {
            $this->assertNotNull($baris->category?->parent_id, "\"{$baris->description}\" memakai kategori induk.");
            $this->assertSame($baris->transaction_type === 'credit' ? 'income' : 'expense', $baris->category->type);
        }

        $this->assertSame('Gaji Karyawan', $transaksi->firstWhere('description', 'Gaji Karyawan - Januari')->category->label);
        $this->assertSame('Bunga & Jasa Giro Bank', $transaksi->firstWhere('description', 'Bunga Deposito Bank')->category->label);
    }
}
