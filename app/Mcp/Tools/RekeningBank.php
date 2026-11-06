<?php

namespace App\Mcp\Tools;

use App\Models\BankAccount;
use App\Models\Company;
use Laravel\Mcp\Request;

/** Contoh acuan alat per perusahaan: izin modul + query di database perusahaan. */
class RekeningBank extends AlatKeuangan
{
    protected string $name = 'rekening-bank';

    protected string $description = 'Daftar akun Kas & Bank perusahaan beserta saldo saat ini. jenis: bank = rekening bank, kas = kas tunai/kas kecil (nomor-nya kode KAS-xxxx, bukan nomor rekening; bank-nya "Tunai"). Saldo = saldo awal + pembayaran invoice yang masuk + transaksi masuk − transaksi keluar (dihitung, tidak disimpan). total_saldo = total_bank + total_kas. Khusus kas: penanggung_jawab, plafon (batas saldo kas kecil) dan kurang_dari_plafon (plafon − saldo = dana yang perlu diisi ulang); null bila tidak berlaku.';

    protected function izin(): string
    {
        return 'view bank-accounts';
    }

    protected function jalankan(Request $request, Company $perusahaan): array
    {
        $rekening = BankAccount::query()->withBalance()->orderBy('bank_name')->orderBy('account_name')->get();
        $penanggungJawab = BankAccount::custodianNames($rekening);

        $totalSaldo = (int) $rekening->sum(fn (BankAccount $akun): int => $akun->balance);
        $totalKas = (int) $rekening->filter(fn (BankAccount $akun): bool => $akun->isCash())
            ->sum(fn (BankAccount $akun): int => $akun->balance);

        return [
            'total_saldo' => $totalSaldo,
            'total_bank' => $totalSaldo - $totalKas,
            'total_kas' => $totalKas,
            'jumlah_rekening' => $rekening->count(),
            'rekening' => $rekening->map(fn (BankAccount $akun) => [
                'id' => $akun->id,
                'jenis' => $akun->isCash() ? 'kas' : 'bank',
                'nama' => $akun->account_name,
                'bank' => $akun->bank_name,
                'nomor' => $akun->account_number,
                'cabang' => $akun->branch,
                'saldo_awal' => (int) $akun->initial_balance,
                'saldo' => $akun->balance,
                'penanggung_jawab' => $akun->custodian_id
                    ? ($penanggungJawab[$akun->custodian_id] ?? 'Pengguna dihapus')
                    : null,
                'plafon' => $akun->isCash() ? $akun->cash_limit : null,
                'kurang_dari_plafon' => $akun->isCash() && $akun->cash_limit ? $akun->refillAmount() : null,
            ])->values()->all(),
        ];
    }
}
