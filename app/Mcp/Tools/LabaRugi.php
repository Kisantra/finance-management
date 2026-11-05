<?php

namespace App\Mcp\Tools;

use App\Models\Company;
use App\Services\ProfitLossService;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Request;

/**
 * Laporan Laba Rugi. Angkanya dihitung ProfitLossService::generate() persis seperti
 * ProfitLossReportController (periode bawaan awal tahun s/d hari ini, batas start/end hari);
 * alat ini hanya meringkas bentuknya: rincian per kategori menjadi peta label → jumlah.
 */
class LabaRugi extends AlatKeuangan
{
    protected string $name = 'laba-rugi';

    protected string $description = 'Laporan Laba Rugi, sama dengan halaman Laporan › Laba Rugi. Basis kas: pendapatan invoice diakui saat dibayar, setelah menutup titipan pajak lalu PPN keluaran (keduanya bukan pendapatan); HPP invoice metode cost-recovery (uang masuk menutup modal dulu). Baris lain dari transaksi bank menurut grup Laba Rugi kategorinya; transfer dan pendanaan (pokok pinjaman/piutang) tidak masuk. Bawaan periode: 1 Januari tahun berjalan s/d hari ini. belum_diklasifikasi = transaksi tanpa kategori atau kategorinya belum bergrup Laba Rugi: TIDAK masuk total mana pun, jadi laba belum final selama masih ada. ppn_keluaran_diterima hanya catatan, bukan pendapatan.';

    protected function izin(): string
    {
        return 'view profit-loss';
    }

    protected function skemaTambahan(JsonSchema $schema): array
    {
        return [
            'dari' => $schema->string()->format('date')
                ->description('Awal periode, YYYY-MM-DD. Bawaan: 1 Januari tahun berjalan.'),
            'sampai' => $schema->string()->format('date')
                ->description('Akhir periode (ikut dihitung), YYYY-MM-DD. Bawaan: hari ini.'),
        ];
    }

    protected function jalankan(Request $request, Company $perusahaan): array
    {
        [$dari, $sampai] = $this->periode($request);

        $laporan = app(ProfitLossService::class)->generate(
            Carbon::parse($dari)->startOfDay(),
            Carbon::parse($sampai)->endOfDay(),
        );

        $belumDiklasifikasi = $laporan['unclassified']['income']['total'] + $laporan['unclassified']['expense']['total'];

        return [
            'periode' => ['dari' => $laporan['period']['start'], 'sampai' => $laporan['period']['end']],
            'pendapatan' => [
                'dari_invoice' => $laporan['revenue']['invoice'],
                'per_kategori' => $this->perLabel($laporan['revenue']['non_invoice_by_category']),
                'total' => $laporan['revenue']['total'],
            ],
            'hpp' => [
                'dari_invoice' => $laporan['cogs']['invoice'],
                'per_kategori' => $this->perLabel($laporan['cogs']['manual_by_category']),
                'total' => $laporan['cogs']['total'],
            ],
            'laba_kotor' => $laporan['gross_profit'],
            'beban_operasional' => $this->kelompok($laporan['opex']),
            'laba_usaha' => $laporan['operating_profit'],
            'pendapatan_lain' => $this->kelompok($laporan['other_income']),
            'beban_lain' => $this->kelompok($laporan['other_expense']),
            'laba_sebelum_pajak' => $laporan['pre_tax_profit'],
            'pajak' => $this->kelompok($laporan['tax']),
            'laba_bersih' => $laporan['net_profit'],
            'ppn_keluaran_diterima' => $laporan['ppn_output'],
            'belum_diklasifikasi' => [
                'pemasukan' => $this->kelompok($laporan['unclassified']['income']),
                'pengeluaran' => $this->kelompok($laporan['unclassified']['expense']),
            ],
            ...($belumDiklasifikasi > 0 ? [
                'peringatan' => 'Ada transaksi belum diklasifikasi (lihat belum_diklasifikasi) yang tidak ikut dihitung: laba di atas belum final. Beri grup Laba Rugi pada kategorinya di Kategori Transaksi, atau beri kategori bila tanpa kategori.',
            ] : []),
        ];
    }

    /**
     * @param  array{by_category: list<array{category_id: int|null, category_label: string, amount: int}>, total: int}  $kelompok
     * @return array{per_kategori: object, total: int}
     */
    private function kelompok(array $kelompok): array
    {
        return [
            'per_kategori' => $this->perLabel($kelompok['by_category']),
            'total' => $kelompok['total'],
        ];
    }

    /**
     * Rincian kategori sebagai peta label → jumlah (urutan label, sama dengan halaman).
     * Label kembar dijumlahkan agar totalnya tetap utuh. Dikembalikan sebagai objek supaya
     * rincian kosong tetap ter-encode `{}`, bukan `[]`.
     *
     * @param  list<array{category_id: int|null, category_label: string, amount: int}>  $baris
     */
    private function perLabel(array $baris): object
    {
        $peta = [];

        foreach ($baris as $kategori) {
            $peta[$kategori['category_label']] = ($peta[$kategori['category_label']] ?? 0) + $kategori['amount'];
        }

        return (object) $peta;
    }

    /**
     * Periode laporan; bawaan sama dengan ProfitLossReportController::resolvePeriod().
     *
     * @return array{0: string, 1: string}
     *
     * @throws ValidationException
     */
    private function periode(Request $request): array
    {
        $data = $request->validate([
            'dari' => ['nullable', 'date_format:Y-m-d'],
            'sampai' => ['nullable', 'date_format:Y-m-d'],
        ], [
            'dari' => 'dari harus tanggal berformat YYYY-MM-DD, mis. 2026-01-01.',
            'sampai' => 'sampai harus tanggal berformat YYYY-MM-DD, mis. 2026-12-31.',
        ]);

        $dari = filled($data['dari'] ?? null) ? (string) $data['dari'] : today()->startOfYear()->toDateString();
        $sampai = filled($data['sampai'] ?? null) ? (string) $data['sampai'] : today()->toDateString();

        if ($sampai < $dari) {
            throw ValidationException::withMessages([
                'sampai' => "Rentang tanggal tidak valid: sampai ({$sampai}) lebih awal dari dari ({$dari}). Kirim dari dan sampai bersama, dengan sampai sama dengan atau setelah dari.",
            ]);
        }

        return [$dari, $sampai];
    }
}
