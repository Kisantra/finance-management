<?php

namespace Database\Seeders\DataPerusahaan;

/**
 * Memasangkan penerimaan pelanggan di Arus Kas ke invoice di sheet Invoice Jual, supaya uangnya
 * tercatat sebagai pembayaran invoice (bukan pendapatan kedua). Urutan pencarian invoice untuk satu
 * penerimaan, diproses kronologis:
 *
 * 1. Nomor invoice yang disebut di deskripsi ("INV. 005/LNS-CP/IX/2025"). Bulan romawi diabaikan
 *    karena sering beda dengan sheet; nomor urut saja ("INVOICE 033") juga dicocokkan.
 * 2. Nama kapal ("MV. CONTOH JAYA") yang muncul di item invoice.
 * 3. Sisa uang: invoice terbuka tertua milik pelanggan yang sama (bukan setelah tanggal penerimaan).
 *
 * Dari kandidat itu, invoice yang sisa tagihannya ±5% dari penerimaan didahulukan; selebihnya
 * dibagi berurutan sesuai tanggal invoice. Sisa uang yang tidak menemukan invoice dikembalikan
 * bersama jenisnya (SISA_*): pendapatan jasa tanpa invoice, penerimaan belum teridentifikasi
 * (menyebut invoice yang tagihannya sudah habis — kemungkinan tercatat dobel), atau dana titipan.
 */
final class PencocokanPenerimaan
{
    /** Sisa penerimaan tanpa rujukan invoice apa pun: pendapatan jasa tanpa invoice. */
    public const SISA_PENDAPATAN = 'pendapatan';

    /** Sisa penerimaan yang menyebut invoice/kapal tertentu tetapi tagihannya sudah habis (bayar/catat dobel). */
    public const SISA_BELUM_TERIDENTIFIKASI = 'belum-teridentifikasi';

    /** Penerimaan untuk invoice perusahaan lain di grup (dana titipan). */
    public const SISA_TITIPAN = 'titipan';

    /** @var array<int, int> sisa tagihan per indeks invoice */
    private array $sisaTagihan = [];

    /** @var array<int, list<string>> nama kapal (dinormalisasi) per indeks invoice */
    private array $kapal = [];

    /** @var array<int, string> kunci nomor invoice (tanpa bulan/tahun) per indeks invoice */
    private array $kunciNomor = [];

    /** @var list<string> kode perusahaan di nomor invoice sendiri ("LNS", "AOE", ...) */
    private array $kodeSendiri = [];

    /** @var list<string> kunci nama semua pelanggan invoice */
    private array $pelanggan = [];

    /**
     * @param  list<InvoiceMentah>  $invoices
     */
    public function __construct(private array $invoices)
    {
        foreach ($invoices as $indeks => $invoice) {
            $this->sisaTagihan[$indeks] = $invoice->total();
            $this->kunciNomor[$indeks] = $invoice->nomor !== null ? self::kunciNomor($invoice->nomor) : '';
            $this->kapal[$indeks] = array_values(array_unique(array_filter(array_map(
                fn (array $item): ?string => self::namaKapal($item['deskripsi']),
                $invoice->item,
            ))));

            if ($invoice->nomor !== null && preg_match('/^\d+[A-Z]?\/([A-Z]+)/', strtoupper($invoice->nomor), $cocok)) {
                $this->kodeSendiri[] = $cocok[1];
            }

            $this->pelanggan[] = NamaPihak::kunci($invoice->pelanggan);
        }

        $this->pelanggan = array_values(array_unique($this->pelanggan));

        $this->kodeSendiri = array_values(array_unique($this->kodeSendiri));
    }

    /**
     * @param  array<int, BarisArusKas>  $penerimaan  penerimaan pelanggan, dikunci indeks baris arus kas
     * @return array{
     *     alokasi: array<int, list<array{invoice: int, jumlah: int}>>,
     *     sisa: array<int, int>,
     *     jenisSisa: array<int, self::SISA_*>,
     * }
     */
    public function cocokkan(array $penerimaan): array
    {
        uasort($penerimaan, fn (BarisArusKas $a, BarisArusKas $b): int => [$a->tanggal, $a->baris] <=> [$b->tanggal, $b->baris]);

        $alokasi = $sisa = $jenisSisa = [];

        foreach ($penerimaan as $kunci => $baris) {
            $uang = $baris->masuk;
            $alokasi[$kunci] = [];

            $menurutNomor = $this->menurutNomor($baris);
            $menurutKapal = $this->menurutKapal($baris);

            // Penerimaan yang menyebut nomor/kapal tertentu tidak dialihkan ke invoice lain pelanggan itu:
            // sisanya (bayar dobel, invoice perusahaan lain) tetap sisa.
            $menurutPelanggan = $this->menyebutRujukan($baris) ? [] : $this->menurutPelanggan($baris);

            foreach ([$menurutNomor, $menurutKapal, $menurutPelanggan] as $kandidat) {
                if ($uang === 0) {
                    break;
                }

                foreach ($this->urutkan($kandidat, $uang) as $indeks) {
                    $bagian = min($uang, $this->sisaTagihan[$indeks]);

                    if ($bagian <= 0) {
                        continue;
                    }

                    $alokasi[$kunci][] = ['invoice' => $indeks, 'jumlah' => $bagian];
                    $this->sisaTagihan[$indeks] -= $bagian;
                    $uang -= $bagian;

                    if ($uang === 0) {
                        break;
                    }
                }
            }

            $sisa[$kunci] = $uang;
            $jenisSisa[$kunci] = match (true) {
                $alokasi[$kunci] === [] && $this->menyebutInvoiceLain($baris) => self::SISA_TITIPAN,
                $this->menyebutRujukan($baris) => self::SISA_BELUM_TERIDENTIFIKASI,
                default => self::SISA_PENDAPATAN,
            };
        }

        return ['alokasi' => $alokasi, 'sisa' => $sisa, 'jenisSisa' => $jenisSisa];
    }

    /** Sisa tagihan setiap invoice setelah cocokkan(). @return array<int, int> */
    public function sisaTagihan(): array
    {
        return $this->sisaTagihan;
    }

    /** "005/LNS-CP/IX/2025" → "005/LNS-CP"; "001/AOE-CP/INV-FINAL/I/2025" → "001/AOE-CP/INV-FINAL". */
    public static function kunciNomor(string $nomor): string
    {
        $nomor = rtrim(strtoupper(preg_replace('/\s+/', '', $nomor)), './-');
        $nomor = preg_replace('/^INV(OICE)?\.?(NO\.?)?/', '', $nomor);

        return preg_replace('/\/[IVX]+\/\d{2,4}$|\/\d{4}$/', '', $nomor);
    }

    /** Nama kapal dari teks item ("JASA MV. CONTOH JAYA [1]" → "CONTOHJAYA"), atau null. */
    public static function namaKapal(string $teks): ?string
    {
        if (! preg_match('/\bM\.?\s?V\.?\s*([A-Z0-9][A-Z0-9 .\-]*)/i', strtoupper($teks), $cocok)) {
            return null;
        }

        $nama = preg_replace('/\s*[\[(].*$/', '', $cocok[1]);
        $nama = preg_replace('/[^A-Z0-9]/', '', $nama);

        return strlen($nama) >= 3 ? $nama : null;
    }

    /** @return list<int> */
    private function menurutNomor(BarisArusKas $baris): array
    {
        $teks = strtoupper(preg_replace('/\s*\/\s*/', '/', $baris->deskripsi));
        $hasil = [];

        preg_match_all('/\b\d{3}[A-Z]?\/[A-Z0-9][A-Z0-9.\-\/]*/', $teks, $nomor);

        foreach ($nomor[0] as $sebut) {
            $kunci = self::kunciNomor($sebut);

            foreach ($this->kunciNomor as $indeks => $kunciInvoice) {
                if ($kunciInvoice !== '' && $kunciInvoice === $kunci) {
                    $hasil[] = $indeks;
                }
            }
        }

        // "INVOICE 033" — hanya nomor urut, dicocokkan dengan pelanggan yang sama.
        if ($hasil === [] && preg_match('/\bINV(?:OICE)?\.?\s*(?:NO\.?\s*)?(\d{3})\b(?!\/)/', $teks, $urut)) {
            foreach ($this->invoices as $indeks => $invoice) {
                if ($invoice->nomor !== null && str_starts_with($invoice->nomor, $urut[1].'/') && $this->pelangganSama($baris, $invoice)) {
                    $hasil[] = $indeks;
                }
            }
        }

        return array_values(array_unique($hasil));
    }

    /** @return list<int> */
    private function menurutKapal(BarisArusKas $baris): array
    {
        $teks = preg_replace('/[^A-Z0-9]/', '', strtoupper($baris->deskripsi));
        $hasil = [];

        foreach ($this->kapal as $indeks => $daftarKapal) {
            foreach ($daftarKapal as $kapal) {
                if ($this->memuatKapal($teks, $kapal)) {
                    if ($this->pelangganSama($baris, $this->invoices[$indeks], longgar: true)) {
                        $hasil[] = $indeks;
                    }

                    break;
                }
            }
        }

        return $hasil;
    }

    /** Teks memuat nama kapal; nama ≥ 7 huruf boleh salah ketik satu huruf ("CONTOH JAYO" = "CONTOH JAYA"). */
    private function memuatKapal(string $teks, string $kapal): bool
    {
        if (str_contains($teks, 'MV'.$kapal) || (strlen($kapal) >= 6 && str_contains($teks, $kapal))) {
            return true;
        }

        if (strlen($kapal) < 7) {
            return false;
        }

        for ($mulai = 0; $mulai + strlen($kapal) <= strlen($teks); $mulai++) {
            if (levenshtein(substr($teks, $mulai, strlen($kapal)), $kapal) <= 1) {
                return true;
            }
        }

        return false;
    }

    /** Deskripsi menyebut nomor invoice atau kapal tertentu. */
    private function menyebutRujukan(BarisArusKas $baris): bool
    {
        $teks = strtoupper(preg_replace('/\s*\/\s*/', '/', $baris->deskripsi));

        return (bool) preg_match('/\b\d{3}[A-Z]?\/[A-Z]+|\bM\.?\s?V\b|\bINV(OICE)?\.?\s*(NO\.?\s*)?\d{3}\b/', $teks);
    }

    /** @return list<int> */
    private function menurutPelanggan(BarisArusKas $baris): array
    {
        $hasil = [];

        foreach ($this->invoices as $indeks => $invoice) {
            if ($invoice->tanggal->lte($baris->tanggal) && $this->pelangganSama($baris, $invoice)) {
                $hasil[] = $indeks;
            }
        }

        return $hasil;
    }

    /**
     * Kandidat dengan sisa tagihan ±5% dari uang yang diterima didahulukan; sisanya urut tanggal.
     *
     * @param  list<int>  $kandidat
     * @return list<int>
     */
    private function urutkan(array $kandidat, int $uang): array
    {
        $kandidat = array_values(array_filter($kandidat, fn (int $indeks): bool => $this->sisaTagihan[$indeks] > 0));

        usort($kandidat, function (int $a, int $b) use ($uang): int {
            $pasA = abs($this->sisaTagihan[$a] - $uang) <= $uang * 0.05;
            $pasB = abs($this->sisaTagihan[$b] - $uang) <= $uang * 0.05;

            return [$pasB, $this->invoices[$a]->tanggal, $a] <=> [$pasA, $this->invoices[$b]->tanggal, $b];
        });

        return $kandidat;
    }

    /**
     * Pengirim di kolom Pihak ("PT. CONTOH PELAYARAN > PT. LNS") sama dengan pelanggan
     * invoice. Longgar (dipakai saat nomor/kapal sudah spesifik): pengirim yang bukan pelanggan mana
     * pun — kosong, perusahaan sendiri, salah ketik berat — juga diterima; pelanggan lain tidak.
     */
    private function pelangganSama(BarisArusKas $baris, InvoiceMentah $invoice, bool $longgar = false): bool
    {
        $pengirim = trim(preg_split('/\s*(?:->|>)\s*/', $baris->pihak)[0] ?? '');
        $kunciPengirim = NamaPihak::kunci($pengirim);

        if (self::cocokNama($kunciPengirim, NamaPihak::kunci($invoice->pelanggan))) {
            return true;
        }

        if (! $longgar) {
            return false;
        }

        foreach ($this->pelanggan as $pelanggan) {
            if (self::cocokNama($kunciPengirim, $pelanggan)) {
                return false;
            }
        }

        return true;
    }

    private static function cocokNama(string $a, string $b): bool
    {
        if ($a === '' || $b === '') {
            return false;
        }

        return NamaPihak::sama($a, $b)
            || (strlen($b) >= 10 && str_contains($a, $b))
            || (strlen($a) >= 10 && str_contains($b, $a));
    }

    /** Deskripsi menyebut nomor invoice berkode perusahaan lain (mis. menerima pelunasan invoice milik perusahaan grup lain). */
    private function menyebutInvoiceLain(BarisArusKas $baris): bool
    {
        $teks = strtoupper(preg_replace('/\s*\/\s*/', '/', $baris->deskripsi));

        if (! preg_match_all('/\b\d{3}[A-Z]?\/([A-Z]+)-/', $teks, $kode) || $this->kodeSendiri === []) {
            return false;
        }

        return array_diff($kode[1], $this->kodeSendiri) !== [];
    }
}
