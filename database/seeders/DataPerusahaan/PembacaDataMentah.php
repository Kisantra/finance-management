<?php

namespace Database\Seeders\DataPerusahaan;

use Carbon\CarbonImmutable;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as TanggalExcel;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Membaca satu berkas "Template Kelengkapan Data SPT Tahunan" (format konsultan Kisantra) menjadi
 * DataMentah: sheet 01 Identitas, 07 Arus Kas, dan 08 Invoice Jual. Berkas lain (rekap BUPOT,
 * laporan keuangan draft, dsb.) tidak punya sheet 01 Identitas dan dilewati (null).
 *
 * Kolom dicari lewat teks judulnya, bukan posisi tetap. Nominal dibulatkan ke rupiah penuh; tanggal
 * teks ("19 Maret 2025", "2-Mei-25", "21-08=2025") diurai, dan tanggal di luar tahun buku (salah ketik
 * 2026 untuk data 2025) dikembalikan ke tahun buku. Setiap koreksi dicatat di DataMentah::$catatan.
 */
final class PembacaDataMentah
{
    private const BULAN = [
        'JAN' => 1, 'FEB' => 2, 'PEB' => 2, 'MAR' => 3, 'APR' => 4, 'MEI' => 5, 'MAY' => 5, 'JUN' => 6,
        'JUL' => 7, 'AGU' => 8, 'AGT' => 8, 'AGS' => 8, 'AUG' => 8, 'SEP' => 9, 'OKT' => 10, 'OCT' => 10,
        'NOV' => 11, 'NOP' => 11, 'DES' => 12, 'DEC' => 12,
    ];

    /** Nama pelanggan untuk invoice yang di sheet tidak bernama customer. */
    public const PELANGGAN_KOSONG = 'Pelanggan Belum Tercatat';

    /** @var list<string> */
    private array $catatan = [];

    private int $tahunBuku = 0;

    public function baca(string $berkas): ?DataMentah
    {
        $pembaca = IOFactory::createReader('Xlsx');
        $pembaca->setReadDataOnly(true);
        $pembaca->setLoadSheetsOnly(['01 Identitas', '07 Arus Kas', '08 Invoice Jual']);
        $buku = $pembaca->load($berkas);

        $identitas = $buku->getSheetByName('01 Identitas');
        $arusKas = $buku->getSheetByName('07 Arus Kas');
        $invoice = $buku->getSheetByName('08 Invoice Jual');

        $nama = $identitas ? $this->isianIdentitas($identitas, 'Nama Perusahaan') : null;

        if ($nama === null || $arusKas === null || $invoice === null) {
            return null;
        }

        $this->catatan = [];
        $this->tahunBuku = $this->tahunBuku($arusKas);

        [$barisArusKas, $totalMasuk, $totalKeluar] = $this->arusKas($arusKas);
        [$invoices, $totalInvoice] = $this->invoices($invoice);

        $data = new DataMentah(
            berkas: $berkas,
            namaPerusahaan: $nama,
            tahunBuku: $this->tahunBuku,
            identitas: [
                'npwp' => $this->isianIdentitas($identitas, 'NPWP'),
                'alamat' => $this->alamat($identitas),
                'telepon' => $this->isianIdentitas($identitas, 'Nomor Telepon'),
                'email' => $this->isianIdentitas($identitas, 'Email Perusahaan'),
            ],
            rekening: $this->rekening($arusKas),
            arusKas: $barisArusKas,
            invoices: $invoices,
            totalSheet: ['masuk' => $totalMasuk, 'keluar' => $totalKeluar, 'invoice' => $totalInvoice],
            catatan: $this->catatan,
        );

        $buku->disconnectWorksheets();

        return $data;
    }

    /**
     * Nilai sel apa adanya; untuk sel rumus dipakai hasil terakhir yang tersimpan di berkas (tidak
     * dihitung ulang — rumus template bisa memakai fungsi yang tidak didukung PhpSpreadsheet).
     */
    private function sel(Worksheet $sheet, string $kolom, int $baris): mixed
    {
        $sel = $sheet->getCell($kolom.$baris);
        $nilai = $sel->isFormula() ? $sel->getOldCalculatedValue() : $sel->getValue();

        if (is_string($nilai)) {
            $nilai = trim(preg_replace('/\s+/u', ' ', $nilai));

            return $nilai === '' ? null : $nilai;
        }

        return $nilai;
    }

    private function teks(Worksheet $sheet, string $kolom, int $baris): ?string
    {
        $nilai = $this->sel($sheet, $kolom, $baris);

        if ($nilai === null) {
            return null;
        }

        if (is_float($nilai) && floor($nilai) === $nilai) {
            $nilai = number_format($nilai, 0, '', '');
        }

        return (string) $nilai;
    }

    private function isianIdentitas(Worksheet $sheet, string $label): ?string
    {
        for ($baris = 1; $baris <= min(60, $sheet->getHighestRow()); $baris++) {
            if (str_starts_with((string) $this->teks($sheet, 'B', $baris), $label)) {
                return $this->teks($sheet, 'C', $baris);
            }
        }

        return null;
    }

    private function alamat(Worksheet $sheet): ?string
    {
        $bagian = array_filter([
            $this->isianIdentitas($sheet, 'Alamat Lengkap'),
            $this->isianIdentitas($sheet, 'Kelurahan'),
            $this->isianIdentitas($sheet, 'Kota'),
        ]);

        return $bagian === [] ? null : implode(', ', $bagian);
    }

    /** Tahun buku dari judul sheet Arus Kas ("... JANUARI SAMPAI DESEMBER 2025"). */
    private function tahunBuku(Worksheet $sheet): int
    {
        preg_match_all('/\b(20\d{2})\b/', (string) $this->teks($sheet, 'B', 2), $cocok);

        return (int) (end($cocok[1]) ?: now()->subYear()->year);
    }

    /**
     * Tabel "A. Daftar Rekening Aktif" di atas rincian arus kas.
     *
     * @return list<array{bank: string, nomor: string|null, atas_nama: string|null}>
     */
    private function rekening(Worksheet $sheet): array
    {
        $rekening = [];

        for ($baris = 7; $baris <= 11; $baris++) {
            $bank = $this->teks($sheet, 'C', $baris);

            if ($bank !== null) {
                $rekening[] = [
                    'bank' => $bank,
                    'nomor' => $this->teks($sheet, 'E', $baris),
                    'atas_nama' => $this->teks($sheet, 'F', $baris),
                ];
            }
        }

        return $rekening;
    }

    /**
     * Baris judul tabel (berisi $penanda) dan peta kolom → huruf kolom, dicocokkan dari teks judul
     * dengan urutan $kunci (yang pertama cocok menang: "DPP (Rp) Tanpa PPN" harus jatuh ke dpp).
     *
     * @param  array<string, string>  $kunci  nama kolom => potongan teks judul
     * @return array{0: int, 1: array<string, string>}
     */
    private function judulTabel(Worksheet $sheet, string $penanda, array $kunci): array
    {
        $jumlahKolom = Coordinate::columnIndexFromString($sheet->getHighestColumn());

        for ($baris = 1; $baris <= 40; $baris++) {
            $judul = [];

            for ($indeks = 1; $indeks <= $jumlahKolom; $indeks++) {
                $kolom = Coordinate::stringFromColumnIndex($indeks);
                $judul[$kolom] = (string) $this->teks($sheet, $kolom, $baris);
            }

            if (! in_array(true, array_map(fn (string $teks): bool => str_contains($teks, $penanda), $judul), true)) {
                continue;
            }

            $peta = [];

            foreach ($judul as $kolom => $teks) {
                foreach ($kunci as $nama => $potongan) {
                    if (! isset($peta[$nama]) && $teks !== '' && str_contains(strtoupper($teks), strtoupper($potongan))) {
                        $peta[$nama] = $kolom;
                        break;
                    }
                }
            }

            return [$baris, $peta];
        }

        throw new \RuntimeException("Judul tabel \"{$penanda}\" tidak ditemukan di sheet {$sheet->getTitle()}.");
    }

    private function akhirTabel(?string ...$teks): bool
    {
        foreach ($teks as $isi) {
            if ($isi !== null && preg_match('/^(TOTAL|NET CASH FLOW|PETUNJUK)/i', $isi)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array{0: list<BarisArusKas>, 1: float|null, 2: float|null}
     */
    private function arusKas(Worksheet $sheet): array
    {
        [$judul, $kolom] = $this->judulTabel($sheet, 'Deskripsi Transaksi', [
            'tanggal' => 'Tanggal',
            'deskripsi' => 'Deskripsi',
            'pihak' => 'Pihak',
            'masuk' => 'Pemasukan',
            'keluar' => 'Pengeluaran',
            'referensi' => 'No. Bukti',
        ]);

        $hasil = [];
        $seksi = null;
        $tanggalSebelumnya = null;
        $totalMasuk = $totalKeluar = null;

        for ($baris = $judul + 1; $baris <= $sheet->getHighestRow(); $baris++) {
            $tanggalMentah = $this->sel($sheet, $kolom['tanggal'], $baris);

            if ($this->akhirTabel(is_string($tanggalMentah) ? $tanggalMentah : null, $this->teks($sheet, 'B', $baris))) {
                if (preg_match('/^TOTAL/i', (string) $tanggalMentah)) {
                    $totalMasuk = (float) $this->sel($sheet, $kolom['masuk'], $baris);
                    $totalKeluar = (float) $this->sel($sheet, $kolom['keluar'], $baris);
                }

                break;
            }

            $seksi = $this->teks($sheet, 'A', $baris) ?? $seksi;
            $deskripsi = (string) $this->teks($sheet, $kolom['deskripsi'], $baris);
            $masuk = $this->angka($this->sel($sheet, $kolom['masuk'], $baris), "Arus Kas baris {$baris}");
            $keluar = $this->angka($this->sel($sheet, $kolom['keluar'], $baris), "Arus Kas baris {$baris}");

            // Nominal negatif = salah kolom; dipindah ke arah sebaliknya.
            if ($masuk < 0 || $keluar < 0) {
                $this->catatan[] = "Arus Kas baris {$baris}: nominal negatif dipindah ke arah sebaliknya.";
                [$masuk, $keluar] = [max($masuk, 0) + abs(min($keluar, 0)), max($keluar, 0) + abs(min($masuk, 0))];
            }

            $masuk = (int) round($masuk);
            $keluar = (int) round($keluar);

            if ($masuk === 0 && $keluar === 0) {
                if ($deskripsi !== '') {
                    $this->catatan[] = "Arus Kas baris {$baris}: \"{$deskripsi}\" tanpa nominal, dilewati.";
                }

                continue;
            }

            $tanggal = $this->tanggal($tanggalMentah, "Arus Kas baris {$baris}");

            if ($tanggal === null) {
                $tanggal = $tanggalSebelumnya ?? CarbonImmutable::create($this->tahunBuku, 1, 1);
                $this->catatan[] = "Arus Kas baris {$baris}: tanggal kosong/tidak terbaca, dipakai {$tanggal->toDateString()} (baris sebelumnya).";
            }

            $tanggalSebelumnya = $tanggal;

            foreach ([[$masuk, 0], [0, $keluar]] as [$nilaiMasuk, $nilaiKeluar]) {
                if ($nilaiMasuk + $nilaiKeluar > 0) {
                    $hasil[] = new BarisArusKas(
                        baris: $baris,
                        seksi: $seksi,
                        tanggal: $tanggal,
                        deskripsi: $deskripsi !== '' ? $deskripsi : '(tanpa deskripsi)',
                        pihak: (string) $this->teks($sheet, $kolom['pihak'], $baris),
                        masuk: $nilaiMasuk,
                        keluar: $nilaiKeluar,
                        referensi: isset($kolom['referensi']) ? $this->teks($sheet, $kolom['referensi'], $baris) : null,
                    );
                }
            }
        }

        return [$hasil, $totalMasuk, $totalKeluar];
    }

    /**
     * @return array{0: list<InvoiceMentah>, 1: float}
     */
    private function invoices(Worksheet $sheet): array
    {
        [$judul, $kolom] = $this->judulTabel($sheet, 'Nama Customer', [
            'faktur' => 'Faktur',
            'nomor' => 'No. Invoice',
            'tanggal' => 'Tanggal',
            'pelanggan' => 'Customer',
            'npwp' => 'NPWP',
            'deskripsi' => 'Deskripsi',
            'kode' => 'Kode Objek',
            'dpp' => 'DPP',
            'ppn' => 'PPN',
            'total' => 'Total',
            'status' => 'Status',
            'keterangan' => 'Keterangan',
        ]);

        /** @var list<InvoiceMentah> $invoices */
        $invoices = [];
        $sekarang = null;
        $totalSheet = 0.0;

        for ($baris = $judul + 1; $baris <= $sheet->getHighestRow(); $baris++) {
            $nomor = $this->teks($sheet, $kolom['nomor'], $baris);
            $nomor = $nomor === null ? null : (preg_replace('/^INV(OICE)?\.?\s*NO\.?\s*/i', '', $nomor) ?: null);
            $tanggalMentah = $this->sel($sheet, $kolom['tanggal'], $baris);
            $faktur = $this->teks($sheet, $kolom['faktur'], $baris);
            $faktur = $faktur !== null && preg_match('/\d{8,}/', $faktur) ? $faktur : null;

            if ($this->akhirTabel($this->teks($sheet, 'B', $baris), $this->teks($sheet, 'C', $baris), $nomor)) {
                break;
            }

            $pelanggan = $this->teks($sheet, $kolom['pelanggan'], $baris);
            $deskripsi = $this->teks($sheet, $kolom['deskripsi'], $baris);
            $dppMentah = $this->sel($sheet, $kolom['dpp'], $baris);
            $ppnMentah = $this->sel($sheet, $kolom['ppn'], $baris);
            $totalMentah = $this->sel($sheet, $kolom['total'], $baris);

            if ($nomor === null && $pelanggan === null && $deskripsi === null && ! $dppMentah && ! $ppnMentah && ! $totalMentah) {
                continue;
            }

            // Baris berfaktur sendiri tanpa nomor/pelanggan/tanggal tetap invoice tersendiri (bukan item
            // invoice di atasnya) — pelanggannya tidak bisa ditebak.
            $fakturBaru = $faktur !== null && $sekarang !== null && ! in_array($faktur, $sekarang->faktur, true);
            $kepala = $nomor !== null || $pelanggan !== null || $tanggalMentah !== null || $fakturBaru;

            if ($kepala || $sekarang === null) {
                $tanggal = $this->tanggal($tanggalMentah, "Invoice Jual baris {$baris}");

                if ($tanggal === null) {
                    $tanggal = $sekarang?->tanggal ?? CarbonImmutable::create($this->tahunBuku, 1, 1);
                    $this->catatan[] = 'Invoice Jual baris '.$baris.($nomor !== null ? " ({$nomor})" : '').": tanggal kosong/tidak terbaca, dipakai {$tanggal->toDateString()} (invoice sebelumnya).";
                }

                if ($pelanggan === null && $nomor !== null && $sekarang !== null) {
                    $pelanggan = $sekarang->pelanggan;
                    $this->catatan[] = "Invoice Jual baris {$baris} ({$nomor}): nama customer kosong, dipakai \"{$pelanggan}\" (invoice sebelumnya).";
                } elseif ($pelanggan === null) {
                    $pelanggan = self::PELANGGAN_KOSONG;
                    $this->catatan[] = "Invoice Jual baris {$baris} (faktur {$faktur}): nomor invoice & nama customer kosong, dicatat sebagai \"".self::PELANGGAN_KOSONG.'" — lengkapi di aplikasi.';
                }

                $sekarang = new InvoiceMentah(
                    nomor: $nomor,
                    tanggal: $tanggal,
                    pelanggan: $pelanggan,
                    npwp: $this->npwp($this->sel($sheet, $kolom['npwp'], $baris)),
                    lunas: false,
                );
                $invoices[] = $sekarang;
            }

            $catatan = null;
            $dpp = $this->angka($dppMentah, "Invoice Jual baris {$baris}", $catatan);
            $ppn = $this->angka($ppnMentah, "Invoice Jual baris {$baris}");
            $total = is_numeric($totalMentah) ? (float) $totalMentah : $dpp + $ppn;
            $totalSheet += $total;

            $item = [
                'deskripsi' => $deskripsi ?? 'Item invoice',
                'dpp' => (int) round($dpp),
                'total' => (int) round($total),
                'catatan' => $catatan,
            ];
            $item['ppn'] = $item['total'] - $item['dpp'];

            $sekarang->item[] = $item;
            $sekarang->baris[] = $baris;
            $sekarang->lunas = $sekarang->lunas || (bool) preg_match('/^lunas/i', (string) $this->teks($sheet, $kolom['status'], $baris));

            if ($faktur !== null && ! in_array($faktur, $sekarang->faktur, true)) {
                $sekarang->faktur[] = $faktur;
            }
        }

        return [$this->gabungNomorSama($invoices), $totalSheet];
    }

    /**
     * Baris berbeda dengan nomor invoice sama (mis. jasa dan agency fee yang berbeda faktur) adalah
     * satu invoice. Nomor yang sama tetapi pelanggan berbeda dibiarkan terpisah — pemanggil memberi
     * akhiran agar nomor tetap unik.
     *
     * @param  list<InvoiceMentah>  $invoices
     * @return list<InvoiceMentah>
     */
    private function gabungNomorSama(array $invoices): array
    {
        $hasil = [];
        $perNomor = [];

        foreach ($invoices as $invoice) {
            $kunci = $invoice->nomor === null ? null : strtoupper(preg_replace('/\s+/', '', $invoice->nomor));
            $sama = $kunci !== null ? ($perNomor[$kunci] ?? null) : null;

            if ($sama !== null && NamaPihak::kunci($sama->pelanggan) === NamaPihak::kunci($invoice->pelanggan)) {
                $sama->item = [...$sama->item, ...$invoice->item];
                $sama->baris = [...$sama->baris, ...$invoice->baris];
                $sama->faktur = array_values(array_unique([...$sama->faktur, ...$invoice->faktur]));
                $sama->lunas = $sama->lunas || $invoice->lunas;
                $sama->npwp ??= $invoice->npwp;

                if ($invoice->tanggal->lt($sama->tanggal)) {
                    $sama->tanggal = $invoice->tanggal;
                }

                continue;
            }

            if ($kunci !== null) {
                $perNomor[$kunci] ??= $invoice;
            }

            $hasil[] = $invoice;
        }

        return $hasil;
    }

    /**
     * Angka dari sel: numerik apa adanya; teks "1.234.567" / "1,5" diurai; nilai mata uang asing
     * ("USD 2.077") tidak dikonversi — dicatat dan dianggap 0, sama seperti rumus total di sheet.
     */
    private function angka(mixed $nilai, string $lokasi, ?string &$catatan = null): float
    {
        if ($nilai === null || $nilai === '' || is_bool($nilai)) {
            return 0.0;
        }

        if (is_int($nilai) || is_float($nilai)) {
            return (float) $nilai;
        }

        $teks = trim((string) $nilai);

        if (preg_match('/^(USD|SGD|EUR|\$)/i', $teks)) {
            $catatan = "Nilai di sheet: {$teks} (mata uang asing, rupiahnya belum tercatat)";
            $this->catatan[] = "{$lokasi}: {$catatan}.";

            return 0.0;
        }

        $bersih = preg_replace('/[^\d,.\-]/', '', $teks);

        if ($bersih === '' || $bersih === '-') {
            return 0.0;
        }

        // Format Indonesia: titik = ribuan, koma = desimal.
        return (float) str_replace(',', '.', str_replace('.', '', $bersih));
    }

    /** NPWP sebagai teks digit; angka (nol depan hilang di Excel) dilengkapi ke 15/16 digit. */
    private function npwp(mixed $nilai): ?string
    {
        if ($nilai === null || $nilai === '') {
            return null;
        }

        if (is_float($nilai) || is_int($nilai)) {
            $digit = number_format((float) $nilai, 0, '', '');

            return str_pad($digit, strlen($digit) > 15 ? 16 : 15, '0', STR_PAD_LEFT);
        }

        $digit = preg_replace('/\D/', '', (string) $nilai);

        return strlen($digit) >= 15 ? $digit : null;
    }

    private function tanggal(mixed $nilai, string $lokasi): ?CarbonImmutable
    {
        $tanggal = match (true) {
            $nilai === null || $nilai === '' => null,
            is_int($nilai) || is_float($nilai) => $nilai > 20000 && $nilai < 80000
                ? CarbonImmutable::instance(TanggalExcel::excelToDateTimeObject($nilai))->startOfDay()
                : null,
            default => $this->tanggalTeks((string) $nilai),
        };

        if ($tanggal === null) {
            return null;
        }

        // Data tahun buku sebelumnya sah (rekap bisa dimulai beberapa bulan sebelumnya); di luar itu dianggap salah ketik.
        if ($tanggal->year > $this->tahunBuku || $tanggal->year < $this->tahunBuku - 1) {
            $koreksi = $tanggal->setDate($this->tahunBuku, $tanggal->month, min($tanggal->day, CarbonImmutable::create($this->tahunBuku, $tanggal->month)->daysInMonth));
            $this->catatan[] = "{$lokasi}: tanggal {$tanggal->toDateString()} di luar tahun buku {$this->tahunBuku}, dianggap salah ketik → {$koreksi->toDateString()}.";

            return $koreksi;
        }

        return $tanggal;
    }

    /** "19 Maret 2025", "2-Mei-25", "25-03-2025", "12-03-025", "21-08=2025". */
    private function tanggalTeks(string $teks): ?CarbonImmutable
    {
        if (! preg_match('/^\s*(\d{1,2})\s*[-\/.= ]\s*([A-Za-z]+|\d{1,2})\s*[-\/.= ]\s*(\d{2,5})\s*$/u', $teks, $m)) {
            return null;
        }

        $bulan = ctype_digit($m[2]) ? (int) $m[2] : (self::BULAN[strtoupper(substr($m[2], 0, 3))] ?? null);
        $tahun = (int) substr($m[3], -2) + 2000;

        if ($bulan === null || $bulan > 12 || ! checkdate($bulan, (int) $m[1], $tahun)) {
            return null;
        }

        return CarbonImmutable::create($tahun, $bulan, (int) $m[1]);
    }
}
