<?php

namespace Database\Seeders\DataPerusahaan;

/**
 * Menentukan kategori setiap baris sheet 07 Arus Kas. Kolom Kategori di sheet tidak pernah diisi,
 * jadi kategorinya disimpulkan dari deskripsi dan kolom Pihak.
 *
 * Urutannya:
 * 1. Mutasi dengan staf pemegang dana (pendanaan, tidak masuk Laba Rugi). Kolom Pihak menulis arah
 *    uang ("PT. AOE -> SITI", "RUDI HARTONO > OPERASIONAL"). Siapa pun yang pernah tercatat
 *    membayarkan uang ke pihak lain dianggap staf pemegang dana; uang perusahaan → staf adalah
 *    penyerahan dana, staf → perusahaan adalah pengembalian. Pembayaran staf ke vendor tetap biaya.
 * 2. Aturan kata kunci ATURAN, berurutan — yang pertama cocok menang. Pola dicocokkan ke
 *    "DESKRIPSI ‖ PIHAK" (huruf besar).
 * 3. Sisa: pemasukan dari badan usaha = penerimaan pelanggan (dipasangkan ke invoice oleh
 *    PencocokanPenerimaan); pemasukan dari orang = isi ulang kas; selebihnya Pendapatan/Beban Lainnya.
 */
final class KlasifikasiArusKas
{
    private const MASUK = 'masuk';

    private const KELUAR = 'keluar';

    /** Kata yang menandai pihak sebagai badan/instansi, bukan orang. */
    private const BADAN = '/\b(PT|CV|BANK|DINAS|KEMENT\w*|PAJAK|BPJS|KOPERASI|KOP|TKBM|PELABUHAN|KSOP|KUPP|DJP|TBK|PNBP|KARYAWAN|STAFF|DIREKSI|DIREKTUR|TRAVELOKA|PLN|PDAM|OPERASIONAL|ASOSIASI|APBMI|BIZNET|TIKI|PERUSAHAAN|YAYASAN|KOMURA|FOREMAN|KASBON)\b/';

    /** Pembayaran yang memang upah/penggantian untuk staf itu sendiri, bukan dana titipan. */
    private const BEBAN_UNTUK_STAF = '/\b(GAJI|BONUS|THR|INSENTIF|REIMBURSE\w*|UANG MAKAN)\b/';

    /**
     * [arah ('masuk'|'keluar'|null = keduanya), pola, tipe kategori, label sub kategori].
     *
     * @var list<array{0: string|null, 1: string, 2: string, 3: string}>
     */
    private const ATURAN = [
        [null, '/^SALDO (AKHIR|AWAL)/', 'financing', 'Saldo Pindahan Periode'],
        [null, '/SALAH (MASUK|TRANSFER|KIRIM)|OVER ?BALANCE|LEBIH BAYAR/', 'financing', 'Dana Titipan & Salah Transfer'],

        // Pemasukan
        [self::MASUK, '/\bBUNGA\b|JASA GIRO/', 'income', 'Bunga & Jasa Giro Bank'],
        [self::MASUK, '/^PAJAK( BANK)?\b/', 'income', 'Pendapatan Lainnya'],
        [self::MASUK, '/\b(DIREKTUR|DIREKSI)\b/', 'financing', 'Setoran Modal Pemilik'],
        [self::MASUK, '/(PEMBAYARAN|BAYAR) UTANG|CICILAN/', 'income', 'Pendapatan Lainnya'],
        [self::MASUK, '/PETTY ?CASH|TOP ?UP|\bAMPRAH\b|KASBON|DANA OPERASIONAL|PERSIAPAN DANA/', 'financing', 'Isi Ulang Kas & Dana Operasional'],
        [self::MASUK, '/TERIMA DANA|PENGGANTIAN|MENGGANTI|\bGAJI\b|\bRUKO\b/', 'income', 'Penggantian Biaya Grup'],
        [self::MASUK, '/REFUND|PENGEMBALIAN|KELEBIHAN|KOREKSI|PINALTY|PENALTY|\bBPJS\b/', 'income', 'Pengembalian Dana (Refund)'],

        // Pengeluaran — penyerahan dana ke staf yang tidak tertulis dengan panah
        [self::KELUAR, '/PERSIAPAN (DANA )?PNBP|PENGAJUAN DANA|^DANA OPERASIONAL|PETTY ?CASH|\bTOP ?UP\b|KASBON|PINJAMAN/', 'financing', 'Dana Operasional ke Staf'],
        [self::KELUAR, self::ANTAR_GRUP, 'financing', 'Mutasi Dana Antar Perusahaan Grup'],

        // Pajak
        [self::KELUAR, '/\bPPN\b/', 'financing', 'Setor PPN'],
        [self::KELUAR, '/\bPPH ?21\b/', 'expense', 'PPh 21 Karyawan'],
        [self::KELUAR, '/\bPPH ?25\b/', 'expense', 'PPh 25 (Angsuran Bulanan)'],
        [self::KELUAR, '/\bPPH ?(BADAN|29)\b|SPT TAHUNAN/', 'expense', 'PPh 29 (Kurang Bayar Tahunan)'],
        [self::KELUAR, '/\bDENDA\b|SANKSI|PINALTY|PENALTY|\bSTP\b/', 'expense', 'Denda & Sanksi'],
        [self::KELUAR, '/^PAJAK( BANK| BUNGA)?\s*‖.*BANK|PAJAK (BANK|BUNGA)/', 'expense', 'Pajak Jasa Giro'],

        // Bank
        [self::KELUAR, '/BIAYA (TRANSFER|TRF|TRANSAKSI|ADMIN\w*|SALDO|PENARIKAN)|\bBY\.? (TRANSFER|TRF|ADMIN)|SALDO MINIMAL|MONTHLY (CARD )?CHARGE|KARTU DEBIT|BI ?FAST|ADMIN DEBIT|^ADM(IN)?\b|‖\s*BANK( MANDIRI)?\s*$/', 'expense', 'Biaya Administrasi Bank'],

        // Operasional pelabuhan & kapal
        [self::KELUAR, '/PENGKONDISIAN|UNDER ?TABLE|KOORDINASI|UANG ROKOK/', 'expense', 'Koordinasi & Pengkondisian Lapangan'],
        [self::KELUAR, '/\bPNBP\b|\bSTS\b|\bRAMBU\b|\bLABUH\b|\bVTS\b|VESSEL TRAFFIC|SYAHBANDAR|DANGEROUS GOODS|KEPELABUHAN|DINAS PERHUBUNGAN|KEMENT\w* (PERHUBUNGAN|KESEHATAN)|\bKSOP\b|\bKUPP\b/', 'expense', 'PNBP Kepelabuhanan'],
        [self::KELUAR, '/\b(PPH|PAJAK|BILLING|DJP|BUPOT)\b|PPH ?(23|4)/', 'expense', 'Setoran PPh 23 & 4(2)'],
        [self::KELUAR, '/\bBPJS\b.*(KES|SEHAT)|BPJS SEHAT/', 'expense', 'BPJS Kesehatan'],
        [self::KELUAR, '/\bBPJS\b/', 'expense', 'BPJS Ketenagakerjaan'],
        [self::KELUAR, self::HOLDING, 'expense', 'Kontribusi Biaya Holding'],
        [self::KELUAR, '/\b(THR|BONUS|INSENTIF)\b/', 'expense', 'THR & Bonus'],
        [self::KELUAR, '/FAMILY GATHERING|GATHERING|BADMINTON|OLAHRAGA|OUTBOUND|REKREASI|HAMPERS|BUKBER|BUKA PUASA|ULANG TAHUN|\bULTAH\b|TRAKTIR|\bKADO\b|KHITANAN|NATAL|IMLEK|LEBARAN|HALAL ?BIHALAL|\bRESTO/', 'expense', 'Kegiatan Karyawan & Grup'],
        [self::KELUAR, '/PELATIHAN|TRAINING|DIKLAT/', 'expense', 'Pelatihan Karyawan'],
        // Sebelum TKBM: pihaknya "ASOSIASI PERUSAHAAN BONGKAR MUAT INDONESIA".
        [self::KELUAR, '/\bAPBMI\b|ASOSIASI|\bIURAN\b|ANGGOTA/', 'expense', 'Iuran Asosiasi (APBMI)'],
        [self::KELUAR, '/FOREMAN|\bTALLY|\bASSIST\b|CHECKER|(OVER ?TIME|LEMBUR).*\bMV\b/', 'expense', 'Foreman, Tally & Lembur Lapangan'],
        [self::KELUAR, '/\bTKBM\b|BONGKAR MUAT|KOMURA|KOPERASI|\bBURUH\b/', 'expense', 'Upah TKBM (Bongkar Muat)'],
        [self::KELUAR, '/ALAT BERAT|SEWA (JASA )?(PAKET )?ALAT|EXCAVATOR|\bDOZER\b|LOADER|FORKLIFT|\bCRANE\b/', 'expense', 'Sewa Alat Berat'],
        [self::KELUAR, '/\bPANDU\b|\bTUNDA\b/', 'expense', 'Jasa Pandu & Tunda'],
        [self::KELUAR, '/MOORING|\bMOOR\b/', 'expense', 'Mooring & Unmooring'],
        [self::KELUAR, '/(?=.*\b(MV|KAPAL|VESSEL)\b).*(SEWA KENDARAAN|SPEED ?BOAT|SPEED CHECKING|SEWA MOBIL|TRANSPORT\w*)|SEWA KENDARAAN|SPEED ?BOAT/', 'expense', 'Sewa Kendaraan & Speedboat'],
        [self::KELUAR, '/(?=.*\b(MV|KAPAL|VESSEL)\b).*\b(BBM|SOLAR|BAHAN BAKAR)\b/', 'expense', 'BBM Operasional Kapal'],
        [self::KELUAR, '/\bPBM\b|STEVEDORING|DEBIT NOTE|\bDN\b|SUBKON/', 'expense', 'Jasa PBM & Subkon Grup'],
        [self::KELUAR, '/CLEARANCE|\bSPB\b|CERTIFICATE|SERTIFIKAT|SSCEC|ENDORS|SIUP|BOARDING|KEAGENAN|AGENCY|PASPORT|PASPOR|IMIGRASI|KARANTINA|QUARANTINE|PORT HEALTH|LOGBOOK|DOKUMEN KAPAL/', 'expense', 'Clearance & Dokumen Kapal'],
        [self::KELUAR, '/CASH ?B[AE]C?K|\(CB\)|KOMISI|FEE (MARKETING|AGEN)|CALL FEE/', 'expense', 'Komisi Penjualan'],
        // Uang tagihan yang dikembalikan ke pelanggan: bukan biaya kapal.
        [self::KELUAR, '/REFUND INVOICE/', 'expense', 'Beban Lainnya'],

        // Perjalanan & umum
        [self::KELUAR, '/TRAVELOKA|TIKET|PESAWAT|\bTRAVEL\b|KAPAL CEPAT|KERETA/', 'expense', 'Tiket Perjalanan Dinas'],
        [self::KELUAR, '/HOTEL|PENGINAPAN|\bMESS\b|\bKOST?\b|AIRBNB|AKOMODASI/', 'expense', 'Hotel & Akomodasi'],
        [self::KELUAR, '/JAMUAN|ENTERTAIN|KARAOKE|PRIVAT\w* ROOM/', 'expense', 'Jamuan Klien'],
        [self::KELUAR, self::DIREKSI, 'expense', 'Biaya Operasional Direksi'],
        [self::KELUAR, '/NOTARIS|KONSULTAN|\bLEGAL\b|\bAKTA\b|JASA HUKUM|\bAUDIT\b|ADVOKAT/', 'expense', 'Jasa Profesional (Notaris, Konsultan)'],
        [self::KELUAR, '/PERIZINAN|\bIZIN\b|\bNIB\b|LEGALITAS|PENGURUSAN|\bPMKU\b|^RKBM\b/', 'expense', 'Perizinan & Legalitas'],
        [self::KELUAR, '/COMPANY PROFILE|BROSUR|SPANDUK|BANNER/', 'expense', 'Materi Promosi & Cetak'],
        [self::KELUAR, '/KARANGAN BUNGA|PARCEL|PARSEL/', 'expense', 'Jamuan Klien'],
        [self::KELUAR, '/PERBAIKAN|RENOVASI|PLAFON|\bCAT\b TEMBOK/', 'expense', 'Perbaikan Gedung & Kantor'],
        [self::KELUAR, '/SEWA (RUKO|KANTOR|RUANG\w*|GEDUNG|GUDANG)/', 'expense', 'Sewa Kantor'],
        [self::KELUAR, '/SERVI(S|CE)|BENGKEL|SPARE ?PART|GANTI OLI|CUCI AC/', 'expense', 'Perawatan Peralatan & Komputer'],
        [self::KELUAR, '/PEMBELIAN ASS?ET|ASS?ET KANTOR|\bRUKO\b|LEMARI|\bMEJA\b|\bKURSI\b|LAPTOP|PRINTER|KOMPUTER|NOTEBOOK|INVENTARIS/', 'financing', 'Pembelian Aset Tetap'],
        [self::KELUAR, '/LISTRI[KL]|\bPLN\b|TOKEN/', 'expense', 'Listrik'],
        [self::KELUAR, '/GALON|AIR MINERAL|\bAQUA\b/', 'expense', 'Konsumsi Kantor & Rapat'],
        [self::KELUAR, '/TAGIHAN AIR|\bPDAM\b/', 'expense', 'Air'],
        [self::KELUAR, '/\bWIFI\b|INTERNET|INDIHOME|BIZNET|\bPULSA\b|TELEPON|TELKOM|PAKET DATA|\bKUOTA\b/', 'expense', 'Internet & Telepon'],
        [self::KELUAR, '/KEBERSIHAN|SAMPAH|KEAMANAN|SECURITY|LAUNDRY|CLEANING|SABUN|PEMBERSIH|PENGHARUM|\bTISU\b/', 'expense', 'Kebersihan & Keamanan'],
        [self::KELUAR, '/UANG MAKAN|TUNJANGAN|LEMBUR|OVER ?TIME/', 'expense', 'Tunjangan & Lembur'],
        [self::KELUAR, '/MAKAN|MINUM|KONSUMSI|SNACK|\bKOPI\b|DAPUR|PERMEN|\bGULA\b|CATERING|\bNASI\b|\bTEH\b|\bBUAH\b|\bKUE\b|KECAP|SAOS|SAUS|\bMIE\b|ROKOK|\bCABE\b|BAHAN MASAK|AMPLANG|\bGAS\b|\bLPG\b/', 'expense', 'Konsumsi Kantor & Rapat'],
        [self::KELUAR, '/MATERAI|METERAI/', 'expense', 'Bea Meterai'],
        [self::KELUAR, '/PERLENGKAPAN|KEPERLUAN KANTOR|PEMASANGAN|CCTV|BENDERA|PISAU|KABEL|BAHAN BANGUNAN|ISOLASI|\bMAP\b|AMPLOP|BELANJA|SERAGAM|\bBAJU\b|HARD ?DIS[KC]|HARDISK|FLASH ?DIS[KC]|MOUSE|KEYBOARD|CANVAS|FRAME|GEMBOK|GUNTING|LAMPU|TINER|\bKUAS\b|TOPLES|PIRING|LIFE JACKET|PELAMPUNG/', 'expense', 'ATK & Perlengkapan Kantor'],
        [self::KELUAR, '/\bATK\b|ALAT TULIS|KERTAS|TINTA|TONER|PERLENGKAPAN KANTOR|STOP ?MAP/', 'expense', 'ATK & Perlengkapan Kantor'],
        [self::KELUAR, '/FOTO ?CO?PY|FOTOKOPI|\bPRINT|\bCETAK|JILID|LAMINASI|STEMPEL/', 'expense', 'Cetak & Fotokopi'],
        [self::KELUAR, '/ONGKOS KIRIM|ONGKIR|KURIR|\bTIKI\b|\bJNE\b|\bPOS\b|PENGIRIMAN|EKSPEDISI|J&T|GOSEND/', 'expense', 'Kurir & Pengiriman'],
        [self::KELUAR, '/\bBBM\b|BENSIN|PERTALITE|PERTAMAX|\bTOL\b|PARKIR/', 'expense', 'BBM, Tol & Parkir'],
        [self::KELUAR, '/\bGRAB\b|GOJEK|MAXIM|TAKSI|TAXI|OJEK|TRANSPORT/', 'expense', 'Transportasi Lokal'],
        [self::KELUAR, '/SUMBANGAN|DONASI|\bHAUL\b|SEDEKAH|ZAKAT|SANTUNAN|BANTUAN|INFAQ|[KQ]URBAN|DUKA|SOSIAL/', 'expense', 'Sumbangan & Donasi'],
        [self::KELUAR, '/ASURANSI/', 'expense', 'Asuransi'],
        [self::KELUAR, '/LANGGANAN|SOFTWARE|APLIKASI|DOMAIN|HOSTING/', 'expense', 'Langganan Software & Aplikasi'],
        [self::KELUAR, '/\bHONOR\b/', 'expense', 'Honor Tenaga Lepas'],
        [self::KELUAR, '/\b(GAJI|PENGGAJIAN|UPAH|SALARY)\b/', 'expense', 'Gaji Karyawan'],
        [self::KELUAR, '/‖.*NUSANTARA ARMADA/', 'expense', 'Sewa Alat Berat'],
        [self::KELUAR, '/^[^‖]*(\bMV\b|\bM\.V\b|VESSEL|KAPAL|TONGKANG|\bAMPRAH\b|WAITING|COOLING|CARGO|JETTY|DERMAGA|OPERA(SIONAL|TIONAL))/', 'expense', 'Biaya Operasional Kapal Lainnya'],
    ];

    /**
     * Penanda aturan biaya holding: perusahaan anggota grup yang membayar ke holding (gaji staf holding,
     * family gathering, kantor) mencatat "Kontribusi Biaya Holding"; holding sendiri mencatat gaji.
     */
    private const HOLDING = 'holding';

    /** Pihak/deskripsi pembayaran ke holding (Mitra Trisula Amanah). "HOLDIN" = kolom bank yang terpotong. */
    private const POLA_HOLDING = '/HOLDIN|‖.*MITRA TRISULA|‖.*\bPT\.? ?MTA\b/';

    /** Penanda aturan biaya direksi: kata DIREKSI/DIREKTUR, atau nama direksi grup ($direksi). */
    private const DIREKSI = 'direksi';

    /** Pola nama direksi ("SUSANTO WIJAYA", "PAK SUSANTO"), atau null bila tidak ada. */
    private ?string $polaDireksi = null;

    /** Penanda aturan pengembalian dana ke perusahaan lain di grup (bukan biaya). */
    private const ANTAR_GRUP = 'antar-grup';

    /** @var list<int> nominal baris "dana salah masuk/transfer" — pemasukan bernominal sama adalah pasangannya */
    private array $salahTransfer = [];

    /** @var list<string> kunci nama pelanggan invoice */
    private array $pelanggan;

    /** @var list<string> kunci nama perusahaan lain di grup */
    private array $grup;

    /** @var list<string> kunci nama perusahaan sendiri (nama lengkap & singkatan) */
    private array $diri;

    /** @var list<string> kata pertama nama staf pemegang dana */
    private array $pemegang = [];

    /** @var array<string, list<BarisArusKas>> pembayaran oleh staf, per kata pertama namanya */
    private array $bayaranStaf = [];

    /**
     * @param  list<BarisArusKas>  $semuaBaris  seluruh baris sheet, untuk mengenali staf pemegang dana
     * @param  bool  $holding  perusahaan holding: gaji staf holding adalah gajinya sendiri, bukan kontribusi
     * @param  list<string>  $grup  nama perusahaan lain di grup yang sama
     * @param  list<string>  $pelanggan  nama pelanggan di sheet Invoice Jual
     * @param  list<string>  $direksi  nama direksi grup (dari pihak bertanda "(DIREKTUR)" di semua berkas)
     */
    public function __construct(string $namaPerusahaan, string $singkatan, array $semuaBaris, private bool $holding = false, array $grup = [], array $pelanggan = [], array $direksi = [])
    {
        $sebutan = [];

        foreach ($direksi as $nama) {
            $nama = strtoupper(trim($nama));
            $sebutan[] = preg_quote($nama, '/');
            $sebutan[] = 'PAK '.preg_quote(strtok($nama, ' '), '/');
        }

        $this->polaDireksi = $sebutan === [] ? null : '/\b('.implode('|', array_unique($sebutan)).')\b/';

        $this->grup = array_map(NamaPihak::kunci(...), $grup);
        $this->pelanggan = array_values(array_unique(array_map(NamaPihak::kunci(...), $pelanggan)));

        $this->diri = array_values(array_unique([NamaPihak::kunci($namaPerusahaan), NamaPihak::kunci($singkatan)]));

        foreach ($semuaBaris as $baris) {
            [$sumber, $tujuan] = $this->arah($baris->pihak) ?? [null, null];

            if ($sumber !== null && ! $this->isDiri($sumber) && $this->isOrang($sumber)) {
                $this->pemegang[] = $this->kataPertama($sumber);
            }

            if ($sumber !== null && $this->isDiri($sumber) && str_contains(strtoupper($tujuan), '(FINANCE)')) {
                $this->pemegang[] = $this->kataPertama($tujuan);
            }
        }

        $this->pemegang = array_values(array_unique(array_filter($this->pemegang, fn (string $kata): bool => strlen($kata) >= 4)));

        foreach ($semuaBaris as $baris) {
            [$sumber] = $this->arah($baris->pihak) ?? [null];

            if (preg_match('/SALAH (MASUK|TRANSFER|KIRIM)/i', $baris->deskripsi)) {
                $this->salahTransfer[] = $baris->nominal();
            }

            if (! $baris->isMasuk() && $sumber !== null && $this->isPemegang($sumber)) {
                $this->bayaranStaf[$this->kataPertama($sumber)][] = $baris;
            }
        }
    }

    public function klasifikasi(BarisArusKas $baris): Klasifikasi
    {
        $deskripsi = strtoupper($baris->deskripsi);
        $pihak = strtoupper($baris->pihak);
        $masuk = $baris->isMasuk();
        [$sumber, $tujuan] = $this->arah($baris->pihak) ?? [null, null];

        if (! preg_match('/^SALDO (AKHIR|AWAL)/', $deskripsi)) {
            $mutasiStaf = $this->mutasiStaf($baris, $deskripsi, $sumber, $tujuan);

            if ($mutasiStaf !== null) {
                return new Klasifikasi('financing', $mutasiStaf);
            }
        }

        $teks = $deskripsi.' ‖ '.$pihak;

        if ($masuk && in_array($baris->masuk, $this->salahTransfer, true) && str_contains($deskripsi, 'INHOUSE')) {
            return new Klasifikasi('financing', 'Dana Titipan & Salah Transfer');
        }

        foreach (self::ATURAN as [$arah, $pola, $type, $kategori]) {
            if ($arah !== null && $arah !== ($masuk ? self::MASUK : self::KELUAR)) {
                continue;
            }

            if ($pola === self::ANTAR_GRUP) {
                if (str_starts_with($deskripsi, 'PENGEMBALIAN DANA') && $this->isGrup($sumber !== null ? $tujuan : $baris->pihak)) {
                    return new Klasifikasi($type, $kategori);
                }

                continue;
            }

            if ($pola === self::DIREKSI) {
                if (preg_match('/\b(DIREKSI|DIREKTUR)\b/', $teks) || ($this->polaDireksi !== null && preg_match($this->polaDireksi, $teks))) {
                    return new Klasifikasi($type, $kategori);
                }

                continue;
            }

            if ($pola === self::HOLDING) {
                // Holding sendiri: hanya "gaji staf holding" yang dikenali (pihaknya selalu PT. MTA).
                if ($this->holding ? str_contains($deskripsi, 'HOLDIN') : preg_match(self::POLA_HOLDING, $teks)) {
                    return new Klasifikasi('expense', $this->holding ? 'Gaji Karyawan' : $kategori);
                }

                continue;
            }

            if (preg_match($pola, $teks)) {
                return new Klasifikasi($type, $kategori);
            }
        }

        if (! $masuk) {
            return new Klasifikasi('expense', 'Beban Lainnya');
        }

        $pengirim = $sumber ?? $baris->pihak;

        return match (true) {
            $this->isPelanggan($pengirim),
            (bool) preg_match('/\bINV(OICE)?\b|\d{3}[A-Z]?\/[A-Z]+-/', $deskripsi),
            ! $this->isDiri($pengirim) && $pengirim !== '' && ! $this->isOrang($pengirim) && ! str_contains($pihak, 'BANK') => new Klasifikasi('income', 'Pendapatan Jasa', penerimaanPelanggan: true),
            $this->isOrang($pengirim) => new Klasifikasi('financing', 'Isi Ulang Kas & Dana Operasional'),
            default => new Klasifikasi('income', 'Pendapatan Lainnya'),
        };
    }

    /**
     * Label kategori Mutasi Dana Internal bila baris ini perpindahan uang antara perusahaan dan staf
     * pemegang dana, atau null.
     */
    private function mutasiStaf(BarisArusKas $baris, string $deskripsi, ?string $sumber, ?string $tujuan): ?string
    {
        if ($sumber === null) {
            // "Pengembalian dana kelebihan PNBP | SITI (FINANCE)" — tanpa panah.
            if ($baris->isMasuk() && $this->isPemegang($baris->pihak)) {
                return preg_match('/REFUND|PENGEMBALIAN|KELEBIHAN|\bSISA\b/', $deskripsi)
                    ? 'Pengembalian Dana dari Staf'
                    : 'Isi Ulang Kas & Dana Operasional';
            }

            return null;
        }

        $dariDiri = $this->isDiri($sumber);
        $keStaf = $this->isPemegang($tujuan);

        if ($baris->isMasuk()) {
            return match (true) {
                $this->isPemegang($sumber) && ($this->isDiri($tujuan) || $tujuan === '') => 'Pengembalian Dana dari Staf',
                $dariDiri && $this->isOrang($tujuan) => 'Isi Ulang Kas & Dana Operasional',
                default => null,
            };
        }

        if (! $dariDiri || ! $keStaf) {
            return null;
        }

        // Upah/penggantian untuk staf itu sendiri tetap biaya — kecuali staf meneruskannya (ada
        // pembayaran staf itu dengan nominal sama dalam 10 hari: dana titipan, bukan upahnya).
        if (preg_match(self::BEBAN_UNTUK_STAF, $deskripsi) && ! $this->diteruskanStaf($baris, $tujuan)) {
            return null;
        }

        return 'Dana Operasional ke Staf';
    }

    private function diteruskanStaf(BarisArusKas $baris, string $staf): bool
    {
        foreach ($this->bayaranStaf[$this->kataPertama($staf)] ?? [] as $bayar) {
            $selisih = $baris->tanggal->diffInDays($bayar->tanggal, false);

            if ($bayar->keluar === $baris->keluar && $selisih >= -1 && $selisih <= 10) {
                return true;
            }
        }

        return false;
    }

    /**
     * Arah uang di kolom Pihak: "A -> B", "A > B", atau "A - B" (hanya bila A perusahaan sendiri
     * atau B "OPERASIONAL"/"PNBP" — tanda hubung juga dipakai untuk "TRAVELOKA - BUDI SANTOSO").
     *
     * @return array{0: string, 1: string}|null
     */
    private function arah(string $pihak): ?array
    {
        if (preg_match('/^(.*?)\s*(?:->|>)\s*(.*)$/', $pihak, $cocok)) {
            return [trim($cocok[1]), trim($cocok[2])];
        }

        if (preg_match('/^(.*?)\s+-\s+(.*)$/', $pihak, $cocok)
            && ($this->isDiri($cocok[1]) || preg_match('/^(OPERASIONAL|PNBP)$/i', trim($cocok[2])))) {
            return [trim($cocok[1]), trim($cocok[2])];
        }

        return null;
    }

    private function isDiri(?string $pihak): bool
    {
        return $pihak !== null && $pihak !== '' && in_array(NamaPihak::kunci($pihak), $this->diri, true);
    }

    private function isPelanggan(?string $pihak): bool
    {
        if ($pihak === null || $pihak === '') {
            return false;
        }

        $kunci = NamaPihak::kunci($pihak);

        foreach ($this->pelanggan as $pelanggan) {
            if (NamaPihak::sama($kunci, $pelanggan) || (strlen($pelanggan) >= 10 && str_contains($kunci, $pelanggan))) {
                return true;
            }
        }

        return false;
    }

    private function isGrup(?string $pihak): bool
    {
        return $pihak !== null && $pihak !== '' && in_array(NamaPihak::kunci($pihak), $this->grup, true);
    }

    private function isOrang(?string $pihak): bool
    {
        if ($pihak === null || trim($pihak) === '' || preg_match('/DIREKTUR|DIREKSI/i', $pihak)) {
            return false;
        }

        return ! preg_match(self::BADAN, strtoupper(preg_replace('/\(.*?\)/', ' ', $pihak)));
    }

    private function isPemegang(?string $pihak): bool
    {
        if ($pihak === null || $pihak === '' || ! $this->isOrang($pihak)) {
            return false;
        }

        $kata = $this->kataPertama($pihak);

        foreach ($this->pemegang as $pemegang) {
            if (str_starts_with($kata, $pemegang) || str_starts_with($pemegang, $kata)) {
                return true;
            }
        }

        return false;
    }

    private function kataPertama(string $nama): string
    {
        preg_match('/[A-Z]+/', strtoupper(preg_replace('/\(.*?\)/', ' ', $nama)), $cocok);

        return $cocok[0] ?? '';
    }
}
