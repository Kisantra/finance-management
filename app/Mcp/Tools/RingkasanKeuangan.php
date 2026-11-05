<?php

namespace App\Mcp\Tools;

use App\Models\Company;
use Laravel\Mcp\Request;

class RingkasanKeuangan extends AlatKeuangan
{
    protected string $name = 'ringkasan-keuangan';

    protected string $description = 'Belum tersedia: alat ini sedang dibangun.';

    protected function izin(): string
    {
        return 'view dashboard';
    }

    protected function jalankan(Request $request, Company $perusahaan): array
    {
        return ['catatan' => 'Alat ini belum tersedia.'];
    }
}
