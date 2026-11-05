<?php

namespace App\Mcp\Tools;

use App\Http\Controllers\ServiceController;
use App\Models\Company;
use App\Models\Service;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;

/**
 * Katalog layanan, isinya mengikuti ServiceController::index(): nama, jenis, harga bawaan, tanggal
 * dibuat, plus statistik seluruh katalog (jumlah, harga rata-rata & tertinggi, jumlah per jenis).
 */
class DaftarLayanan extends AlatKeuangan
{
    protected string $name = 'daftar-layanan';

    protected string $description = 'Katalog layanan/produk: nama, jenis, harga bawaan (rupiah). Harga katalog hanya acuan: saat invoice disusun nama & harga disalin ke item dan boleh diubah, jadi harga di invoice bisa berbeda. ringkasan_katalog = seluruh katalog (tidak ikut filter).';

    protected function izin(): string
    {
        return 'view services';
    }

    protected function skemaTambahan(JsonSchema $schema): array
    {
        return [
            'kata_kunci' => $schema->string()
                ->description('Cari di nama layanan.'),
            'jenis' => $schema->string()->enum(ServiceController::TYPES)
                ->description('Jenis layanan persis seperti di aplikasi.'),
            'halaman' => $schema->integer()->min(1)
                ->description('Nomor halaman, mulai 1.'),
            'per_halaman' => $schema->integer()->min(1)->max(50)
                ->description('Baris per halaman, bawaan 50, maksimal 50.'),
        ];
    }

    protected function jalankan(Request $request, Company $perusahaan): array
    {
        $data = $request->validate([
            'kata_kunci' => ['nullable', 'string', 'max:100'],
            'jenis' => ['nullable', Rule::in(ServiceController::TYPES)],
            'halaman' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'per_halaman' => ['nullable', 'integer', 'min:1', 'max:50'],
        ], [
            'kata_kunci' => 'kata_kunci harus teks, maksimal 100 karakter.',
            'jenis' => 'jenis harus salah satu dari: '.implode(', ', ServiceController::TYPES).'.',
            'halaman' => 'halaman harus bilangan bulat mulai 1 (maksimal 10000).',
            'per_halaman' => 'per_halaman harus bilangan bulat 1–50.',
        ]);

        $halaman = (int) ($data['halaman'] ?? 1);
        $perHalaman = (int) ($data['per_halaman'] ?? 50);
        $kataKunci = trim((string) ($data['kata_kunci'] ?? ''));

        $dasar = Service::query()
            ->when($kataKunci !== '', fn (Builder $q) => $q->where('name', 'like', "%{$kataKunci}%"))
            ->when($data['jenis'] ?? null, fn (Builder $q, string $jenis) => $q->where('type', $jenis));

        $jumlah = (clone $dasar)->count();

        $layanan = (clone $dasar)
            ->select(['id', 'name', 'type', 'price', 'created_at'])
            ->orderBy('name')
            ->orderBy('id')
            ->forPage($halaman, $perHalaman)
            ->get();

        $katalog = Service::query()->toBase()
            ->selectRaw('COUNT(*) AS jumlah, AVG(price) AS rata_rata, MAX(price) AS tertinggi')
            ->first();

        $perJenis = Service::query()
            ->selectRaw('type, COUNT(*) AS jumlah')
            ->groupBy('type')
            ->orderByDesc('jumlah')
            ->pluck('jumlah', 'type')
            ->map(fn ($nilai) => (int) $nilai);

        return [
            'filter' => array_filter([
                'kata_kunci' => $kataKunci !== '' ? $kataKunci : null,
                'jenis' => $data['jenis'] ?? null,
            ], fn ($nilai) => $nilai !== null),
            'ringkasan_katalog' => [
                'jumlah' => (int) ($katalog->jumlah ?? 0),
                'harga_rata_rata' => (int) ($katalog->rata_rata ?? 0),
                'harga_tertinggi' => (int) ($katalog->tertinggi ?? 0),
                'per_jenis' => $perJenis->all(),
            ],
            'jumlah' => $jumlah,
            'halaman' => $halaman,
            'per_halaman' => $perHalaman,
            'total_halaman' => max(1, (int) ceil($jumlah / $perHalaman)),
            'layanan' => $layanan->map(fn (Service $layanan) => [
                'id' => $layanan->id,
                'nama' => $layanan->name,
                'jenis' => $layanan->type,
                'harga' => (int) $layanan->price,
                'dibuat' => $layanan->created_at?->format('Y-m-d'),
            ])->values()->all(),
        ];
    }
}
