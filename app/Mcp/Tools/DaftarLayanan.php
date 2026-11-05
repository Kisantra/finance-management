<?php

namespace App\Mcp\Tools;

use App\Models\Company;
use Laravel\Mcp\Request;

class DaftarLayanan extends AlatKeuangan
{
    protected string $name = 'daftar-layanan';

    protected string $description = 'Belum tersedia: alat ini sedang dibangun.';

    protected function izin(): string
    {
        return 'view services';
    }

    protected function jalankan(Request $request, Company $perusahaan): array
    {
        return ['catatan' => 'Alat ini belum tersedia.'];
    }
}
