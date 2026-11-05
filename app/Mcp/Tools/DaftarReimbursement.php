<?php

namespace App\Mcp\Tools;

use App\Models\Company;
use Laravel\Mcp\Request;

class DaftarReimbursement extends AlatKeuangan
{
    protected string $name = 'daftar-reimbursement';

    protected string $description = 'Belum tersedia: alat ini sedang dibangun.';

    protected function izin(): string
    {
        return 'view reimbursements';
    }

    protected function jalankan(Request $request, Company $perusahaan): array
    {
        return ['catatan' => 'Alat ini belum tersedia.'];
    }
}
