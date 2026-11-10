<?php

namespace App\Services;

use App\Http\Middleware\SetDocumentLocale;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Kisantra\Watchpost\Facades\Watchpost;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

/**
 * Mengganti halaman error polos Laravel ("419 | PAGE EXPIRED") dengan halaman
 * Inertia `error` yang menjelaskan masalah dalam bahasa pengguna, memberi ID
 * referensi, dan menyiapkan laporan Markdown untuk tim IT / agent debugging.
 *
 * Detail teknis (kelas exception, pesan, stack trace) hanya dikirim ke role
 * `admin`: pesan exception bisa memuat SQL beserta datanya.
 */
class ErrorReportService
{
    private const TRACE_FRAMES = 8;

    /**
     * Judul dan penjelasan per kode status, dalam bahasa $locale.
     *
     * @return array<int, array{0: string, 1: string}>
     */
    private static function pesanStatus(string $locale): array
    {
        return [
            400 => [__('Permintaan tidak valid', [], $locale), __('Sistem tidak dapat memahami permintaan ini. Muat ulang halaman lalu coba lagi.', [], $locale)],
            403 => [__('Akses ditolak', [], $locale), __('Akun Anda tidak memiliki izin untuk membuka halaman ini. Hubungi admin bila Anda merasa seharusnya bisa.', [], $locale)],
            404 => [__('Halaman tidak ditemukan', [], $locale), __('Alamat yang Anda buka tidak ada, sudah dipindahkan, atau datanya telah dihapus.', [], $locale)],
            405 => [__('Aksi tidak diizinkan', [], $locale), __('Cara halaman ini dibuka tidak didukung. Kembali lalu ulangi dari menu aplikasi.', [], $locale)],
            413 => [__('Berkas terlalu besar', [], $locale), __('Ukuran berkas melebihi batas yang diizinkan server. Perkecil berkasnya lalu unggah lagi.', [], $locale)],
            419 => [__('Sesi Anda sudah berakhir', [], $locale), __('Demi keamanan, sesi ditutup setelah tidak aktif beberapa waktu. Masuk kembali untuk melanjutkan pekerjaan Anda.', [], $locale)],
            429 => [__('Terlalu banyak permintaan', [], $locale), __('Anda mengirim terlalu banyak permintaan dalam waktu singkat. Tunggu sebentar lalu coba lagi.', [], $locale)],
            500 => [__('Terjadi kesalahan di sistem', [], $locale), __('Ini bukan kesalahan Anda. Tim IT dapat menelusurinya dengan ID referensi di bawah.', [], $locale)],
            503 => [__('Sistem sedang tidak tersedia', [], $locale), __('Sistem sedang dalam pemeliharaan atau sibuk. Coba lagi beberapa menit lagi.', [], $locale)],
        ];
    }

    /**
     * Bahasa tampilan pengguna: rute dokumen memaksa locale 'id' selama diproses dan menyimpan bahasa
     * semula di atribut request; di luar itu bahasa aplikasi saat ini.
     */
    private static function bahasaTampilan(Request $request): string
    {
        return (string) $request->attributes->get(SetDocumentLocale::DISPLAY_LOCALE_ATTRIBUTE, app()->getLocale());
    }

    /**
     * ID yang sama dipakai di log (lewat context exception) dan di halaman, sehingga
     * tim IT cukup mencari satu string di storage/logs/laravel.log.
     */
    public static function referenceId(Request $request): string
    {
        if (! $request->attributes->has('error_id')) {
            $request->attributes->set('error_id', 'ERR-'.Str::upper(Str::random(10)));
        }

        return $request->attributes->get('error_id');
    }

    public function respond(Response $response, Throwable $e, Request $request): Response
    {
        $status = $response->getStatusCode();

        $debugMenang = config('app.debug') && ! config('app.error_page_in_debug');

        if ($status < 400 || $debugMenang || ($request->expectsJson() && ! $request->header('X-Inertia'))) {
            return $response;
        }

        try {
            return Inertia::render('error', $this->props($status, $e, $request))
                ->toResponse($request)
                ->setStatusCode($status);
        } catch (Throwable) {
            // ponytail: bila merender halaman error ikut gagal (mis. database mati saat
            // prop bersama dihitung), halaman bawaan Laravel lebih baik daripada layar kosong.
            return $response;
        }
    }

    /**
     * Tabel yang HANYA ada di database pusat. Hilangnya salah satu berarti
     * langkah penyiapan pusat belum dijalankan, bukan kerusakan data.
     *
     * @var list<string>
     */
    private const TABEL_PUSAT = ['organizations', 'companies', 'company_user'];

    /**
     * Ubah "Table 'x.companies' doesn't exist" menjadi petunjuk yang bisa diikuti.
     *
     * Pesan bawaannya benar secara teknis tetapi tidak memberi tahu apa pun:
     * pembacanya tahu ada tabel yang hilang, bukan bahwa ia melewatkan satu
     * perintah penyiapan. Ini BUKAN kasus langka — ia muncul setiap kali
     * aplikasi multi-perusahaan diarahkan ke database yang belum disiapkan:
     * saat berpindah branch, saat site baru dibuat untuk pelanggan lain, atau
     * ketika satu langkah cutover terlewat. Terjadi sungguhan pada 2026-11-03:
     * `.env` masih menunjuk database pra-tenancy, dan 500-nya terbaca seperti
     * fiturnya yang rusak.
     *
     * Jalur ini hanya hidup saat SUDAH terjadi error, jadi tidak ada biaya
     * per-request. Pesannya ditulis tetap di sini, bukan diambil dari
     * exception — pesan exception 5xx bisa memuat SQL beserta datanya, dan
     * nama database tidak perlu ditampilkan ke pengguna biasa. Detail aslinya
     * tetap ada di bagian teknis yang hanya terlihat oleh admin.
     *
     * @return array{0: string, 1: string}|null
     */
    private static function pesanSetupBelumSelesai(Throwable $e, string $locale): ?array
    {
        if (! $e instanceof QueryException) {
            return null;
        }

        if (! preg_match("/Table '[^.']*\.([^']+)' doesn't exist/", $e->getMessage(), $cocok)) {
            return null;
        }

        if (in_array($cocok[1], self::TABEL_PUSAT, true)) {
            return [
                __('Database pusat belum disiapkan', [], $locale),
                __('Database yang dipakai aplikasi ini belum memiliki tabel perusahaan. Biasanya karena DB_DATABASE di .env masih menunjuk database lama (sebelum multi-perusahaan), atau langkah penyiapan belum dijalankan. Jalankan: php artisan migrate, lalu php artisan central:bootstrap. Setelah mengubah .env, server harus di-restart — nilainya dibaca sekali saat server start.', [], $locale),
            ];
        }

        return [
            __('Database perusahaan belum dimigrasi', [], $locale),
            __('Perusahaan ini sudah terdaftar tetapi tabel datanya belum dibuat. Jalankan: php artisan tenants:migrate. Periksa juga php artisan central:tenants-status untuk melihat perusahaan mana yang tertinggal.', [], $locale),
        ];
    }

    /**
     * Pesan yang SENGAJA ditulis di `abort(403, '...')`, bila aman ditampilkan.
     *
     * Tanpa ini, setiap pesan yang disusun khusus dibuang dan diganti teks tetap
     * per kode status — ada 10+ di aplikasi ini, dan semuanya kalimat yang memang
     * ditulis untuk menjelaskan situasinya. Akibat paling terasa ada di onboarding:
     * pengguna baru yang belum ditautkan ke perusahaan mana pun membaca "Akun Anda
     * tidak memiliki izin untuk membuka halaman ini", bukan "Akun Anda belum
     * terdaftar di perusahaan mana pun. Hubungi administrator." — lalu ia
     * menyimpulkan akunnya rusak dan membuka tiket yang tidak perlu.
     *
     * Tiga syarat, dan ketiganya soal keamanan, bukan kerapian:
     *
     * 1. Hanya HttpExceptionInterface — artinya exception ini memang dibuat oleh
     *    `abort()` di kode kita, bukan kecelakaan runtime yang kebetulan punya pesan.
     * 2. Hanya status < 500. Pesan exception 5xx bisa memuat SQL beserta datanya;
     *    itu sebabnya detail teknis di kelas ini pun hanya dikirim ke role admin.
     * 3. Pesan yang berbau internal ditolak: backslash (nama kelas ber-namespace),
     *    "SQLSTATE", "The route …" (rute tidak ditemukan), dan "No query results for model" — yang terakhir dihasilkan
     *    route-model binding pada 404 dan membocorkan nama model beserta id-nya.
     */
    private static function pesanKhusus(Throwable $e, int $status, string $locale): ?string
    {
        if (! $e instanceof HttpExceptionInterface || $status >= 500) {
            return null;
        }

        $pesan = trim($e->getMessage());

        if ($pesan === '' || mb_strlen($pesan) > 300) {
            return null;
        }

        foreach (['\\', 'SQLSTATE', 'No query results for model'] as $penanda) {
            if (str_contains($pesan, $penanda)) {
                return null;
            }
        }

        return __($pesan, [], $locale);
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function judulDanPenjelasan(int $status, Throwable $e, string $locale): array
    {
        $pesan = self::pesanStatus($locale);

        return self::pesanSetupBelumSelesai($e, $locale)
            ?? $pesan[$status]
            ?? ($status >= 500
                ? $pesan[500]
                : [__('Permintaan tidak dapat diproses', [], $locale), __('Terjadi kendala saat memproses permintaan Anda.', [], $locale)]);
    }

    /**
     * @return array<string, mixed>
     */
    private function props(int $status, Throwable $e, Request $request): array
    {
        $locale = self::bahasaTampilan($request);
        [$title, $description] = $this->judulDanPenjelasan($status, $e, $locale);
        [$judulLaporan] = $this->judulDanPenjelasan($status, $e, SetDocumentLocale::LOCALE);

        $description = self::pesanKhusus($e, $status, $locale) ?? $description;

        $user = $request->user();

        // Rute perusahaan butuh {company}, jadi hanya dipakai bila tenancy sudah
        // ter-inisialisasi. Itu TIDAK menjamin keanggotaan sudah dicek — keamanannya
        // datang dari izin Spatie yang per tim: bukan anggota = tanpa role di tim itu.
        $company = tenancy()->initialized ? tenant()->getTenantKey() : null;

        // Pada 404 route model binding, SubstituteBindings gagal SEBELUM SetPermissionsTeam
        // mana pun berjalan, sehingga tim Spatie masih null dan semua izin terbaca false.
        $previousTeam = getPermissionsTeamId();

        if ($company !== null) {
            setPermissionsTeamId($company);
            $user?->unsetRelation('roles')->unsetRelation('permissions');
        }

        try {
            return $this->propsForTeam($status, $title, $judulLaporan, $description, $user, $company, $e, $request, $locale);
        } finally {
            setPermissionsTeamId($previousTeam);
            $user?->unsetRelation('roles')->unsetRelation('permissions');
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function propsForTeam(int $status, string $title, string $judulLaporan, string $description, ?User $user, ?string $company, Throwable $e, Request $request, string $locale): array
    {
        $canReport = $user !== null
            && $company !== null
            && $status !== 419
            && $user->can('view feedbacks')
            && $user->can('create feedbacks');

        [$homeUrl, $homeLabel] = match (true) {
            $user === null => [route('login'), __('Masuk', [], $locale)],
            $company !== null => [route('dashboard', ['company' => $company]), __('Ke Ringkasan', [], $locale)],
            default => [route('choose-company'), __('Pilih Perusahaan', [], $locale)],
        };

        return [
            'status' => $status,
            'title' => $title,
            'description' => $description,
            // Dikirim eksplisit: pada 404 dari route model binding, prop bersama `auth`
            // belum sempat dibagikan HandleInertiaRequests sehingga tidak bisa diandalkan.
            'is_guest' => $user === null,
            'home_url' => $homeUrl,
            'home_label' => $homeLabel,
            // Setelah POST gagal, address bar menunjuk URL POST — memuat ulang di sana
            // bisa berujung 405. Hanya GET yang aman untuk "Coba lagi".
            'can_retry' => $request->isMethod('GET'),
            'can_report' => $canReport,
            'report_url' => $canReport ? route('feedbacks.store', ['company' => $company]) : null,
            'report' => $this->report($status, $judulLaporan, $e, $request),
        ];
    }

    /**
     * @return array{id: string, trace_id: string|null, summary: string, page: string, fields: list<array{label: string, value: string}>, technical: array<string, mixed>|null, markdown: string}
     */
    private function report(int $status, string $title, Throwable $e, Request $request): array
    {
        $id = self::referenceId($request);
        $page = $request->method().' '.$this->pagePath($request);
        $user = $request->user();

        $fields = [
            ['label' => 'Kode', 'value' => "{$status} — {$title}"],
            ['label' => 'ID referensi', 'value' => $id],
            ['label' => 'Waktu', 'value' => now()->format('Y-m-d H:i:s T')],
            ['label' => 'Halaman', 'value' => $page],
            ['label' => 'Rute', 'value' => $request->route()?->getName() ?? '—'],
            ['label' => 'Pengguna', 'value' => $user ? "#{$user->id} {$user->name} <{$user->email}>" : 'Belum masuk'],
            ['label' => 'Perusahaan', 'value' => tenancy()->initialized ? tenant()->getTenantKey() : '— (di luar konteks perusahaan)'],
            ['label' => 'Browser', 'value' => Str::limit((string) $request->userAgent(), 200) ?: '—'],
            ['label' => 'Aplikasi', 'value' => config('app.url').' · '.app()->environment()],
        ];

        $technical = $status >= 500 && $user?->hasRole('admin') ? $this->technical($e) : null;

        return [
            'id' => $id,
            // Trace request ini di Watchpost: laporan yang membawanya menempel ke tiket error-nya.
            'trace_id' => Watchpost::traceId(),
            'summary' => "Error {$status} di {$page}",
            'page' => $this->pagePath($request),
            'fields' => $fields,
            'technical' => $technical,
            'markdown' => $this->markdown($status, $id, $fields, $technical),
        ];
    }

    /**
     * Path tanpa query string. Rute bertoken (reset password) memakai pola URI-nya
     * supaya token tidak ikut tersalin ke chat atau laporan.
     */
    private function pagePath(Request $request): string
    {
        $route = $request->route();

        // hasParameter() aman untuk rute yang belum ter-bind; parameters() melempar exception.
        if ($route?->hasParameter('token')) {
            return '/'.ltrim($route->uri(), '/');
        }

        return $request->getPathInfo();
    }

    /**
     * @return array{exception: class-string, message: string, location: string, trace: list<string>}
     */
    private function technical(Throwable $e): array
    {
        // Handler membungkus ModelNotFound/TokenMismatch dalam HttpException; yang
        // berguna untuk debugging adalah exception aslinya.
        $source = $e instanceof HttpExceptionInterface && $e->getPrevious() ? $e->getPrevious() : $e;

        $isVendor = fn (string $file) => str_contains($file, DIRECTORY_SEPARATOR.'vendor'.DIRECTORY_SEPARATOR);

        $appFrames = collect($source->getTrace())
            ->filter(fn (array $frame) => isset($frame['file']) && ! $isVendor($frame['file']));

        // QueryException dilempar di dalam vendor/laravel — yang perlu dibuka developer
        // adalah baris kode aplikasi yang memicunya.
        $location = $isVendor($source->getFile()) && $appFrames->isNotEmpty()
            ? $this->relativePath($appFrames->first()['file']).':'.($appFrames->first()['line'] ?? '?')
            : $this->relativePath($source->getFile()).':'.$source->getLine();

        $trace = $appFrames
            ->take(self::TRACE_FRAMES)
            ->map(fn (array $frame) => $this->relativePath($frame['file']).':'.($frame['line'] ?? '?')
                .' '.(isset($frame['class']) ? class_basename($frame['class']).($frame['type'] ?? '->') : '').$frame['function'].'()')
            ->values()
            ->all();

        return [
            'exception' => $source::class,
            'message' => Str::limit($source->getMessage(), 1000),
            'location' => $location,
            'trace' => $trace,
        ];
    }

    private function relativePath(string $path): string
    {
        return str_replace('\\', '/', Str::after($path, base_path().DIRECTORY_SEPARATOR));
    }

    /**
     * @param  list<array{label: string, value: string}>  $fields
     * @param  array{exception: string, message: string, location: string, trace: list<string>}|null  $technical
     */
    private function markdown(int $status, string $id, array $fields, ?array $technical): string
    {
        $lines = ['## Laporan Error — '.config('app.name'), ''];

        foreach ($fields as $field) {
            $lines[] = "- **{$field['label']}**: `{$field['value']}`";
        }

        if ($technical) {
            $lines = [
                ...$lines,
                '',
                '### Detail teknis',
                "- **Exception**: `{$technical['exception']}`",
                "- **Lokasi**: `{$technical['location']}`",
                '- **Pesan**:',
                '',
                '```',
                $technical['message'],
                '```',
                '',
                '**Jejak (kode aplikasi, teratas dulu):**',
                '',
                '```',
                ...$technical['trace'],
                '```',
            ];
        }

        if ($status >= 500) {
            array_push($lines,
                '',
                '### Cara menelusuri',
                "Cari `{$id}` di `storage/logs/laravel.log` — baris log tersebut memuat stack trace lengkap.",
            );
        }

        return implode("\n", $lines);
    }
}
