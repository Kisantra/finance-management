<?php

namespace App\Mcp\Tools;

use App\Models\BankAccount;
use App\Models\Company;
use Laravel\Mcp\Request;

/** Contoh acuan alat per perusahaan: izin modul + query di database perusahaan. */
class RekeningBank extends AlatKeuangan
{
    protected string $name = 'rekening-bank';

    protected string $description = 'Daftar rekening bank perusahaan beserta saldo saat ini. Saldo = saldo awal + pembayaran invoice yang masuk + transaksi masuk − transaksi keluar (dihitung, tidak disimpan).';

    protected function izin(): string
    {
        return 'view bank-accounts';
    }

    protected function jalankan(Request $request, Company $perusahaan): array
    {
        $rekening = BankAccount::query()->withBalance()->orderBy('bank_name')->orderBy('account_name')->get();

        return [
            'total_saldo' => $rekening->sum(fn (BankAccount $akun) => $akun->balance),
            'jumlah_rekening' => $rekening->count(),
            'rekening' => $rekening->map(fn (BankAccount $akun) => [
                'id' => $akun->id,
                'nama' => $akun->account_name,
                'bank' => $akun->bank_name,
                'nomor' => $akun->account_number,
                'cabang' => $akun->branch,
                'saldo_awal' => (int) $akun->initial_balance,
                'saldo' => $akun->balance,
            ])->values()->all(),
        ];
    }
}
