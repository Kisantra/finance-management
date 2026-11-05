<?php

namespace App\Mcp\Tools;

use App\Models\Company;
use App\Models\FundRequest;
use App\Models\User;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;

/**
 * Daftar pengajuan dana untuk Claude.
 *
 * Visibilitas baris sama dengan FundRequestController::index(): hanya pemegang izin
 * approve fund requests yang melihat pengajuan semua orang; pengguna lain (termasuk yang
 * hanya memegang disburse fund requests) dibatasi ke miliknya sendiri. Batas itu dipasang
 * di query dasar, sehingga ringkasan ikut terbatas.
 */
class DaftarPengajuanDana extends AlatKeuangan
{
    private const PER_HALAMAN = 50;

    /** Label Indonesia sama dengan rekap PDF (FundRequestExportService). */
    private const STATUS = [
        'draft' => 'Draft',
        'pending' => 'Menunggu Review',
        'approved' => 'Disetujui',
        'rejected' => 'Ditolak',
        'disbursed' => 'Dicairkan',
    ];

    protected string $name = 'daftar-pengajuan-dana';

    protected string $description = 'Daftar pengajuan dana (permintaan dana operasional SEBELUM dipakai; dicairkan per item dari rekening): nomor, pemohon, prioritas, total item, status, peninjau, dan info pencairan (tanggal, rekening, oleh siapa), plus ringkasan per status atas SEMUA data yang cocok dengan filter. Saring dengan status, rentang tanggal pengajuan dibuat (dari/sampai), nama pemohon, atau kata kunci (judul/tujuan/nomor); 50 baris per halaman. Pengguna tanpa izin approve fund requests hanya melihat pengajuannya sendiri, sama seperti di aplikasi (lihat `cakupan`).';

    protected function izin(): string
    {
        return 'view fund requests';
    }

    protected function skemaTambahan(JsonSchema $schema): array
    {
        return [
            'status' => $schema->string()->enum(array_keys(self::STATUS))
                ->description('Saring status: draft, pending (menunggu review), approved (disetujui, menunggu dicairkan), rejected (ditolak), disbursed (sudah dicairkan).'),
            'dari' => $schema->string()->format('date')
                ->description('Tanggal pengajuan dibuat paling awal, YYYY-MM-DD.'),
            'sampai' => $schema->string()->format('date')
                ->description('Tanggal pengajuan dibuat paling akhir, YYYY-MM-DD.'),
            'pemohon' => $schema->string()
                ->description('Sebagian nama pemohon, mis. "budi".'),
            'kata_kunci' => $schema->string()
                ->description('Cari di judul, tujuan, atau nomor pengajuan (mis. "001/KSN").'),
            'halaman' => $schema->integer()->min(1)
                ->description('Nomor halaman, mulai 1 (50 baris per halaman).'),
        ];
    }

    protected function jalankan(Request $request, Company $perusahaan): array
    {
        $daftarStatus = implode(', ', array_keys(self::STATUS));

        $argumen = $request->validate([
            'status' => ['nullable', 'string', Rule::in(array_keys(self::STATUS))],
            'dari' => ['nullable', 'date_format:Y-m-d'],
            'sampai' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:dari'],
            'pemohon' => ['nullable', 'string', 'max:100'],
            'kata_kunci' => ['nullable', 'string', 'max:100'],
            'halaman' => ['nullable', 'integer', 'min:1'],
        ], [
            'status.string' => "Argumen status harus salah satu dari: {$daftarStatus}.",
            'status.in' => "Argumen status harus salah satu dari: {$daftarStatus}.",
            'dari.date_format' => 'Argumen dari harus tanggal berformat YYYY-MM-DD, mis. 2026-10-01.',
            'sampai.date_format' => 'Argumen sampai harus tanggal berformat YYYY-MM-DD, mis. 2026-10-31.',
            'sampai.after_or_equal' => 'Argumen sampai tidak boleh lebih awal dari argumen dari.',
            'pemohon.string' => 'Argumen pemohon harus berupa teks (sebagian nama).',
            'pemohon.max' => 'Argumen pemohon paling panjang 100 karakter.',
            'kata_kunci.string' => 'Argumen kata_kunci harus berupa teks.',
            'kata_kunci.max' => 'Argumen kata_kunci paling panjang 100 karakter.',
            'halaman.integer' => 'Argumen halaman harus bilangan bulat mulai 1.',
            'halaman.min' => 'Argumen halaman harus bilangan bulat mulai 1.',
        ]);

        $isi = fn (string $kunci): ?string => filled($argumen[$kunci] ?? null) ? trim((string) $argumen[$kunci]) : null;
        [$status, $dari, $sampai, $pemohon, $kataKunci] = [$isi('status'), $isi('dari'), $isi('sampai'), $isi('pemohon'), $isi('kata_kunci')];

        /** @var User $user */
        $user = $request->user();
        $lihatSemua = $user->can('approve fund requests');

        // Pengguna ada di database pusat: cari id-nya di sana, lalu saring dengan whereIn.
        // whereHas('user') akan menyisipkan tabel users ke query database perusahaan.
        $idPemohon = $pemohon === null ? null : User::query()->where('name', 'like', "%{$pemohon}%")->pluck('id');

        $dasar = fn (): Builder => FundRequest::query()
            ->when(! $lihatSemua, fn (Builder $q) => $q->forUser((int) $user->getKey()))
            ->when($status, fn (Builder $q) => $q->where('status', $status))
            ->when($dari, fn (Builder $q) => $q->whereDate('created_at', '>=', $dari))
            ->when($sampai, fn (Builder $q) => $q->whereDate('created_at', '<=', $sampai))
            ->when($idPemohon !== null, fn (Builder $q) => $q->whereIn('user_id', $idPemohon))
            ->when($kataKunci, fn (Builder $q) => $q->whereAny(['title', 'purpose', 'request_number'], 'like', "%{$kataKunci}%"));

        $perStatus = $dasar()->toBase()
            ->selectRaw('status, COUNT(*) as jumlah, COALESCE(SUM(total_amount), 0) as nominal')
            ->groupBy('status')
            ->get()
            ->keyBy('status');

        $hasil = $dasar()
            ->with([
                'user:id,name',
                'reviewer:id,name',
                'disburser:id,name',
                'bankTransaction:id,bank_account_id',
                'bankTransaction.bankAccount:id,account_name,bank_name',
            ])
            ->withCount('items')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(self::PER_HALAMAN, ['*'], 'halaman', max(1, (int) ($argumen['halaman'] ?? 1)));

        return [
            'cakupan' => $lihatSemua ? 'semua' : 'milik_sendiri',
            ...($lihatSemua ? [] : [
                'catatan_cakupan' => 'Hanya pengajuan Anda sendiri: peran Anda di perusahaan ini tidak memegang izin approve fund requests (aturan yang sama dengan aplikasi). Ringkasan juga hanya menghitung pengajuan Anda.',
            ]),
            'ringkasan' => [
                'jumlah' => (int) $perStatus->sum('jumlah'),
                'total_nominal' => (int) $perStatus->sum('nominal'),
                'per_status' => collect(self::STATUS)->map(fn (string $label, string $s) => [
                    'label' => $label,
                    'jumlah' => (int) ($perStatus->get($s)->jumlah ?? 0),
                    'nominal' => (int) ($perStatus->get($s)->nominal ?? 0),
                ])->all(),
            ],
            'halaman' => $hasil->currentPage(),
            'per_halaman' => self::PER_HALAMAN,
            'total_halaman' => $hasil->lastPage(),
            'pengajuan_dana' => $hasil->getCollection()->map(fn (FundRequest $r) => [
                'id' => $r->id,
                'nomor' => $r->request_number,
                'judul' => $r->title,
                'pemohon' => $r->user?->name,
                'prioritas' => $r->priority,
                'total' => (int) $r->total_amount,
                'jumlah_item' => (int) $r->items_count,
                'status' => $r->status,
                'status_label' => self::STATUS[$r->status] ?? $r->status,
                'dibutuhkan' => $r->needed_by_date?->toDateString(),
                'dibuat' => $r->created_at?->toDateString(),
                'peninjau' => $r->reviewer?->name,
                'ditinjau' => $r->reviewed_at?->toDateString(),
                'catatan_tinjauan' => $r->review_notes === null ? null : Str::limit($r->review_notes, 200),
                'pencairan' => $r->status !== 'disbursed' ? null : [
                    'tanggal' => $r->disbursement_date?->toDateString(),
                    'oleh' => $r->disburser?->name,
                    'rekening' => $r->bankTransaction?->bankAccount
                        ? $r->bankTransaction->bankAccount->account_name.' — '.$r->bankTransaction->bankAccount->bank_name
                        : null,
                    'catatan' => $r->disbursement_notes === null ? null : Str::limit($r->disbursement_notes, 200),
                ],
                'ada_lampiran' => filled($r->attachment_path),
            ])->values()->all(),
        ];
    }
}
