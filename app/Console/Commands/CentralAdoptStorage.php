<?php

namespace App\Console\Commands;

use App\Models\Company;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

/**
 * Pindahkan berkas deployment lama ke folder storage milik tenant.
 *
 * Sebelum multi-tenancy semua berkas hidup di `storage/app/public/`. Sesudahnya
 * `FilesystemTenancyBootstrapper` menambahkan sufiks tenant, sehingga aplikasi
 * membacanya dari `storage/tenant{slug}/app/public/`. Tanpa langkah pemindahan
 * ini, seluruh lampiran transaksi, bukti pencairan, dan berkas reimbursement
 * yang sudah ada tetap tersimpan di disk tetapi TIDAK PERNAH ditemukan aplikasi.
 *
 * Runbook menyebut pemindahan ini "bagian dari central:adopt-database", padahal
 * perintah itu hanya menyentuh database. Perintah ini menutup celah tersebut.
 */
class CentralAdoptStorage extends Command
{
    protected $signature = 'central:adopt-storage
        {slug : Slug perusahaan tujuan (harus sudah terdaftar)}
        {--sumber= : Folder asal (default: storage/app/public)}
        {--pindahkan : Pindahkan, bukan menyalin. Bawaan menyalin agar berkas asli tetap utuh}
        {--dry-run : Tampilkan apa yang akan dikerjakan tanpa menyentuh berkas}';

    protected $description = 'Salin/pindahkan berkas deployment lama (storage/app/public) ke folder storage tenant';

    public function handle(): int
    {
        $slug = $this->argument('slug');

        if (! Company::find($slug)) {
            $this->error("Company {$slug} belum terdaftar. Jalankan central:adopt-database lebih dulu.");

            return self::FAILURE;
        }

        $sumber = $this->option('sumber') ?: storage_path('app/public');
        $tujuan = storage_path("tenant{$slug}/app/public");

        if (! File::isDirectory($sumber)) {
            $this->error("Folder sumber tidak ditemukan: {$sumber}");

            return self::FAILURE;
        }

        $berkas = collect(File::allFiles($sumber));

        if ($berkas->isEmpty()) {
            $this->warn("Tidak ada berkas di {$sumber} — tidak ada yang dipindahkan.");

            return self::SUCCESS;
        }

        $total = $berkas->sum(fn ($f) => $f->getSize());

        $this->line("Sumber : {$sumber}");
        $this->line("Tujuan : {$tujuan}");
        $this->line('Berkas : '.$berkas->count().' ('.$this->ukuran($total).')');
        $this->line('Mode   : '.($this->option('pindahkan') ? 'PINDAHKAN' : 'salin (berkas asli tetap ada)'));
        $this->newLine();

        if ($this->option('dry-run')) {
            foreach ($berkas->take(15) as $f) {
                $this->line('  '.$f->getRelativePathname());
            }
            if ($berkas->count() > 15) {
                $this->line('  … dan '.($berkas->count() - 15).' berkas lain');
            }
            $this->newLine();
            $this->info('Dry-run: tidak ada berkas yang disentuh.');

            return self::SUCCESS;
        }

        $ditulis = 0;
        $dilewati = 0;

        foreach ($berkas as $f) {
            $tujuanBerkas = $tujuan.DIRECTORY_SEPARATOR.$f->getRelativePathname();

            // Idempoten: berkas yang sudah ada di tujuan tidak ditimpa, supaya
            // perintah ini aman dijalankan ulang saat cutover diulang.
            if (File::exists($tujuanBerkas)) {
                $dilewati++;

                continue;
            }

            File::ensureDirectoryExists(dirname($tujuanBerkas));

            if ($this->option('pindahkan')) {
                File::move($f->getPathname(), $tujuanBerkas);
            } else {
                File::copy($f->getPathname(), $tujuanBerkas);
            }

            $ditulis++;
        }

        $this->info("✓ {$ditulis} berkas dipindahkan, {$dilewati} dilewati (sudah ada di tujuan).");

        if (! $this->option('pindahkan')) {
            $this->warn('Berkas asli di '.$sumber.' TIDAK dihapus. Hapus manual setelah verifikasi.');
        }

        $this->line('Verifikasi: buka satu transaksi berlampiran di aplikasi dan pastikan pratinjaunya tampil.');

        return self::SUCCESS;
    }

    private function ukuran(int $byte): string
    {
        foreach (['B', 'KB', 'MB', 'GB'] as $satuan) {
            if ($byte < 1024) {
                return round($byte, 1).' '.$satuan;
            }
            $byte /= 1024;
        }

        return round($byte, 1).' TB';
    }
}
