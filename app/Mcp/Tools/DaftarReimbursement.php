<?php

namespace App\Mcp\Tools;

use App\Models\Company;
use App\Models\Reimbursement;
use App\Models\User;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;

/**
 * Daftar reimbursement untuk Claude.
 *
 * Visibilitas baris sama dengan ReimbursementController::index(): hanya pemegang izin
 * approve atau pay reimbursements (canSeeAll()) yang melihat pengajuan semua orang;
 * pengguna lain dibatasi ke miliknya sendiri. Batas itu dipasang di query dasar, sehingga
 * ringkasan ikut terbatas dan tidak membocorkan nominal milik orang lain.
 */
class DaftarReimbursement extends AlatKeuangan
{
    private const PER_HALAMAN = 50;

    /** Urutan sama dengan Reimbursement::statuses(). */
    private const STATUS = ['draft', 'pending', 'approved', 'rejected', 'paid'];

    protected string $name = 'daftar-reimbursement';

    protected string $description = 'Daftar reimbursement (penggantian biaya yang sudah dikeluarkan karyawan): pemohon, kategori, nominal, sudah dibayar, sisa, status, tanggal, dan peninjau, plus ringkasan per status atas SEMUA data yang cocok dengan filter (bukan hanya halaman ini). Saring dengan status, rentang tanggal pengeluaran (dari/sampai), nama pemohon, atau kata kunci; 50 baris per halaman. Pengguna tanpa izin approve/pay reimbursements hanya melihat pengajuannya sendiri, sama seperti di aplikasi (lihat `cakupan`).';

    protected function izin(): string
    {
        return 'view reimbursements';
    }

    protected function skemaTambahan(JsonSchema $schema): array
    {
        return [
            'status' => $schema->string()->enum(self::STATUS)
                ->description('Saring status: draft, pending (menunggu review), approved (disetujui, menunggu dibayar), rejected (ditolak), paid (lunas).'),
            'dari' => $schema->string()->format('date')
                ->description('Tanggal pengeluaran paling awal, YYYY-MM-DD.'),
            'sampai' => $schema->string()->format('date')
                ->description('Tanggal pengeluaran paling akhir, YYYY-MM-DD.'),
            'pemohon' => $schema->string()
                ->description('Sebagian nama pemohon, mis. "budi".'),
            'kata_kunci' => $schema->string()
                ->description('Cari di judul, keterangan, atau kode kategori pemohon (mis. "transport").'),
            'halaman' => $schema->integer()->min(1)
                ->description('Nomor halaman, mulai 1 (50 baris per halaman).'),
        ];
    }

    protected function jalankan(Request $request, Company $perusahaan): array
    {
        $argumen = $request->validate([
            'status' => ['nullable', 'string', Rule::in(self::STATUS)],
            'dari' => ['nullable', 'date_format:Y-m-d'],
            'sampai' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:dari'],
            'pemohon' => ['nullable', 'string', 'max:100'],
            'kata_kunci' => ['nullable', 'string', 'max:100'],
            'halaman' => ['nullable', 'integer', 'min:1'],
        ], [
            'status.string' => 'Argumen status harus salah satu dari: '.implode(', ', self::STATUS).'.',
            'status.in' => 'Argumen status harus salah satu dari: '.implode(', ', self::STATUS).'.',
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
        $lihatSemua = $user->can('approve reimbursements') || $user->can('pay reimbursements');

        // Pengguna ada di database pusat: cari id-nya di sana, lalu saring dengan whereIn.
        // whereHas('user') akan menyisipkan tabel users ke query database perusahaan.
        $idPemohon = $pemohon === null ? null : User::query()->where('name', 'like', "%{$pemohon}%")->pluck('id');

        $dasar = fn (): Builder => Reimbursement::query()
            ->when(! $lihatSemua, fn (Builder $q) => $q->forUser((int) $user->getKey()))
            ->when($status, fn (Builder $q) => $q->where('status', $status))
            ->when($dari, fn (Builder $q) => $q->where('expense_date', '>=', $dari))
            ->when($sampai, fn (Builder $q) => $q->where('expense_date', '<=', $sampai))
            ->when($idPemohon !== null, fn (Builder $q) => $q->whereIn('user_id', $idPemohon))
            ->when($kataKunci, fn (Builder $q) => $q->whereAny(['title', 'description', 'category_input'], 'like', "%{$kataKunci}%"));

        $perStatus = $dasar()->toBase()
            ->selectRaw('status, COUNT(*) as jumlah, COALESCE(SUM(amount), 0) as nominal, COALESCE(SUM(amount_paid), 0) as dibayar')
            ->groupBy('status')
            ->get()
            ->keyBy('status');

        $hasil = $dasar()
            ->with(['user:id,name', 'reviewer:id,name', 'category:id,label'])
            ->withMax('payments', 'payment_date')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(self::PER_HALAMAN, ['*'], 'halaman', max(1, (int) ($argumen['halaman'] ?? 1)));

        $label = collect(Reimbursement::statuses())->pluck('label', 'value');
        $disetujui = $perStatus->get('approved');

        return [
            'cakupan' => $lihatSemua ? 'semua' : 'milik_sendiri',
            ...($lihatSemua ? [] : [
                'catatan_cakupan' => 'Hanya pengajuan Anda sendiri: peran Anda di perusahaan ini tidak memegang izin approve reimbursements atau pay reimbursements (aturan yang sama dengan aplikasi). Ringkasan juga hanya menghitung pengajuan Anda.',
            ]),
            'ringkasan' => [
                'jumlah' => (int) $perStatus->sum('jumlah'),
                'total_nominal' => (int) $perStatus->sum('nominal'),
                'total_dibayar' => (int) $perStatus->sum('dibayar'),
                'menunggu_dibayar' => $disetujui ? (int) $disetujui->nominal - (int) $disetujui->dibayar : 0,
                'per_status' => collect(self::STATUS)->mapWithKeys(fn (string $s) => [$s => [
                    'label' => $label[$s],
                    'jumlah' => (int) ($perStatus->get($s)->jumlah ?? 0),
                    'nominal' => (int) ($perStatus->get($s)->nominal ?? 0),
                    'dibayar' => (int) ($perStatus->get($s)->dibayar ?? 0),
                ]])->all(),
            ],
            'halaman' => $hasil->currentPage(),
            'per_halaman' => self::PER_HALAMAN,
            'total_halaman' => $hasil->lastPage(),
            'reimbursement' => $hasil->getCollection()->map(fn (Reimbursement $r) => [
                'id' => $r->id,
                'judul' => $r->title,
                'pemohon' => $r->user?->name,
                'kategori' => Reimbursement::categoryLabel($r->category_input),
                'kategori_akuntansi' => $r->category?->label,
                'nominal' => (int) $r->amount,
                'dibayar' => (int) $r->amount_paid,
                'sisa' => $r->amount_remaining,
                'status' => $r->status,
                'status_label' => $r->status_label,
                'tanggal_pengeluaran' => $r->expense_date?->toDateString(),
                'dibuat' => $r->created_at?->toDateString(),
                'peninjau' => $r->reviewer?->name,
                'ditinjau' => $r->reviewed_at?->toDateString(),
                'catatan_tinjauan' => $r->review_notes === null ? null : Str::limit($r->review_notes, 200),
                'dibayar_terakhir' => $r->payments_max_payment_date ? Carbon::parse($r->payments_max_payment_date)->toDateString() : null,
                'ada_bukti' => $r->hasAttachment(),
            ])->values()->all(),
        ];
    }
}
