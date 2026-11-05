<?php

namespace App\Mcp\Tools;

use App\Models\Company;
use App\Models\TransactionCategory;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Collection;
use Laravel\Mcp\Request;

/**
 * Pohon kategori transaksi. Hierarki dan arti kolom mengikuti modul Kategori Transaksi
 * (TransactionCategoryController::index, TransactionCategory::selectOptions): induk hanya
 * pengelompokan, transaksi selalu memakai sub-kategori, `pl_group` memetakan kategori ke baris
 * Laba Rugi. Kolom `code` sudah lama di-drop; pengenalnya `id`, dan kategori otomatis modul
 * Pinjaman/Piutang dikenali lewat `system_key`.
 */
class KategoriTransaksi extends AlatKeuangan
{
    /** Urutan jenis seperti halaman Kategori Transaksi (resources/js/pages/transaction-categories/index.tsx). */
    private const URUTAN_JENIS = ['income', 'expense', 'financing', 'transfer', 'adjustment'];

    private const ARTI_JENIS = [
        'income' => 'Pemasukan',
        'expense' => 'Pengeluaran',
        'financing' => 'Pendanaan',
        'transfer' => 'Transfer',
        'adjustment' => 'Penyesuaian',
    ];

    private const ARTI_GRUP_LR = [
        'revenue' => 'Pendapatan Usaha',
        'cogs' => 'Harga Pokok (HPP)',
        'opex' => 'Beban Operasional',
        'other_income' => 'Pendapatan Lain',
        'other_expense' => 'Beban Lain',
        'tax' => 'Pajak Perusahaan',
    ];

    protected string $name = 'kategori-transaksi';

    protected string $description = 'Pohon kategori transaksi (induk → sub). Per kategori: id (dipakai filter kategori di mutasi-rekening; id induk ikut menyertakan sub-kategorinya), label, jenis, grup_lr (baris Laba Rugi), kode_sistem untuk kategori otomatis modul Pinjaman/Piutang. Transaksi selalu memakai sub-kategori; induk hanya pengelompokan. Kategori income/expense tanpa grup_lr belum masuk Laba Rugi (dihitung di belum_diklasifikasi). financing (pokok pinjaman/piutang, setoran titipan) dan transfer (antar rekening sendiri) memang di luar Laba Rugi. Filter opsional: jenis.';

    protected function izin(): string
    {
        return 'view categories';
    }

    protected function skemaTambahan(JsonSchema $schema): array
    {
        return [
            'jenis' => $schema->string()->enum(self::URUTAN_JENIS)
                ->description('Hanya kategori berjenis ini: income = pemasukan, expense = pengeluaran, financing = pendanaan, transfer, adjustment = penyesuaian.'),
        ];
    }

    protected function jalankan(Request $request, Company $perusahaan): array
    {
        $data = $request->validate([
            'jenis' => ['nullable', 'string', 'in:'.implode(',', self::URUTAN_JENIS)],
        ], [
            'jenis' => 'jenis harus salah satu dari: '.implode(', ', self::URUTAN_JENIS).'.',
        ]);

        $jenis = filled($data['jenis'] ?? null) ? (string) $data['jenis'] : null;

        $semua = TransactionCategory::query()
            ->orderBy('label')
            ->orderBy('id')
            ->get(['id', 'parent_id', 'type', 'pl_group', 'label', 'system_key']);

        $adaId = $semua->pluck('id')->flip();
        $anakPerInduk = $semua
            ->filter(fn (TransactionCategory $kategori): bool => $kategori->parent_id !== null && (int) $kategori->parent_id !== (int) $kategori->id)
            ->groupBy('parent_id');

        $akar = $semua
            ->filter(fn (TransactionCategory $kategori): bool => $kategori->parent_id === null
                || (int) $kategori->parent_id === (int) $kategori->id
                || ! $adaId->has($kategori->parent_id))
            ->sortBy(fn (TransactionCategory $kategori): int => $this->urutanJenis($kategori->type));

        $dikunjungi = [];
        $jumlah = 0;
        $pohon = [];

        // Akar lebih dulu, lalu kategori yang belum terjangkau (induknya saling menunjuk):
        // tidak ada kategori yang boleh hilang hanya karena hierarkinya rusak.
        foreach ([...$akar->all(), ...$semua->all()] as $kategori) {
            if (isset($dikunjungi[$kategori->id])) {
                continue;
            }

            $simpul = $this->simpul($kategori, $anakPerInduk, $dikunjungi, $jenis, $jumlah);

            if ($simpul !== null) {
                $pohon[] = $simpul;
            }
        }

        return [
            ...($jenis !== null ? ['filter' => ['jenis' => $jenis]] : []),
            'jumlah_kategori' => $jumlah,
            'belum_diklasifikasi' => $semua
                ->filter(fn (TransactionCategory $kategori): bool => in_array($kategori->type, ['income', 'expense'], true)
                    && $kategori->pl_group === null
                    && ($jenis === null || $kategori->type === $jenis))
                ->count(),
            'arti_jenis' => self::ARTI_JENIS,
            'arti_grup_lr' => self::ARTI_GRUP_LR,
            'kategori' => $pohon,
        ];
    }

    /**
     * Satu kategori beserta turunannya. Dengan filter jenis, kategori yang jenisnya berbeda tetap
     * dikirim bila ada turunan yang cocok, agar letaknya di pohon tetap terlihat.
     *
     * @param  Collection<int|string, Collection<int, TransactionCategory>>  $anakPerInduk
     * @param  array<int, true>  $dikunjungi
     * @return array<string, mixed>|null
     */
    private function simpul(TransactionCategory $kategori, Collection $anakPerInduk, array &$dikunjungi, ?string $jenis, int &$jumlah): ?array
    {
        $dikunjungi[$kategori->id] = true;
        $sub = [];

        foreach ($anakPerInduk->get($kategori->id, []) as $anak) {
            if (isset($dikunjungi[$anak->id])) {
                continue;
            }

            $simpulAnak = $this->simpul($anak, $anakPerInduk, $dikunjungi, $jenis, $jumlah);

            if ($simpulAnak !== null) {
                $sub[] = $simpulAnak;
            }
        }

        if ($jenis !== null && $kategori->type !== $jenis && $sub === []) {
            return null;
        }

        $jumlah++;

        return array_filter([
            'id' => $kategori->id,
            'label' => $kategori->label,
            'jenis' => $kategori->type,
            'grup_lr' => $kategori->pl_group,
            'kode_sistem' => $kategori->system_key,
            'sub' => $sub === [] ? null : $sub,
        ], fn ($nilai): bool => $nilai !== null);
    }

    private function urutanJenis(?string $jenis): int
    {
        $posisi = array_search($jenis, self::URUTAN_JENIS, true);

        return $posisi === false ? count(self::URUTAN_JENIS) : $posisi;
    }
}
