<?php

namespace Database\Seeders\DataPerusahaan;

use App\Models\TransactionCategory;

/**
 * Kategori tambahan untuk usaha bongkar muat, keagenan kapal, dan holding Mitra Group — di atas
 * template bawaan (CategoryTemplateService) yang sudah ada di setiap perusahaan baru. Sub yang
 * induknya label template (mis. "Beban Karyawan") ditempel ke induk template itu.
 *
 * Mutasi Dana Internal (financing, tidak masuk Laba Rugi): Arus Kas di data mentah mencatat uang
 * yang berpindah ke/dari staf keuangan (persiapan dana PNBP, isi ulang petty cash, refund kelebihan
 * dana, saldo pindahan bulan) sebagai pemasukan/pengeluaran biasa. Baris itu tetap diimpor apa
 * adanya agar total cocok dengan sheet, tetapi kategorinya pendanaan supaya tidak terhitung dua
 * kali sebagai biaya. Dana Titipan (juga financing) menampung penerimaan yang bukan pendapatan
 * perusahaan ini: salah transfer, pelunasan invoice perusahaan lain, dan penerimaan yang invoicenya
 * sudah lunas (kemungkinan tercatat dua kali di sheet).
 */
final class KategoriImpor
{
    /**
     * @var list<array{type: string, label: string, pl_group: string|null, children: list<string>}>
     */
    public const KATEGORI = [
        [
            'type' => 'expense',
            'label' => 'Biaya Operasional Pelabuhan & Kapal',
            'pl_group' => 'cogs',
            'children' => [
                'Upah TKBM (Bongkar Muat)', 'Sewa Alat Berat', 'PNBP Kepelabuhanan', 'Mooring & Unmooring',
                'Foreman, Tally & Lembur Lapangan', 'Jasa Pandu & Tunda', 'Sewa Kendaraan & Speedboat',
                'BBM Operasional Kapal', 'Jasa PBM & Subkon Grup', 'Clearance & Dokumen Kapal',
                'Koordinasi & Pengkondisian Lapangan', 'Biaya Operasional Kapal Lainnya',
            ],
        ],
        [
            'type' => 'expense',
            'label' => 'Beban Karyawan',
            'pl_group' => 'opex',
            'children' => ['Kontribusi Biaya Holding', 'Kegiatan Karyawan & Grup'],
        ],
        [
            'type' => 'expense',
            'label' => 'Beban Administrasi & Umum',
            'pl_group' => 'opex',
            'children' => ['Biaya Operasional Direksi', 'Iuran Asosiasi (APBMI)'],
        ],
        [
            'type' => 'expense',
            'label' => 'Beban Lain-lain',
            'pl_group' => 'other_expense',
            'children' => ['Beban Lainnya'],
        ],
        [
            'type' => 'income',
            'label' => 'Pendapatan Lain-lain',
            'pl_group' => 'other_income',
            'children' => ['Penggantian Biaya Grup'],
        ],
        [
            'type' => 'financing',
            'label' => 'Mutasi Dana Internal',
            'pl_group' => null,
            'children' => [
                'Dana Operasional ke Staf', 'Pengembalian Dana dari Staf', 'Isi Ulang Kas & Dana Operasional',
                'Mutasi Dana Antar Perusahaan Grup', 'Saldo Pindahan Periode',
            ],
        ],
        [
            'type' => 'financing',
            'label' => 'Dana Titipan',
            'pl_group' => null,
            'children' => ['Dana Titipan & Salah Transfer', 'Penerimaan Belum Teridentifikasi'],
        ],
        [
            'type' => 'financing',
            'label' => 'Aset Tetap',
            'pl_group' => null,
            'children' => ['Pembelian Aset Tetap'],
        ],
    ];

    /**
     * Dibuat hanya bila ada baris yang memakainya: baris yang isinya bertentangan dengan kolomnya
     * ("TERIMA PEMBAYARAN ..." di kolom Pengeluaran). Pendanaan agar tidak mengubah Laba Rugi.
     */
    public const PERLU_DITINJAU = ['type' => 'financing', 'label' => 'Perlu Ditinjau', 'pl_group' => null, 'children' => ['Arah Transaksi Janggal']];

    /** @var array<string, int> "type|label sub" → id */
    private array $peta = [];

    /** Memastikan kategori tambahan ada (idempoten; baris yang sudah ada tidak diubah). */
    public function pastikan(): void
    {
        foreach (self::KATEGORI as $grup) {
            $this->buatGrup($grup);
        }

        $this->peta = TransactionCategory::query()
            ->whereNotNull('parent_id')
            ->get(['id', 'type', 'label'])
            ->mapWithKeys(fn (TransactionCategory $kategori): array => [self::kunci($kategori->type, $kategori->label) => $kategori->id])
            ->all();
    }

    /** Id sub kategori; grup PERLU_DITINJAU dibuat saat pertama dibutuhkan. */
    public function id(string $type, string $label): int
    {
        $kunci = self::kunci($type, $label);

        if (! isset($this->peta[$kunci]) && $type === self::PERLU_DITINJAU['type'] && in_array($label, self::PERLU_DITINJAU['children'], true)) {
            $this->buatGrup(self::PERLU_DITINJAU);
            $this->pastikan();
        }

        return $this->peta[$kunci] ?? throw new \RuntimeException("Kategori \"{$label}\" ({$type}) tidak ditemukan.");
    }

    /**
     * @param  array{type: string, label: string, pl_group: string|null, children: list<string>}  $grup
     */
    private function buatGrup(array $grup): void
    {
        $induk = TransactionCategory::query()
            ->whereNull('parent_id')
            ->where('type', $grup['type'])
            ->where('label', $grup['label'])
            ->first()
            ?? TransactionCategory::create([
                'type' => $grup['type'],
                'label' => $grup['label'],
                'pl_group' => $grup['pl_group'],
            ]);

        foreach ($grup['children'] as $sub) {
            $ada = TransactionCategory::query()
                ->whereNotNull('parent_id')
                ->where('type', $grup['type'])
                ->where('label', $sub)
                ->exists();

            if (! $ada) {
                TransactionCategory::create([
                    'type' => $grup['type'],
                    'label' => $sub,
                    'pl_group' => $grup['pl_group'],
                    'parent_id' => $induk->id,
                ]);
            }
        }
    }

    public static function kunci(string $type, string $label): string
    {
        return $type.'|'.mb_strtolower($label);
    }
}
