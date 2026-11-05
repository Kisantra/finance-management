<?php

namespace Tests\Feature;

use App\Exports\ArusKasExport;
use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\TransactionCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Maatwebsite\Excel\Facades\Excel;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Arus Kas › tab Semua (pemasukan + pengeluaran) dan kolom/filter "Diinput oleh" di ketiga tab.
 */
class ArusKasSemuaTest extends TestCase
{
    use RefreshDatabase;

    private User $keduanya;

    private User $hanyaMasuk;

    private User $ani;

    private User $budi;

    private BankAccount $bca;

    private BankAccount $mandiri;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
        foreach (['view income', 'view expense', 'view transfer'] as $izin) {
            Permission::firstOrCreate(['name' => $izin]);
        }

        $this->keduanya = User::factory()->create();
        $this->keduanya->givePermissionTo(['view income', 'view expense']);
        $this->hanyaMasuk = User::factory()->create();
        $this->hanyaMasuk->givePermissionTo('view income');

        $this->ani = User::factory()->create(['name' => 'Ani Kasir']);
        $this->budi = User::factory()->create(['name' => 'Budi Finance']);
        $this->bca = BankAccount::factory()->create(['bank_name' => 'BCA', 'initial_balance' => 0]);
        $this->mandiri = BankAccount::factory()->create(['bank_name' => 'Mandiri', 'initial_balance' => 0]);

        $pemasukan = TransactionCategory::create(['type' => 'income', 'label' => 'Pendapatan Lain']);
        $pengeluaran = TransactionCategory::create(['type' => 'expense', 'label' => 'Listrik']);
        $transfer = TransactionCategory::create(['type' => 'transfer', 'label' => 'Transfer Internal']);
        $pendanaan = TransactionCategory::create(['type' => 'financing', 'label' => 'Penerimaan Pinjaman']);

        Payment::factory()->create([
            'invoice_id' => Invoice::factory()->sent()->create(['billed_to_id' => Client::factory()->create(['name' => 'PT Klien Uji'])->id])->id,
            'bank_account_id' => $this->bca->id,
            'amount' => 500_000,
            'payment_date' => '2026-11-03',
            'created_by' => $this->ani->id,
        ]);
        $this->transaksi($this->bca, $pemasukan, 'credit', 300_000, '2026-11-02', $this->ani->id, 'Bunga giro');
        $this->transaksi($this->mandiri, $pengeluaran, 'debit', 120_000, '2026-11-04', $this->budi->id, 'Tagihan listrik');
        $this->transaksi($this->mandiri, $pengeluaran, 'debit', 80_000, '2026-11-01', null, 'Data lama');
        // Bukan pemasukan/pengeluaran: tidak boleh masuk tab Semua.
        $this->transaksi($this->bca, $transfer, 'credit', 1_000_000, '2026-11-02', $this->ani->id, 'Pindah dana');
        $this->transaksi($this->bca, $pendanaan, 'credit', 5_000_000, '2026-11-02', $this->ani->id, 'Pencairan pinjaman');
    }

    public function test_tab_semua_menggabungkan_pemasukan_dan_pengeluaran_tanpa_transfer_dan_pendanaan(): void
    {
        $this->actingAs($this->keduanya)
            ->get('/cash-flow/all')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('cash-flow/all')
                ->where('stats.total_in', 800_000)
                ->where('stats.total_out', 200_000)
                ->where('stats.net', 600_000)
                ->where('stats.total_count', 4)
                ->has('rows', 4)
                ->where('rows.0.description', 'Tagihan listrik')
                ->where('rows.0.direction', 'out')
                ->where('rows.0.input_by', 'Budi Finance')
                ->where('rows.1.source_type', 'payment')
                ->where('rows.1.client_name', 'PT Klien Uji')
                ->where('rows.1.input_by', 'Ani Kasir')
                ->where('rows.3.description', 'Data lama')
                ->where('rows.3.input_by', null)
                ->where('inputByOptions', [
                    ['label' => 'Ani Kasir', 'value' => $this->ani->id],
                    ['label' => 'Budi Finance', 'value' => $this->budi->id],
                ])
                ->has('incomeCategoryOptions')
                ->has('expenseCategoryOptions')
                ->missing('categoryOptions')
            );
    }

    public function test_filter_diinput_oleh_dan_rekening(): void
    {
        $this->actingAs($this->keduanya)
            ->get('/cash-flow/all?input_by='.$this->ani->id)
            ->assertInertia(fn (Assert $page) => $page
                ->has('rows', 2)
                ->where('stats.total_in', 800_000)
                ->where('stats.total_out', 0)
                ->where('filters.input_by', $this->ani->id)
            );

        $this->actingAs($this->keduanya)
            ->get('/cash-flow/all?bank_accounts='.$this->mandiri->id)
            ->assertInertia(fn (Assert $page) => $page
                ->has('rows', 2)
                ->where('stats.total_in', 0)
                ->where('stats.total_out', 200_000)
            );
    }

    public function test_tab_semua_butuh_izin_pemasukan_dan_pengeluaran(): void
    {
        $this->actingAs($this->hanyaMasuk)->get('/cash-flow/all')->assertForbidden();
        $this->actingAs($this->hanyaMasuk)->get('/cash-flow/all/export/excel')->assertForbidden();
        $this->actingAs($this->hanyaMasuk)->get('/cash-flow')->assertRedirect($this->prefixCompanyUri('/cash-flow/income'));
        $this->actingAs($this->keduanya)->get('/cash-flow')->assertRedirect($this->prefixCompanyUri('/cash-flow/all'));
    }

    public function test_ekspor_excel_memakai_filter_yang_sama(): void
    {
        Excel::fake();

        $this->actingAs($this->keduanya)->get('/cash-flow/all/export/excel?input_by='.$this->budi->id)->assertOk();

        Excel::assertDownloaded('arus-kas_semua-waktu.xlsx', function (ArusKasExport $ekspor): bool {
            $baris = $ekspor->array();

            return count($baris) === 1
                && $baris[0][1] === 'Keluar'
                && $baris[0][6] === 'Budi Finance'
                && $baris[0][8] === 120_000;
        });
    }

    public function test_tab_pemasukan_dan_pengeluaran_punya_kolom_dan_filter_pencatat(): void
    {
        $this->actingAs($this->keduanya)
            ->get('/cash-flow/income?input_by='.$this->ani->id)
            ->assertInertia(fn (Assert $page) => $page
                ->has('rows', 2)
                ->where('rows.0.input_by', 'Ani Kasir')
                ->where('rows.1.input_by', 'Ani Kasir')
                ->has('inputByOptions', 2)
            );

        $this->actingAs($this->keduanya)
            ->get('/cash-flow/expenses')
            ->assertInertia(fn (Assert $page) => $page
                ->has('rows', 2)
                ->where('rows.0.input_by', 'Budi Finance')
                ->where('rows.1.input_by', null)
            );
    }

    private function transaksi(BankAccount $rekening, TransactionCategory $kategori, string $tipe, int $jumlah, string $tanggal, ?int $pencatat, string $keterangan): void
    {
        BankTransaction::factory()->create([
            'bank_account_id' => $rekening->id,
            'category_id' => $kategori->id,
            'transaction_type' => $tipe,
            'amount' => $jumlah,
            'transaction_date' => $tanggal,
            'description' => $keterangan,
            'reference_number' => null,
            'created_by' => $pencatat,
        ]);
    }
}
