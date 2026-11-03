<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Melayani berkas milik perusahaan aktif.
 *
 * FilesystemTenancyBootstrapper memindahkan ROOT disk `public` ke
 * storage/tenant{slug}/app/public, tetapi tidak pernah mengubah URL bacanya —
 * sehingga Storage::url() menunjuk symlink public/storage milik DB pusat dan
 * semua lampiran 404/403. Route ini menutup celah itu sekaligus menaikkan
 * keamanannya: berkas hanya dapat diambil anggota perusahaan yang bersangkutan
 * (route berada di dalam grup auth + EnsureUserBelongsToCompany), bukan siapa
 * pun yang menebak URL seperti pada symlink publik.
 */
class TenantStorageController extends Controller
{
    /**
     * Parameter {company} tidak muncul di signature: InitializeTenancyByPath
     * sudah melepasnya dari route setelah dipakai mengenali perusahaan.
     */
    public function __invoke(Request $request, string $path): StreamedResponse
    {
        // Cegah path traversal keluar dari folder perusahaan.
        abort_if(str_contains($path, '..'), 404);

        $disk = Storage::disk('public');

        abort_unless($disk->exists($path), 404);

        return $disk->response($path);
    }
}
