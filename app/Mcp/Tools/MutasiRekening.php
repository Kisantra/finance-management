<?php

namespace App\Mcp\Tools;

use App\Models\Company;
use Laravel\Mcp\Request;

class MutasiRekening extends AlatKeuangan
{
    protected string $name = 'mutasi-rekening';

    protected string $description = 'Belum tersedia: alat ini sedang dibangun.';

    protected function izin(): string
    {
        return 'view bank-accounts';
    }

    protected function jalankan(Request $request, Company $perusahaan): array
    {
        return ['catatan' => 'Alat ini belum tersedia.'];
    }
}
