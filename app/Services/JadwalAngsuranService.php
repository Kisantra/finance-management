<?php

namespace App\Services;

use App\Models\Loan;
use App\Models\Receivable;
use Carbon\CarbonInterface;

/**
 * Menyusun jadwal angsuran untuk Pinjaman dan Piutang.
 *
 * KENAPA RENCANA-VS-REALISASI, BUKAN "TERMIN KE-3 LUNAS"
 * ------------------------------------------------------
 * `loan_payments` dan `receivable_payments` menyimpan pecahan
 * `principal_paid` / `interest_paid` per pembayaran, dan TIDAK menyimpan nomor
 * termin. Pengguna boleh membayar sebagian, menggabungkan dua termin, atau
 * membayar bunga lebih dulu. Jadi mustahil — dan tidak jujur — mengklaim
 * "termin ke-3 lunas" dari data yang ada.
 *
 * Yang dilakukan di sini: susun jadwal RENCANA dari pokok, bunga, tenor, dan
 * tanggal mulai; lalu alokasikan pembayaran NYATA secara kumulatif ke termin
 * dari yang paling awal. Hasilnya menunjukkan sejauh mana rencana sudah
 * tertutupi, tanpa mengarang keterkaitan yang tidak ada di database.
 *
 * DUA RUMUS BUNGA, SENGAJA TIDAK DISATUKAN
 * ----------------------------------------
 * Pinjaman dan Piutang memakai konvensi berbeda, dan keduanya sudah dipakai
 * controller masing-masing sebelum kelas ini ada:
 *
 *   Pinjaman  : bunga TAHUNAN diprorata — principal x rate/100/12 x term_months
 *   Piutang    : persentase atas SELURUH pokok — principal x rate/100
 *
 * Menyeragamkannya akan mengubah angka pada data yang sudah berjalan. Kelas ini
 * hanya memindahkan rumusnya ke satu tempat, tidak mengubahnya.
 */
class JadwalAngsuranService
{
    /**
     * Total bunga satu pinjaman.
     *
     * Rumus dipindahkan apa adanya dari LoanController::pay(), supaya jadwal
     * yang ditampilkan dan batas pembayaran yang ditegakkan memakai angka yang
     * SAMA. Dua salinan rumus uang pada akhirnya akan menyimpang.
     */
    public function totalBungaPinjaman(Loan $loan): int
    {
        if ($loan->interest_type === 'fixed') {
            return (int) ($loan->interest_amount ?? 0);
        }

        return (int) round(
            $loan->principal_amount * ($loan->interest_rate ?? 0) / 100 / 12 * $loan->term_months
        );
    }

    /** Total bunga satu piutang. Mengikuti ReceivableController::store(). */
    public function totalBungaPiutang(Receivable $receivable): int
    {
        return (int) round($receivable->principal_amount * ($receivable->interest_rate ?? 0) / 100);
    }

    /**
     * @return list<array{
     *     termin:int, jatuh_tempo:string, pokok:int, bunga:int, angsuran:int,
     *     pokok_terbayar:int, bunga_terbayar:int, status:string, terlambat:bool
     * }>
     */
    public function untukPinjaman(Loan $loan): array
    {
        return $this->susun(
            jumlahTermin: (int) $loan->term_months,
            pokok: (int) $loan->principal_amount,
            totalBunga: $this->totalBungaPinjaman($loan),
            mulai: $loan->start_date,
            pokokTerbayar: $this->terbayar($loan, 'principal_paid'),
            bungaTerbayar: $this->terbayar($loan, 'interest_paid'),
        );
    }

    /**
     * @return list<array{
     *     termin:int, jatuh_tempo:string, pokok:int, bunga:int, angsuran:int,
     *     pokok_terbayar:int, bunga_terbayar:int, status:string, terlambat:bool
     * }>
     */
    public function untukPiutang(Receivable $receivable): array
    {
        return $this->susun(
            jumlahTermin: (int) $receivable->installment_months,
            pokok: (int) $receivable->principal_amount,
            totalBunga: $this->totalBungaPiutang($receivable),
            mulai: $receivable->loan_date,
            pokokTerbayar: $this->terbayar($receivable, 'principal_paid'),
            bungaTerbayar: $this->terbayar($receivable, 'interest_paid'),
        );
    }

    /**
     * Jumlah terbayar suatu kolom pembayaran. Daftar yang memuat `withSum('payments', ...)`
     * memakai hasil itu (tanpa query per baris); selain itu dijumlah langsung. Dicek dengan
     * array_key_exists, bukan `??`: withSum tanpa pembayaran bernilai NULL, dan `??` akan
     * diam-diam kembali menjalankan satu query per baris.
     */
    private function terbayar(Loan|Receivable $model, string $kolom): int
    {
        $alias = "payments_sum_{$kolom}";

        return (int) (array_key_exists($alias, $model->getAttributes())
            ? $model->getAttribute($alias)
            : $model->payments()->sum($kolom));
    }

    /**
     * @return list<array{
     *     termin:int, jatuh_tempo:string, pokok:int, bunga:int, angsuran:int,
     *     pokok_terbayar:int, bunga_terbayar:int, status:string, terlambat:bool
     * }>
     */
    private function susun(
        int $jumlahTermin,
        int $pokok,
        int $totalBunga,
        ?CarbonInterface $mulai,
        int $pokokTerbayar,
        int $bungaTerbayar,
    ): array {
        if ($jumlahTermin < 1 || $mulai === null) {
            return [];
        }

        // Pembagian rupiah TIDAK boleh menyisakan receh. Sisa pembagian
        // ditumpuk ke termin TERAKHIR, sehingga jumlah seluruh termin selalu
        // sama persis dengan pokok + bunga — kalau tidak, total jadwal meleset
        // beberapa rupiah dari nilai utangnya dan angka di layar tidak bisa
        // dipertanggungjawabkan.
        $pokokPerTermin = intdiv($pokok, $jumlahTermin);
        $bungaPerTermin = intdiv($totalBunga, $jumlahTermin);
        $sisaPokok = $pokok - ($pokokPerTermin * $jumlahTermin);
        $sisaBunga = $totalBunga - ($bungaPerTermin * $jumlahTermin);

        $hariIni = now()->startOfDay();
        $jadwal = [];

        // Alokasi kumulatif: pembayaran menutupi termin dari yang paling awal.
        $sisaPokokTerbayar = $pokokTerbayar;
        $sisaBungaTerbayar = $bungaTerbayar;

        for ($i = 1; $i <= $jumlahTermin; $i++) {
            $terakhir = $i === $jumlahTermin;

            $pokokTermin = $pokokPerTermin + ($terakhir ? $sisaPokok : 0);
            $bungaTermin = $bungaPerTermin + ($terakhir ? $sisaBunga : 0);

            $pokokDitutup = min($sisaPokokTerbayar, $pokokTermin);
            $bungaDitutup = min($sisaBungaTerbayar, $bungaTermin);
            $sisaPokokTerbayar -= $pokokDitutup;
            $sisaBungaTerbayar -= $bungaDitutup;

            $tagihan = $pokokTermin + $bungaTermin;
            $tertutup = $pokokDitutup + $bungaDitutup;

            $status = match (true) {
                $tagihan === 0 || $tertutup >= $tagihan => 'lunas',
                $tertutup > 0 => 'sebagian',
                default => 'belum',
            };

            $jatuhTempo = $mulai->copy()->addMonthsNoOverflow($i);

            $jadwal[] = [
                'termin' => $i,
                'jatuh_tempo' => $jatuhTempo->toDateString(),
                'pokok' => $pokokTermin,
                'bunga' => $bungaTermin,
                'angsuran' => $tagihan,
                'pokok_terbayar' => $pokokDitutup,
                'bunga_terbayar' => $bungaDitutup,
                'status' => $status,
                'terlambat' => $status !== 'lunas' && $jatuhTempo->lt($hariIni),
            ];
        }

        return $jadwal;
    }
}
