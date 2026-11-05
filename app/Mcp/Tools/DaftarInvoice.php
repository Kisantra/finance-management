<?php

namespace App\Mcp\Tools;

use App\Models\Company;
use Laravel\Mcp\Request;

class DaftarInvoice extends AlatKeuangan
{
    protected string $name = 'daftar-invoice';

    protected string $description = 'Belum tersedia: alat ini sedang dibangun.';

    protected function izin(): string
    {
        return 'view invoices';
    }

    protected function jalankan(Request $request, Company $perusahaan): array
    {
        return ['catatan' => 'Alat ini belum tersedia.'];
    }
}
