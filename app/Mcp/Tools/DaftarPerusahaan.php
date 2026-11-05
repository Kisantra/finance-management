<?php

namespace App\Mcp\Tools;

use App\Mcp\AksesClaude;
use App\Models\Company;
use App\Models\User;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Tool;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
class DaftarPerusahaan extends Tool
{
    protected string $name = 'daftar-perusahaan';

    protected string $description = 'Daftar perusahaan yang datanya boleh dibaca pengguna ini lewat Claude: kode (dipakai sebagai argumen `perusahaan` di semua alat lain), nama, singkatan, dan peran pengguna di sana. Panggil alat ini lebih dulu.';

    public function handle(Request $request, AksesClaude $akses): Response
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return Response::error('Sesi tidak dikenali. Hubungkan ulang Claude ke aplikasi.');
        }

        $perusahaan = $akses->perusahaan($user)->map(fn (Company $company) => [
            'kode' => $company->getKey(),
            'nama' => $company->name,
            'singkatan' => $company->abbreviation,
            'peran_anda' => $akses->peran($user, $company),
        ])->values()->all();

        return Response::json([
            'pengguna' => $user->name,
            'perusahaan' => $perusahaan,
            'catatan' => $perusahaan === []
                ? 'Belum ada perusahaan yang boleh dibaca. Minta admin memberi peran Anda izin "use claude" di Administrasi › Izin & Peran.'
                : 'Semua nominal dalam rupiah penuh (integer). Data hanya bisa dibaca, tidak bisa diubah.',
        ]);
    }
}
