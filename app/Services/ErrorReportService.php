<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
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
     * @var array<int, array{0: string, 1: string}>
     */
    private const MESSAGES = [
        400 => ['Permintaan tidak valid', 'Sistem tidak dapat memahami permintaan ini. Muat ulang halaman lalu coba lagi.'],
        403 => ['Akses ditolak', 'Akun Anda tidak memiliki izin untuk membuka halaman ini. Hubungi admin bila Anda merasa seharusnya bisa.'],
        404 => ['Halaman tidak ditemukan', 'Alamat yang Anda buka tidak ada, sudah dipindahkan, atau datanya telah dihapus.'],
        405 => ['Aksi tidak diizinkan', 'Cara halaman ini dibuka tidak didukung. Kembali lalu ulangi dari menu aplikasi.'],
        413 => ['Berkas terlalu besar', 'Ukuran berkas melebihi batas yang diizinkan server. Perkecil berkasnya lalu unggah lagi.'],
        419 => ['Sesi Anda sudah berakhir', 'Demi keamanan, sesi ditutup setelah tidak aktif beberapa waktu. Masuk kembali untuk melanjutkan pekerjaan Anda.'],
        429 => ['Terlalu banyak permintaan', 'Anda mengirim terlalu banyak permintaan dalam waktu singkat. Tunggu sebentar lalu coba lagi.'],
        500 => ['Terjadi kesalahan di sistem', 'Ini bukan kesalahan Anda. Tim IT dapat menelusurinya dengan ID referensi di bawah.'],
        503 => ['Sistem sedang tidak tersedia', 'Sistem sedang dalam pemeliharaan atau sibuk. Coba lagi beberapa menit lagi.'],
    ];

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

        if ($status < 400 || config('app.debug') || ($request->expectsJson() && ! $request->header('X-Inertia'))) {
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
     * @return array<string, mixed>
     */
    private function props(int $status, Throwable $e, Request $request): array
    {
        [$title, $description] = self::MESSAGES[$status]
            ?? ($status >= 500 ? self::MESSAGES[500] : ['Permintaan tidak dapat diproses', 'Terjadi kendala saat memproses permintaan Anda.']);

        $user = $request->user();

        $canReport = $user !== null
            && $status !== 419
            && $user->can('view feedbacks')
            && $user->can('create feedbacks');

        return [
            'status' => $status,
            'title' => $title,
            'description' => $description,
            // Dikirim eksplisit: pada 404 dari route model binding, prop bersama `auth`
            // belum sempat dibagikan HandleInertiaRequests sehingga tidak bisa diandalkan.
            'is_guest' => $user === null,
            'home_url' => $user ? route('dashboard') : route('login'),
            // Setelah POST gagal, address bar menunjuk URL POST — memuat ulang di sana
            // bisa berujung 405. Hanya GET yang aman untuk "Coba lagi".
            'can_retry' => $request->isMethod('GET'),
            'can_report' => $canReport,
            'report_url' => $canReport ? route('feedbacks.store') : null,
            'report' => $this->report($status, $title, $e, $request),
        ];
    }

    /**
     * @return array{id: string, summary: string, page: string, fields: list<array{label: string, value: string}>, technical: array<string, mixed>|null, markdown: string}
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
            ['label' => 'Browser', 'value' => Str::limit((string) $request->userAgent(), 200) ?: '—'],
            ['label' => 'Aplikasi', 'value' => config('app.url').' · '.app()->environment()],
        ];

        $technical = $status >= 500 && $user?->hasRole('admin') ? $this->technical($e) : null;

        return [
            'id' => $id,
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
