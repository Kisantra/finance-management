<?php

namespace Database\Seeders;

use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\TransactionCategory;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Data demo jenis akun Kas & Bank (docs/module/bank-accounts.md › Jenis akun Kas & Bank), dijalankan
 * DI DALAM konteks perusahaan setelah BankAccountSeeder:
 *  - Kas Kecil Kantor: penanggung jawab staff@gmail.com, plafon Rp 5.000.000, diisi ulang lewat
 *    transfer dari rekening bank + biaya admin, saldo akhir di bawah plafon ("Perlu isi ulang").
 *  - Kas Tunai Proyek: penanggung jawab manager@gmail.com, tanpa plafon.
 *  - Satu transfer bank → bank bulan ini, supaya Ringkasan menampilkan irisan "Biaya admin transfer".
 *
 * Tanggal relatif terhadap hari ini (bulan lalu + bulan berjalan, tidak pernah melewati hari ini)
 * agar Ringkasan "bulan ini" langsung berisi. Transfer dibuat persis seperti
 * BankTransactionController::transfer(): kaki debit = jumlah + biaya admin, kaki kredit = jumlah,
 * satu `transfer_group_id`.
 *
 * Idempoten: dilewati bila perusahaan sudah punya akun kas. Jalankan ulang untuk satu perusahaan:
 *   php artisan tenants:seed --tenants=kisantra --class="Database\Seeders\KasBankSeeder"
 */
class KasBankSeeder extends Seeder
{
    public function run(): void
    {
        if (BankAccount::query()->where('type', BankAccount::TYPE_CASH)->exists()) {
            $this->command->info('• KasBankSeeder dilewati: perusahaan ini sudah punya akun kas.');

            return;
        }

        $operasional = BankAccount::query()->where('type', BankAccount::TYPE_BANK)->where('account_name', 'BCA - Operasional')->first();
        $payroll = BankAccount::query()->where('type', BankAccount::TYPE_BANK)->where('account_name', 'Mandiri - Payroll')->first();
        $investasi = BankAccount::query()->where('type', BankAccount::TYPE_BANK)->where('account_name', 'BNI - Investasi')->first();
        $antarRekening = $this->kategori('transfer', 'Antar Rekening Sendiri');

        if (! $operasional || ! $payroll || ! $investasi || ! $antarRekening) {
            $this->command->error('⚠ Jalankan BankAccountSeeder dan TransactionCategorySeeder terlebih dahulu!');

            return;
        }

        $staffId = User::query()->where('email', 'staff@gmail.com')->value('id');
        $managerId = User::query()->where('email', 'manager@gmail.com')->value('id');

        $kasKantor = BankAccount::create([
            'type' => BankAccount::TYPE_CASH,
            'account_name' => 'Kas Kecil Kantor',
            'initial_balance' => 0,
            'custodian_id' => $staffId,
            'cash_limit' => 5_000_000,
        ]);

        $kasProyek = BankAccount::create([
            'type' => BankAccount::TYPE_CASH,
            'account_name' => 'Kas Tunai Proyek',
            'initial_balance' => 0,
            'custodian_id' => $managerId,
        ]);

        // Bulan lalu
        $this->transfer($operasional, $kasKantor, 5_000_000, 6_500, $this->tanggal(1, 1), $antarRekening, 'Isi ulang Kas Kecil Kantor');
        $this->transaksi($kasKantor, 'debit', 450_000, $this->tanggal(1, 5), 'Konsumsi Kantor & Rapat', 'Konsumsi rapat bulanan', $staffId);
        $this->transaksi($kasKantor, 'debit', 1_250_000, $this->tanggal(1, 12), 'BBM, Tol & Parkir', 'Bensin, tol & parkir kurir', $staffId);
        $this->transaksi($kasKantor, 'debit', 800_000, $this->tanggal(1, 20), 'Kebersihan & Keamanan', 'Galon, sabun & tisu kantor', $staffId);
        $this->transfer($payroll, $kasProyek, 10_000_000, 2_500, $this->tanggal(1, 15), $antarRekening, 'Uang muka kas proyek');
        $this->transaksi($kasProyek, 'debit', 3_200_000, $this->tanggal(1, 18), 'Tiket Perjalanan Dinas', 'Tiket & hotel survei klien Surabaya', $managerId);
        $this->transaksi($kasProyek, 'credit', 350_000, $this->tanggal(1, 25), 'Pengembalian Dana (Refund)', 'Pengembalian sisa uang muka perjalanan', $managerId);

        // Bulan berjalan
        $this->transfer($operasional, $kasKantor, 2_500_000, 6_500, $this->tanggal(0, 2), $antarRekening, 'Isi ulang Kas Kecil Kantor');
        $this->transaksi($kasKantor, 'debit', 650_000, $this->tanggal(0, 3), 'Jamuan Klien', 'Konsumsi tamu klien', $staffId);
        $this->transaksi($kasKantor, 'debit', 1_100_000, $this->tanggal(0, 5), 'Servis Kendaraan', 'Servis motor kurir', $staffId);
        $this->transaksi($kasKantor, 'debit', 425_000, $this->tanggal(0, 7), 'ATK & Perlengkapan Kantor', 'Alat tulis kantor', $staffId);
        $this->transaksi($kasProyek, 'debit', 1_150_000, $this->tanggal(0, 4), 'Transportasi Lokal', 'Transport lokal tim proyek', $managerId);
        $this->transfer($investasi, $operasional, 15_000_000, 6_500, $this->tanggal(0, 8), $antarRekening, 'Pindah dana ke rekening operasional');

        $this->command->info('✓ Seeded Kas & Bank: 2 akun kas (Kas Kecil Kantor perlu isi ulang Rp 2.175.000), 4 transfer antar akun, 9 transaksi kas');
    }

    /**
     * Tanggal hari ke-$hari pada $bulanLalu bulan sebelum bulan ini, tidak pernah melewati hari ini.
     */
    private function tanggal(int $bulanLalu, int $hari): Carbon
    {
        return now()->startOfMonth()->subMonthsNoOverflow($bulanLalu)->addDays($hari - 1)->min(today());
    }

    private function kategori(string $type, string $label): ?TransactionCategory
    {
        return TransactionCategory::query()
            ->where('type', $type)
            ->where('label', $label)
            ->whereNotNull('parent_id')
            ->first();
    }

    private function transaksi(BankAccount $akun, string $jenis, int $jumlah, Carbon $tanggal, string $kategori, string $deskripsi, ?int $pencatatId): void
    {
        $transaksi = new BankTransaction([
            'bank_account_id' => $akun->id,
            'category_id' => $this->kategori($jenis === 'credit' ? 'income' : 'expense', $kategori)?->id,
            'amount' => $jumlah,
            'transaction_date' => $tanggal,
            'transaction_type' => $jenis,
            'description' => $deskripsi,
        ]);
        $transaksi->created_by = $pencatatId;
        $transaksi->save();
    }

    private function transfer(BankAccount $dari, BankAccount $ke, int $jumlah, int $biayaAdmin, Carbon $tanggal, TransactionCategory $kategori, string $deskripsi): void
    {
        $groupId = (string) Str::ulid();
        $referensi = 'TRF'.$tanggal->format('Ymd').'-'.substr($groupId, -6);

        BankTransaction::create([
            'bank_account_id' => $dari->id,
            'category_id' => $kategori->id,
            'amount' => $jumlah + $biayaAdmin,
            'transaction_date' => $tanggal,
            'transaction_type' => 'debit',
            'description' => 'Transfer + Admin Fee - '.$deskripsi,
            'reference_number' => $referensi,
            'transfer_group_id' => $groupId,
        ]);

        BankTransaction::create([
            'bank_account_id' => $ke->id,
            'category_id' => $kategori->id,
            'amount' => $jumlah,
            'transaction_date' => $tanggal,
            'transaction_type' => 'credit',
            'description' => 'Transfer masuk - '.$deskripsi,
            'reference_number' => $referensi,
            'transfer_group_id' => $groupId,
        ]);
    }
}
