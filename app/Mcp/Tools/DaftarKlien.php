<?php

namespace App\Mcp\Tools;

use App\Models\Client;
use App\Models\Company;
use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Database\Eloquent\Builder;
use Laravel\Mcp\Request;

/**
 * Daftar klien + rekap tagihan per klien, dihitung di SQL lewat satu subquery agregat per klien.
 * Angkanya mengikuti statistik daftar invoice (InvoiceController::index()): "ditagih" tanpa
 * draft & cancelled, "dibayar" = Σ pembayaran nyata (sama dengan accessor Invoice::amount_paid).
 *
 * Sengaja TIDAK meniru kolom "outstanding" halaman Klien (ClientController::index()): kolom itu
 * menjumlahkan semua invoice termasuk draft dikurangi total invoice berstatus paid saja, sehingga
 * invoice yang dibayar sebagian terhitung belum dibayar sama sekali (docs/module/clients.md, Jebakan).
 */
class DaftarKlien extends AlatKeuangan
{
    /** Label seperti di halaman Klien. */
    private const LABEL_STATUS = ['active' => 'Aktif', 'inactive' => 'Tidak aktif'];

    private const URUTAN = ['nama', 'sisa_terbesar', 'ditagih_terbesar'];

    protected string $name = 'daftar-klien';

    protected string $description = 'Daftar klien dengan NPWP, PIC, email, dan rekap tagihan per klien: ditagih (invoice terbit, tanpa draft), dibayar (pembayaran yang benar-benar masuk), sisa, sisa_lewat_tempo, dan draft. Ringkasan berlaku untuk seluruh hasil filter. ID klien bisa dipakai sebagai argumen klien di daftar-invoice. Kolom "outstanding" di halaman Klien menghitung invoice dibayar sebagian & draft sebagai belum dibayar, jadi bisa lebih besar dari sisa di sini.';

    protected function izin(): string
    {
        return 'view clients';
    }

    protected function skemaTambahan(JsonSchema $schema): array
    {
        return [
            'kata_kunci' => $schema->string()
                ->description('Cari di nama, email, atau NPWP klien.'),
            'jenis' => $schema->string()->enum(['individual', 'company'])
                ->description('individual = perorangan, company = perusahaan.'),
            'status' => $schema->string()->enum(['Active', 'Inactive'])
                ->description('Status klien di aplikasi.'),
            'ada_sisa' => $schema->boolean()
                ->description('true = hanya klien yang masih punya sisa tagihan; false = hanya yang tidak.'),
            'urut' => $schema->string()->enum(self::URUTAN)
                ->description('nama (bawaan), sisa_terbesar, ditagih_terbesar.'),
            'halaman' => $schema->integer()->min(1)
                ->description('Nomor halaman, mulai 1.'),
            'per_halaman' => $schema->integer()->min(1)->max(50)
                ->description('Baris per halaman, bawaan 25, maksimal 50.'),
        ];
    }

    protected function jalankan(Request $request, Company $perusahaan): array
    {
        $data = $request->validate([
            'kata_kunci' => ['nullable', 'string', 'max:100'],
            'jenis' => ['nullable', 'in:individual,company'],
            'status' => ['nullable', 'in:Active,Inactive'],
            'ada_sisa' => ['nullable', 'boolean'],
            'urut' => ['nullable', 'in:'.implode(',', self::URUTAN)],
            'halaman' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'per_halaman' => ['nullable', 'integer', 'min:1', 'max:50'],
        ], [
            'kata_kunci' => 'kata_kunci harus teks, maksimal 100 karakter.',
            'jenis' => 'jenis harus individual atau company.',
            'status' => 'status harus Active atau Inactive.',
            'ada_sisa' => 'ada_sisa harus true atau false.',
            'urut' => 'urut harus salah satu dari: '.implode(', ', self::URUTAN).'.',
            'halaman' => 'halaman harus bilangan bulat mulai 1 (maksimal 10000).',
            'per_halaman' => 'per_halaman harus bilangan bulat 1–50.',
        ]);

        $hariIni = today()->toDateString();
        $halaman = (int) ($data['halaman'] ?? 1);
        $perHalaman = (int) ($data['per_halaman'] ?? 25);
        $urut = $data['urut'] ?? 'nama';
        $kataKunci = trim((string) ($data['kata_kunci'] ?? ''));
        $adaSisa = isset($data['ada_sisa']) ? filter_var($data['ada_sisa'], FILTER_VALIDATE_BOOLEAN) : null;

        $terbit = "invoices.status NOT IN ('draft', 'cancelled')";
        $menunggu = "invoices.status IN ('sent', 'partially_paid')";
        $dibayarInvoice = 'COALESCE(p.jumlah_dibayar, 0)';

        $perKlien = Invoice::query()
            ->leftJoinSub(
                Payment::query()->select('invoice_id')->selectRaw('SUM(amount) AS jumlah_dibayar')->groupBy('invoice_id'),
                'p',
                'p.invoice_id',
                '=',
                'invoices.id'
            )
            ->select('invoices.billed_to_id')
            ->selectRaw(
                "SUM(CASE WHEN {$terbit} THEN 1 ELSE 0 END) AS invoice_terbit,
                SUM(CASE WHEN {$terbit} THEN invoices.total_amount ELSE 0 END) AS ditagih,
                SUM(CASE WHEN {$terbit} THEN {$dibayarInvoice} ELSE 0 END) AS dibayar,
                SUM(CASE WHEN {$menunggu} AND invoices.due_date < ? THEN invoices.total_amount - {$dibayarInvoice} ELSE 0 END) AS sisa_lewat_tempo,
                SUM(CASE WHEN invoices.status = 'draft' THEN 1 ELSE 0 END) AS draft_jumlah,
                SUM(CASE WHEN invoices.status = 'draft' THEN invoices.total_amount ELSE 0 END) AS draft_nilai",
                [$hariIni]
            )
            ->groupBy('invoices.billed_to_id');

        $sisa = 'COALESCE(a.ditagih, 0) - COALESCE(a.dibayar, 0)';

        $dasar = Client::query()
            ->leftJoinSub($perKlien, 'a', 'a.billed_to_id', '=', 'clients.id')
            // Grup OR dibungkus closure, sama seperti ClientController: tanpa itu filter lain bocor.
            ->when($kataKunci !== '', fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->where('clients.name', 'like', "%{$kataKunci}%")
                ->orWhere('clients.email', 'like', "%{$kataKunci}%")
                ->orWhere('clients.NPWP', 'like', "%{$kataKunci}%")))
            ->when($data['jenis'] ?? null, fn (Builder $q, string $jenis) => $q->where('clients.type', $jenis))
            ->when($data['status'] ?? null, fn (Builder $q, string $status) => $q->where('clients.status', $status))
            ->when($adaSisa === true, fn (Builder $q) => $q->whereRaw("{$sisa} > 0"))
            ->when($adaSisa === false, fn (Builder $q) => $q->whereRaw("{$sisa} <= 0"));

        $ringkasan = (clone $dasar)->toBase()->selectRaw(
            'COUNT(*) AS jumlah,
            COALESCE(SUM(a.ditagih), 0) AS ditagih,
            COALESCE(SUM(a.dibayar), 0) AS dibayar,
            COALESCE(SUM(a.sisa_lewat_tempo), 0) AS sisa_lewat_tempo,
            COALESCE(SUM(a.draft_nilai), 0) AS draft_nilai'
        )->first();

        $baris = (clone $dasar)
            ->select([
                'clients.id', 'clients.name', 'clients.type', 'clients.status',
                'clients.NPWP', 'clients.email', 'clients.person_in_charge',
            ])
            ->selectRaw(
                'COALESCE(a.invoice_terbit, 0) AS invoice_terbit,
                COALESCE(a.ditagih, 0) AS ditagih,
                COALESCE(a.dibayar, 0) AS dibayar,
                COALESCE(a.sisa_lewat_tempo, 0) AS sisa_lewat_tempo,
                COALESCE(a.draft_jumlah, 0) AS draft_jumlah,
                COALESCE(a.draft_nilai, 0) AS draft_nilai'
            )
            ->tap(fn (Builder $q) => match ($urut) {
                'sisa_terbesar' => $q->orderByRaw("{$sisa} DESC"),
                'ditagih_terbesar' => $q->orderByRaw('COALESCE(a.ditagih, 0) DESC'),
                default => $q,
            })
            ->orderBy('clients.name')
            ->orderBy('clients.id')
            ->forPage($halaman, $perHalaman)
            ->get();

        $jumlah = (int) $ringkasan->jumlah;
        $ditagih = (int) $ringkasan->ditagih;
        $dibayar = (int) $ringkasan->dibayar;

        return [
            'filter' => array_filter([
                'kata_kunci' => $kataKunci !== '' ? $kataKunci : null,
                'jenis' => $data['jenis'] ?? null,
                'status' => $data['status'] ?? null,
                'ada_sisa' => $adaSisa,
                'urut' => $urut,
            ], fn ($nilai) => $nilai !== null),
            'ringkasan' => [
                'jumlah_klien' => $jumlah,
                'ditagih' => $ditagih,
                'dibayar' => $dibayar,
                'sisa' => $ditagih - $dibayar,
                'sisa_lewat_tempo' => (int) $ringkasan->sisa_lewat_tempo,
                'draft_nilai' => (int) $ringkasan->draft_nilai,
            ],
            'halaman' => $halaman,
            'per_halaman' => $perHalaman,
            'total_halaman' => max(1, (int) ceil($jumlah / $perHalaman)),
            'klien' => $baris->map(function (Client $klien): array {
                $ditagih = (int) $klien->ditagih;
                $dibayar = (int) $klien->dibayar;

                return [
                    'id' => $klien->id,
                    'nama' => $klien->name,
                    'jenis' => $klien->type,
                    'status' => $klien->status,
                    'status_label' => self::LABEL_STATUS[strtolower((string) $klien->status)] ?? null,
                    'npwp' => $klien->NPWP,
                    'pic' => $klien->person_in_charge,
                    'email' => $klien->email,
                    'invoice_terbit' => (int) $klien->invoice_terbit,
                    'ditagih' => $ditagih,
                    'dibayar' => $dibayar,
                    'sisa' => $ditagih - $dibayar,
                    'sisa_lewat_tempo' => (int) $klien->sisa_lewat_tempo,
                    'draft' => ['jumlah' => (int) $klien->draft_jumlah, 'nilai' => (int) $klien->draft_nilai],
                ];
            })->values()->all(),
        ];
    }
}
