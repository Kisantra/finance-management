<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Feedback;
use App\Models\Loan;
use App\Models\Receivable;
use App\Models\Service;
use App\Models\TransactionCategory;
use App\Models\User;
use Database\Seeders\TransactionCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Lang;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Teks server mengikuti bahasa pengguna (flash, validasi, notifikasi), sementara teks yang DISIMPAN
 * ke database tetap Bahasa Indonesia (aturan emas, D7/D8). Kunci terjemahan belum diisi penerjemah,
 * jadi penangan kunci hilang dipasang: kunci yang diterjemahkan di bahasa zh tampil berawalan "[zh] ".
 */
class TeksServerLokaleTest extends TestCase
{
    use RefreshDatabase;

    /** @var list<string> */
    private const IZIN = [
        'view services', 'delete services',
        'create bank-accounts', 'view bank-accounts',
        'view loans', 'pay loans',
        'view receivables', 'pay receivables',
        'create transfer',
        'view feedbacks', 'create feedbacks', 'respond feedbacks', 'manage feedbacks',
    ];

    private User $adminZh;

    private User $adminId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(TransactionCategorySeeder::class);
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        foreach (self::IZIN as $izin) {
            Permission::firstOrCreate(['name' => $izin]);
        }
        Role::firstOrCreate(['name' => 'admin'])->syncPermissions(self::IZIN);
        Role::firstOrCreate(['name' => 'finance manager']);

        $this->adminZh = User::factory()->create(['locale' => 'zh']);
        $this->adminZh->assignRole('admin');
        $this->adminId = User::factory()->create(['locale' => 'id']);
        $this->adminId->assignRole('admin');

        Lang::handleMissingKeysUsing(
            fn (string $key, array $replace, ?string $locale): string => ($locale ?? App::getLocale()) === 'zh' ? "[zh] {$key}" : $key,
        );
    }

    protected function tearDown(): void
    {
        Lang::handleMissingKeysUsing(null);
        App::setLocale('id');

        parent::tearDown();
    }

    public function test_flash_mengikuti_bahasa_pengguna(): void
    {
        $this->actingAs($this->adminZh)
            ->delete('/services/'.Service::factory()->create()->id)
            ->assertSessionHas('success', '[zh] Layanan berhasil dihapus.');

        $this->actingAs($this->adminId)
            ->delete('/services/'.Service::factory()->create()->id)
            ->assertSessionHas('success', 'Layanan berhasil dihapus.');
    }

    public function test_pesan_validasi_form_request_mengikuti_bahasa_pengguna(): void
    {
        $this->actingAs($this->adminZh)->post('/bank-accounts', [])
            ->assertSessionHasErrors(['account_name' => '[zh] Nama akun wajib diisi.']);

        $this->actingAs($this->adminId)->post('/bank-accounts', [])
            ->assertSessionHasErrors(['account_name' => 'Nama akun wajib diisi.']);
    }

    public function test_pesan_dengan_nilai_diterjemahkan_lalu_nilainya_diisi(): void
    {
        $loan = Loan::create([
            'loan_number' => 'LN-001', 'lender_name' => 'Bank Mandiri', 'principal_amount' => 1_000_000,
            'interest_type' => 'fixed', 'interest_amount' => 0, 'term_months' => 12,
            'start_date' => '2026-01-01', 'maturity_date' => '2027-01-01', 'status' => 'active',
        ]);

        $this->actingAs($this->adminZh)->post("/loans/{$loan->id}/pay", [
            'bank_account_id' => BankAccount::factory()->create(['initial_balance' => 5_000_000])->id,
            'payment_date' => '2026-02-01',
            'principal_paid' => 2_000_000,
            'interest_paid' => 0,
        ])->assertSessionHasErrors(['principal_paid' => '[zh] Pembayaran pokok melebihi sisa pokok (Rp 1.000.000).']);
    }

    public function test_deskripsi_tersimpan_tetap_indonesia_dan_tautan_modul_jalan_di_bahasa_zh(): void
    {
        $bank = BankAccount::factory()->create(['initial_balance' => 50_000_000]);
        $tujuan = BankAccount::factory()->create(['initial_balance' => 0]);

        $loan = Loan::create([
            'loan_number' => 'LN-001', 'lender_name' => 'Bank Mandiri', 'principal_amount' => 10_000_000,
            'interest_type' => 'fixed', 'interest_amount' => 500_000, 'term_months' => 12,
            'start_date' => '2026-01-01', 'maturity_date' => '2027-01-01', 'status' => 'active',
        ]);
        $this->actingAs($this->adminZh)->post("/loans/{$loan->id}/pay", [
            'bank_account_id' => $bank->id, 'payment_date' => '2026-02-01',
            'principal_paid' => 1_000_000, 'interest_paid' => 50_000,
        ])->assertSessionHasNoErrors();

        $pokokUtang = BankTransaction::query()
            ->where('category_id', TransactionCategory::findSystem('FIN-LOAN-OUT')->id)->sole();
        $this->assertSame('Pembayaran pokok pinjaman - Bank Mandiri', $pokokUtang->description);
        $this->assertSame('Bank Mandiri', BankTransaction::lenderFromDescription($pokokUtang->description));

        $debitur = User::factory()->create();
        $piutang = Receivable::create([
            'receivable_number' => 'RCV-00001', 'type' => 'employee_loan', 'debtor_type' => User::class,
            'debtor_id' => $debitur->id, 'principal_amount' => 2_000_000, 'interest_rate' => 10,
            'loan_date' => '2026-01-01', 'status' => 'active',
        ]);
        $this->actingAs($this->adminZh)->post("/receivables/{$piutang->id}/pay", [
            'bank_account_id' => $bank->id, 'payment_date' => '2026-02-01',
            'principal_paid' => 500_000, 'interest_paid' => 0, 'payment_method' => 'bank_transfer',
        ])->assertSessionHasNoErrors();

        $pokokPiutang = BankTransaction::query()
            ->where('category_id', TransactionCategory::findSystem('FIN-RCV-IN')->id)->sole();
        $this->assertStringStartsWith('Pembayaran piutang pokok: RCV-00001 - ', $pokokPiutang->description);
        $this->assertSame('RCV-00001', BankTransaction::receivableNumberFromDescription($pokokPiutang->description));

        $antarRekening = TransactionCategory::create(['label' => 'Antar Rekening Sendiri', 'type' => 'transfer']);
        $this->actingAs($this->adminZh)->post('/bank-transactions/transfer', [
            'from_account_id' => $bank->id, 'to_account_id' => $tujuan->id, 'category_id' => $antarRekening->id,
            'amount' => 1_000_000, 'admin_fee' => 6_500, 'description' => 'Isi ulang', 'transfer_date' => '2026-02-02',
        ])->assertSessionHasNoErrors();

        $this->assertSame(
            ['Transfer + Admin Fee - Isi ulang', 'Transfer masuk - Isi ulang'],
            BankTransaction::query()->whereNotNull('transfer_group_id')->orderBy('id')->pluck('description')->all(),
        );
    }

    public function test_sumber_deskripsi_tersimpan_tidak_dibungkus_terjemahan(): void
    {
        foreach (['BankTransaction', 'Loan', 'Receivable', 'FundRequest'] as $nama) {
            $kode = (string) file_get_contents(base_path("app/Http/Controllers/{$nama}Controller.php"));

            $this->assertDoesNotMatchRegularExpression(
                '/[\'"]description[\'"]\s*=>\s*__\(/',
                $kode,
                "Deskripsi tersimpan di {$nama}Controller dibaca ulang kode lain dan tidak boleh lewat __().",
            );
        }
    }

    public function test_notifikasi_baru_tersimpan_indonesia_dan_tampil_dalam_bahasa_pembaca(): void
    {
        $pelapor = User::factory()->create(['locale' => 'zh']);
        $pelapor->assignRole(Role::firstOrCreate(['name' => 'staff']));
        $feedback = Feedback::create([
            'user_id' => $pelapor->id, 'title' => 'Tombol macet', 'description' => 'Tidak bisa diklik.',
            'type' => 'bug', 'priority' => 'high', 'status' => 'open',
        ]);

        $this->actingAs($this->adminId)
            ->post("/feedbacks/{$feedback->id}/respond", ['response' => 'Sedang dicek.', 'status' => 'in_progress'])
            ->assertSessionHasNoErrors();

        $tersimpan = AppNotification::query()->where('user_id', $pelapor->id)->sole();
        $this->assertSame('Tanggapan Masukan', $tersimpan->title);
        $this->assertSame('Masukan "Tombol macet" telah ditanggapi oleh '.$this->adminId->name, $tersimpan->message);
        $this->assertSame('Tanggapan Masukan', $tersimpan->data['i18n']['title']);

        $respons = $this->actingAs($pelapor)->getJson('/notifications')->assertOk();
        $respons->assertJsonPath('items.0.title', '[zh] Tanggapan Masukan');
        $respons->assertJsonPath('items.0.message', '[zh] Masukan "Tombol macet" telah ditanggapi oleh '.$this->adminId->name);

        $this->actingAs(User::query()->find($pelapor->id)->forceFill(['locale' => 'id']))
            ->getJson('/notifications')
            ->assertJsonPath('items.0.title', 'Tanggapan Masukan');
    }

    public function test_notifikasi_jenis_masukan_baru_menerjemahkan_label_jenis(): void
    {
        $this->adminZh->companies()->syncWithoutDetaching([self::TEST_COMPANY]);

        $this->actingAs($this->adminId)->post('/feedbacks', [
            'type' => 'feature', 'priority' => 'low', 'title' => 'Judul uji', 'description' => 'Deskripsi uji.',
        ])->assertSessionHasNoErrors();

        $tersimpan = AppNotification::query()->where('user_id', $this->adminZh->id)->sole();
        $this->assertSame('Masukan Baru', $tersimpan->title);
        $this->assertStringContainsString('mengirim Fitur: Judul uji', $tersimpan->message);

        $this->actingAs($this->adminZh)->getJson('/notifications')
            ->assertJsonPath('items.0.title', '[zh] Masukan Baru')
            ->assertJsonPath('items.0.message', '[zh] '.$this->adminId->name.' mengirim '.__('feedback.type_feature', [], 'zh').': Judul uji');
    }

    public function test_notifikasi_lama_tanpa_i18n_tampil_apa_adanya(): void
    {
        AppNotification::notify($this->adminZh->id, 'invoice_created', 'Invoice Baru', 'Invoice 001 dibuat');

        $this->actingAs($this->adminZh)->getJson('/notifications')
            ->assertOk()
            ->assertJsonPath('items.0.title', 'Invoice Baru')
            ->assertJsonPath('items.0.message', 'Invoice 001 dibuat');
    }

    public function test_halaman_error_tampil_dalam_bahasa_pengguna_tetapi_laporan_tetap_indonesia(): void
    {
        config(['app.debug' => false]);

        $this->actingAs($this->adminZh)->get('/_uji/tidak-ada')
            ->assertNotFound()
            ->assertInertia(fn (Assert $page) => $page
                ->component('error', false)
                ->where('title', '[zh] Halaman tidak ditemukan')
                ->where('home_label', '[zh] Pilih Perusahaan')
                ->where('report.fields.0.value', '404 — Halaman tidak ditemukan'));
    }
}
