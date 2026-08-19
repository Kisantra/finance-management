<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Symfony\Component\HttpFoundation\Response;

class SetCompanyUrlDefaults
{
    /**
     * Mengisi parameter {company} secara otomatis untuk semua route() dan
     * redirect()->route() di dalam konteks perusahaan aktif — controller
     * tidak perlu menyebut company di setiap pemanggilan route.
     *
     * Sekaligus mengarahkan URL disk `public` ke route berkas per-perusahaan.
     * FilesystemTenancyBootstrapper hanya memindahkan ROOT disk ke
     * storage/tenant{slug}/app/public dan tidak pernah menyentuh URL-nya,
     * sehingga tanpa ini Storage::url() menunjuk symlink public/storage milik
     * DB pusat dan seluruh lampiran/logo gagal dimuat.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($company = tenant()) {
            $slug = $company->getTenantKey();

            URL::defaults(['company' => $slug]);

            // Cukup ubah config: FilesystemTenancyBootstrapper sudah memanggil
            // Storage::forgetDisk() saat inisialisasi tenancy dan tidak me-resolve
            // ulang, jadi disk `public` masih belum terbentuk saat middleware ini
            // berjalan. Memanggil forgetDisk() lagi di sini justru membuang
            // Storage::fake() pada test.
            config(['filesystems.disks.public.url' => url("/c/{$slug}/storage")]);
        }

        return $next($request);
    }
}
