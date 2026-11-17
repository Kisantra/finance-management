<?php

namespace Database\Seeders\DataPerusahaan;

/**
 * Nama badan/orang dari data mentah ditulis tidak seragam ("PT. CONTOH SUKSES MANDIRI" vs
 * "CONTOH SUKSES MANDIRI", "PUTRA LAUT JAYA TAMA" vs "PUTRA LAUT JAYATAMA").
 */
final class NamaPihak
{
    /** Kunci pembanding: tanpa bentuk badan (PT/CV/Tbk/Koperasi), isi kurung, tanda baca, dan spasi. */
    public static function kunci(string $nama): string
    {
        $nama = strtoupper($nama);
        $nama = preg_replace('/\(.*?\)/', ' ', $nama);
        $nama = preg_replace('/\b(PT|CV|TBK|UD|PERSERO|KOPERASI|KOP)\b\.?/', ' ', $nama);

        return preg_replace('/[^A-Z0-9]/', '', $nama);
    }

    /** Dua kunci dianggap pihak yang sama bila identik, atau beda ≤ 2 huruf untuk nama panjang (salah ketik). */
    public static function sama(string $kunciA, string $kunciB): bool
    {
        if ($kunciA === $kunciB) {
            return true;
        }

        return min(strlen($kunciA), strlen($kunciB)) >= 12 && levenshtein($kunciA, $kunciB) <= 2;
    }

    /** Nama tampilan: spasi tunggal dan penulisan "PT." / "CV." seragam. */
    public static function rapikan(string $nama): string
    {
        $nama = trim(preg_replace('/\s+/', ' ', $nama), " \t-,.");
        $nama = preg_replace('/^(PT|CV)\.?\s*/i', '$1. ', $nama);

        return strtoupper(substr($nama, 0, 3)) === 'PT.' || strtoupper(substr($nama, 0, 3)) === 'CV.'
            ? strtoupper(substr($nama, 0, 3)).substr($nama, 3)
            : $nama;
    }

    /**
     * Kode di nomor invoice ("001/AOE-CP/...") adalah singkatan nama ini: huruf pertamanya huruf
     * pertama nama dan semua hurufnya muncul berurutan di nama ("CP" ↔ CONTOH PELAYARAN).
     * Kode lokasi/pelabuhan yang tidak berhubungan dengan nama klien tidak lolos.
     */
    public static function singkatanDari(string $kode, string $nama): bool
    {
        $huruf = self::kunci($nama);

        if ($kode === '' || $huruf === '' || $kode[0] !== $huruf[0]) {
            return false;
        }

        $posisi = 0;

        foreach (str_split($kode) as $karakter) {
            $posisi = strpos($huruf, $karakter, $posisi);

            if ($posisi === false) {
                return false;
            }

            $posisi++;
        }

        return true;
    }

    public static function berbentukBadan(string $nama): bool
    {
        return (bool) preg_match('/^(PT|CV)\b\.?/i', trim($nama));
    }
}
