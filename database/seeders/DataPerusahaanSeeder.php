<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\User;
use Database\Seeders\DataPerusahaan\DataMentah;
use Database\Seeders\DataPerusahaan\ImporDataPerusahaan;
use Database\Seeders\DataPerusahaan\NamaPihak;
use Database\Seeders\DataPerusahaan\PembacaDataMentah;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Data keuangan perusahaan Mitra Group dari "data mentah" — berkas Excel Template Kelengkapan Data
 * SPT Tahunan (format konsultan Kisantra): akun & perusahaan lewat MitraGroupSeeder, lalu untuk
 * setiap perusahaan yang berkasnya ada: profil, kategori, rekening/kas, klien, invoice + pembayaran,
 * dan seluruh transaksi Arus Kas. Aturan pemetaannya: database/seeders/DataPerusahaan/.
 *
 * Data perusahaan TIDAK boleh masuk repositori (repo publik). Taruh berkas Excel-nya di
 * storage/data-mentah/ (boleh bersubfolder, nama bebas; folder ini di-gitignore), lalu:
 *
 *   php artisan db:seed --class=DataPerusahaanSeeder --force
 *
 * Berkas dikenali dari sheet "01 Identitas" › Nama Perusahaan; berkas lain di folder itu (rekap
 * BUPOT, laporan keuangan draft, dsb.) dilewati. Aman dijalankan ulang: perusahaan yang hanya berisi
 * hasil impor sebelumnya diimpor ulang dari nol, perusahaan yang sudah berisi data lain dilewati.
 * Hasil pencocokan dengan sheet dan semua koreksi ditulis ke storage/data-mentah/laporan-impor.md.
 */
class DataPerusahaanSeeder extends Seeder
{
    /** Folder berkas data mentah, relatif terhadap storage/. */
    public const FOLDER = 'data-mentah';

    /** Pengguna pusat yang tercatat sebagai "Diinput oleh" seluruh hasil impor; tidak bisa login. */
    public const EMAIL_PENCATAT = 'impor.data@mitragroup.id';

    /** Label status invoice di laporan. */
    private const STATUS = ['draft' => 'draf', 'sent' => 'terkirim', 'partially_paid' => 'dibayar sebagian', 'paid' => 'lunas'];

    /** Kunci di kolom `data` perusahaan (pusat) yang menyimpan jejak impor terakhir. */
    private const JEJAK = 'impor_data_mentah';

    /**
     * @param  string|null  $folder  folder data mentah; bawaan storage/data-mentah (test memakai folder sementara)
     */
    public function __construct(private ?string $folder = null) {}

    public function run(): void
    {
        $this->call(MitraGroupSeeder::class);

        // Ditentukan sebelum masuk konteks perusahaan: di dalamnya storage_path() mengarah ke folder tenant.
        $folder = $this->folder ?? storage_path(self::FOLDER);
        $data = $this->bacaFolder($folder);

        if ($data === []) {
            $this->command->warn("Tidak ada berkas Template Kelengkapan Data di {$folder} — salin berkas Excel data mentah ke sana lalu jalankan ulang.");

            return;
        }

        $pencatat = $this->pencatat();
        $semuaNama = array_column(MitraGroupSeeder::PERUSAHAAN, 'name');
        $direksi = self::direksi($data);
        $laporan = [];

        foreach (MitraGroupSeeder::PERUSAHAAN as $perusahaan) {
            $mentah = $data[$perusahaan['slug']] ?? null;

            if ($mentah === null) {
                $this->command->line("  • {$perusahaan['name']}: belum ada berkas data mentah — dilewati.");

                continue;
            }

            $company = Company::findOrFail($perusahaan['slug']);
            $penanggungJawabKas = User::where('email', MitraGroupSeeder::emailPerusahaan('staff', $perusahaan['abbreviation']))->value('id');
            $grup = array_values(array_diff($semuaNama, [$perusahaan['name']]));

            $hasil = $company->run(function () use ($mentah, $perusahaan, $grup, $pencatat, $penanggungJawabKas, $direksi, $company): ?array {
                $keadaan = ImporDataPerusahaan::keadaan($pencatat, $company->getAttribute(self::JEJAK));

                if ($keadaan === 'manual') {
                    return null;
                }

                // Hapus impor lama + impor baru dalam satu transaksi: gagal di tengah = data lama utuh.
                return DB::transaction(function () use ($keadaan, $mentah, $perusahaan, $grup, $pencatat, $penanggungJawabKas, $direksi): array {
                    if ($keadaan === 'impor') {
                        ImporDataPerusahaan::hapusImporLama();
                    }

                    return (new ImporDataPerusahaan($mentah, $perusahaan, $grup, $pencatat, $penanggungJawabKas, $direksi))->jalankan();
                });
            });

            if ($hasil === null) {
                $this->command->warn("  ! {$perusahaan['name']}: sudah berisi data yang bukan hasil impor ini — dilewati agar tidak tertimpa.");

                continue;
            }

            $company->setAttribute(self::JEJAK, [
                'berkas' => basename($mentah->berkas),
                'diimpor_pada' => now()->toDateTimeString(),
                'invoices' => $hasil['invoice']['jumlah'],
                'clients' => $hasil['klien'],
            ]);
            $company->save();

            $laporan[$perusahaan['slug']] = [$perusahaan, $mentah, $hasil];
            $this->ringkas($perusahaan, $hasil);
        }

        if ($laporan !== []) {
            File::put($folder.'/laporan-impor.md', $this->laporan($laporan));
            $this->command->info("✓ Laporan pencocokan & koreksi: {$folder}/laporan-impor.md");
        }
    }

    /**
     * Semua berkas .xlsx di folder (rekursif) yang berupa Template Kelengkapan Data, per slug
     * perusahaan. Berkas kembar (isi sama) diabaikan; dua berkas berbeda untuk satu perusahaan
     * membuat perusahaan itu dilewati — pilih salah satu dulu.
     *
     * @return array<string, DataMentah>
     */
    private function bacaFolder(string $folder): array
    {
        if (! File::isDirectory($folder)) {
            return [];
        }

        $pembaca = new PembacaDataMentah;
        $data = [];
        $sidik = [];
        $bentrok = [];

        foreach (File::allFiles($folder) as $berkas) {
            if (strtolower($berkas->getExtension()) !== 'xlsx' || str_starts_with($berkas->getFilename(), '~$')) {
                continue;
            }

            $mentah = $pembaca->baca($berkas->getPathname());

            if ($mentah === null) {
                continue;
            }

            $perusahaan = $this->perusahaanUntuk($mentah->namaPerusahaan);

            if ($perusahaan === null) {
                $this->command->warn("  ! {$berkas->getFilename()}: \"{$mentah->namaPerusahaan}\" bukan perusahaan Mitra Group — dilewati.");

                continue;
            }

            $slug = $perusahaan['slug'];
            $hash = md5_file($berkas->getPathname());

            if (isset($data[$slug]) && $sidik[$slug] !== $hash) {
                $bentrok[$slug][] = $berkas->getFilename();
            }

            $data[$slug] ??= $mentah;
            $sidik[$slug] ??= $hash;
        }

        foreach ($bentrok as $slug => $berkas) {
            $this->command->warn("  ! {$slug}: lebih dari satu berkas berbeda (".implode(', ', [basename($data[$slug]->berkas), ...$berkas]).') — dilewati, sisakan satu berkas.');
            unset($data[$slug]);
        }

        return $data;
    }

    /**
     * Nama direksi grup: pihak bertanda "(DIREKTUR)"/"(DIREKSI)" di Arus Kas semua berkas. Dipakai
     * mengenali biaya direksi di perusahaan yang mencatat namanya tanpa tanda itu.
     *
     * @param  array<string, DataMentah>  $data
     * @return list<string>
     */
    private static function direksi(array $data): array
    {
        $nama = [];

        foreach ($data as $mentah) {
            foreach ($mentah->arusKas as $baris) {
                if (preg_match_all('/([A-Z][A-Z .\']{2,}?)\s*\((DIREKTUR|DIREKSI)\)/i', $baris->pihak, $cocok)) {
                    foreach ($cocok[1] as $calon) {
                        $calon = trim(preg_replace('/^.*(->|>)\s*/', '', strtoupper($calon)));

                        if (strlen($calon) >= 4 && ! preg_match('/^PT\b/', $calon)) {
                            $nama[] = $calon;
                        }
                    }
                }
            }
        }

        return array_values(array_unique($nama));
    }

    /** @return array{slug: string, name: string, abbreviation: string, holding?: bool}|null */
    private function perusahaanUntuk(string $nama): ?array
    {
        foreach (MitraGroupSeeder::PERUSAHAAN as $perusahaan) {
            if (NamaPihak::sama(NamaPihak::kunci($perusahaan['name']), NamaPihak::kunci($nama))) {
                return $perusahaan;
            }
        }

        return null;
    }

    private function pencatat(): int
    {
        return User::firstOrCreate(
            ['email' => self::EMAIL_PENCATAT],
            ['name' => 'Impor Data Mentah', 'password' => Hash::make(Str::random(40))],
        )->id;
    }

    /**
     * @param  array{name: string}  $perusahaan
     * @param  array<string, mixed>  $hasil
     */
    private function ringkas(array $perusahaan, array $hasil): void
    {
        $arusKas = $hasil['arus_kas'];
        $invoice = $hasil['invoice'];
        $cocok = $arusKas['masuk_impor'] === $arusKas['masuk_sheet'] && $arusKas['keluar_impor'] === $arusKas['keluar_sheet']
            && $invoice['total_impor'] === $invoice['total_sheet'];

        $this->command->info(sprintf(
            '  %s %s: %d baris arus kas (masuk Rp %s, keluar Rp %s), %d invoice Rp %s, %d klien%s',
            $cocok ? '✓' : '✗',
            $perusahaan['name'],
            $arusKas['baris'],
            self::rupiah($arusKas['masuk_impor']),
            self::rupiah($arusKas['keluar_impor']),
            $invoice['jumlah'],
            self::rupiah($invoice['total_impor']),
            $hasil['klien'],
            $cocok ? '' : ' — TIDAK COCOK dengan sheet, lihat laporan',
        ));
    }

    /**
     * @param  array<string, array{0: array{name: string}, 1: DataMentah, 2: array<string, mixed>}>  $laporan
     */
    private function laporan(array $laporan): string
    {
        $isi = ['# Laporan impor data mentah', '', 'Dibuat '.now()->format('d-m-Y H:i').' oleh `DataPerusahaanSeeder`. Berisi data perusahaan — jangan di-commit.', ''];

        foreach ($laporan as [$perusahaan, $mentah, $hasil]) {
            $arusKas = $hasil['arus_kas'];
            $invoice = $hasil['invoice'];

            $isi[] = "## {$perusahaan['name']}";
            $isi[] = '';
            $isi[] = 'Berkas: `'.basename($mentah->berkas).'` · tahun buku '.$mentah->tahunBuku;
            $isi[] = '';
            $isi[] = '| | Sheet (jumlah baris) | Aplikasi | Cocok |';
            $isi[] = '|---|---:|---:|:---:|';
            $isi[] = self::barisTabel('Arus Kas — pemasukan', $arusKas['masuk_sheet'], $arusKas['masuk_impor']);
            $isi[] = self::barisTabel('Arus Kas — pengeluaran', $arusKas['keluar_sheet'], $arusKas['keluar_impor']);
            $isi[] = self::barisTabel('Invoice Jual — total', $invoice['total_sheet'], $invoice['total_impor']);
            $isi[] = '';
            foreach (['masuk' => 'pemasukan', 'keluar' => 'pengeluaran'] as $arah => $label) {
                $baris = (int) round($arusKas['total_baris_sheet'][$arah] ?? 0);

                if ($arusKas['total_baris_sheet'][$arah] !== null && abs($baris - $arusKas[$arah.'_sheet']) > count($mentah->arusKas)) {
                    $isi[] = sprintf(
                        '> Baris TOTAL %s di sheet berisi Rp %s, berbeda dengan jumlah barisnya (Rp %s) — rumus TOTAL di sheet tidak mencakup semua baris. Aplikasi mengikuti baris-barisnya.',
                        $label,
                        self::rupiah($baris),
                        self::rupiah($arusKas[$arah.'_sheet']),
                    );
                    $isi[] = '';
                }
            }

            $isi[] = sprintf(
                '%d invoice (%s). Dibayar dari penerimaan di Arus Kas: Rp %s. Dilunasi sesuai kolom Status Bayar "Lunas" (akun "%s"): Rp %s.',
                $invoice['jumlah'],
                $invoice['status'] === [] ? '-' : implode(', ', array_map(fn (string $status, int $jumlah): string => (self::STATUS[$status] ?? $status).": {$jumlah}", array_keys($invoice['status']), $invoice['status'])),
                self::rupiah($invoice['dibayar_arus_kas']),
                ImporDataPerusahaan::AKUN_LUNAS,
                self::rupiah($invoice['dibayar_status_lunas']),
            );
            $isi[] = '';
            $isi[] = '| Kategori transaksi | Baris | Nominal |';
            $isi[] = '|---|---:|---:|';

            foreach ($hasil['kategori'] as $kategori => ['jumlah' => $jumlah, 'nominal' => $nominal]) {
                $isi[] = "| {$kategori} | {$jumlah} | ".self::rupiah($nominal).' |';
            }

            $catatan = [...$hasil['peringatan'], ...$mentah->catatan];

            if ($catatan !== []) {
                $isi[] = '';
                $isi[] = '**Perlu diperhatikan / koreksi saat membaca:**';
                $isi[] = '';

                foreach ($catatan as $baris) {
                    $isi[] = "- {$baris}";
                }
            }

            $isi[] = '';
        }

        return implode("\n", $isi);
    }

    private static function barisTabel(string $label, int $sheet, int $aplikasi): string
    {
        return "| {$label} | ".self::rupiah($sheet).' | '.self::rupiah($aplikasi).' | '.($sheet === $aplikasi ? '✓' : '✗ selisih '.self::rupiah($aplikasi - $sheet)).' |';
    }

    private static function rupiah(int $nilai): string
    {
        return number_format($nilai, 0, ',', '.');
    }
}
