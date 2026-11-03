<?php

namespace Tests\Feature;

use App\Models\Loan;
use App\Models\Receivable;
use App\Models\User;
use App\Services\JadwalAngsuranService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Jadwal angsuran adalah angka yang dibaca pengguna untuk memutuskan membayar.
 * Dua invarian yang tidak boleh dilanggar diuji di sini:
 *
 *  1. Jumlah seluruh termin PERSIS sama dengan pokok + bunga. Pembagian rupiah
 *     menyisakan receh; kalau recehnya hilang, total jadwal meleset dari nilai
 *     utangnya dan tidak ada yang bisa mempertanggungjawabkan selisihnya.
 *  2. Rumus bunganya sama persis dengan yang dipakai controller saat MENOLAK
 *     pembayaran berlebih. Dua salinan rumus uang pada akhirnya menyimpang, dan
 *     yang menyimpang di sini berarti layar menjanjikan angka yang ditolak
 *     server.
 */
class JadwalAngsuranServiceTest extends TestCase
{
    use RefreshDatabase;

    private JadwalAngsuranService $jadwal;

    protected function setUp(): void
    {
        parent::setUp();
        $this->jadwal = app(JadwalAngsuranService::class);
    }

    public function test_jumlah_seluruh_termin_sama_persis_dengan_pokok_tambah_bunga(): void
    {
        // 10.000.000 / 3 dan bunga 12%/tahun selama 3 bulan — keduanya
        // sengaja tidak habis dibagi, supaya recehnya benar-benar diuji.
        $loan = Loan::create([
            'loan_number' => 'PJM/UJI/001',
            'lender_name' => 'Bank Uji',
            'principal_amount' => 10_000_000,
            'interest_type' => 'percentage',
            'interest_rate' => 12,
            'term_months' => 3,
            'start_date' => '2026-01-10',
            'maturity_date' => '2026-04-10',
            'status' => 'active',
        ]);

        $baris = $this->jadwal->untukPinjaman($loan);
        $totalBunga = $this->jadwal->totalBungaPinjaman($loan);

        $this->assertCount(3, $baris);

        $this->assertSame(
            10_000_000,
            array_sum(array_column($baris, 'pokok')),
            'Jumlah pokok seluruh termin tidak sama dengan pokok pinjaman — ada rupiah yang hilang saat pembagian.'
        );

        $this->assertSame(
            $totalBunga,
            array_sum(array_column($baris, 'bunga')),
            'Jumlah bunga seluruh termin tidak sama dengan total bunga.'
        );

        $this->assertSame(
            10_000_000 + $totalBunga,
            array_sum(array_column($baris, 'angsuran')),
            'Total jadwal meleset dari nilai utang.'
        );
    }

    /**
     * Rumus bunga pinjaman: TAHUNAN, diprorata per bulan.
     * 10.000.000 x 12% / 12 x 3 bulan = 300.000.
     */
    public function test_bunga_pinjaman_dihitung_tahunan_lalu_diprorata(): void
    {
        $loan = Loan::create([
            'loan_number' => 'PJM/UJI/002',
            'lender_name' => 'Bank Uji',
            'principal_amount' => 10_000_000,
            'interest_type' => 'percentage',
            'interest_rate' => 12,
            'term_months' => 3,
            'start_date' => '2026-01-10',
            'maturity_date' => '2026-04-10',
            'status' => 'active',
        ]);

        $this->assertSame(300_000, $this->jadwal->totalBungaPinjaman($loan));
    }

    /**
     * Rumus bunga piutang BERBEDA: persentase atas seluruh pokok, tidak
     * diprorata per bulan. 10.000.000 x 12% = 1.200.000.
     *
     * Perbedaan ini disengaja dan sudah berlaku sebelum service ini ada;
     * menyamakannya akan mengubah angka pada data yang sudah berjalan.
     */
    public function test_bunga_piutang_dihitung_atas_seluruh_pokok_tanpa_prorata(): void
    {
        $receivable = $this->piutang(principal: 10_000_000, rate: 12, bulan: 3);

        $this->assertSame(1_200_000, $this->jadwal->totalBungaPiutang($receivable));
    }

    public function test_termin_ditandai_lunas_sebagian_dan_belum_sesuai_pembayaran(): void
    {
        $receivable = $this->piutang(principal: 3_000_000, rate: 0, bulan: 3);

        // Pokok 1.000.000 per termin. Bayar 1.500.000 -> termin 1 lunas,
        // termin 2 sebagian, termin 3 belum.
        $receivable->payments()->create([
            'payment_date' => '2026-02-01',
            'principal_paid' => 1_500_000,
            'interest_paid' => 0,
            'total_paid' => 1_500_000,
        ]);

        $baris = $this->jadwal->untukPiutang($receivable->fresh());

        $this->assertSame(
            ['lunas', 'sebagian', 'belum'],
            array_column($baris, 'status'),
            'Alokasi kumulatif salah: pembayaran harus menutupi termin dari yang paling awal.'
        );
    }

    public function test_termin_lewat_tempo_yang_belum_lunas_ditandai_terlambat(): void
    {
        // Mulai 6 bulan lalu, tenor 3 bulan: seluruh terminnya sudah lewat.
        $receivable = $this->piutang(
            principal: 3_000_000,
            rate: 0,
            bulan: 3,
            mulai: now()->subMonths(6)->toDateString(),
        );

        $baris = $this->jadwal->untukPiutang($receivable);

        $this->assertSame(
            [true, true, true],
            array_column($baris, 'terlambat'),
            'Termin yang jatuh temponya sudah lewat dan belum lunas harus ditandai terlambat.'
        );
    }

    public function test_tanggal_jatuh_tempo_tidak_melompat_bulan_pada_tanggal_31(): void
    {
        // 31 Januari + 1 bulan harus 28/29 Februari, bukan 2 atau 3 Maret.
        $receivable = $this->piutang(principal: 2_000_000, rate: 0, bulan: 2, mulai: '2026-01-31');

        $baris = $this->jadwal->untukPiutang($receivable);

        $this->assertSame('2026-02-28', $baris[0]['jatuh_tempo']);
        $this->assertSame('2026-03-31', $baris[1]['jatuh_tempo']);
    }

    public function test_jadwal_kosong_bila_tenor_tidak_masuk_akal(): void
    {
        $receivable = $this->piutang(principal: 1_000_000, rate: 0, bulan: 0);

        $this->assertSame([], $this->jadwal->untukPiutang($receivable));
    }

    private function piutang(int $principal, float $rate, int $bulan, ?string $mulai = null): Receivable
    {
        $mulai ??= '2026-01-10';
        $bunga = (int) round($principal * $rate / 100);

        return Receivable::create([
            'receivable_number' => 'PIUT/UJI/'.uniqid(),
            'type' => 'employee_loan',
            'debtor_type' => User::class,
            'debtor_id' => User::factory()->create()->id,
            'principal_amount' => $principal,
            'interest_rate' => $rate,
            'installment_months' => $bulan,
            'installment_amount' => $bulan > 0 ? (int) round(($principal + $bunga) / $bulan) : 0,
            'loan_date' => $mulai,
            'due_date' => now()->parse($mulai)->addMonths(max($bulan, 1))->toDateString(),
            'status' => 'active',
        ]);
    }
}
