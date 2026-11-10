<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

/**
 * Pemindai `scripts/i18n-check.mjs` harus menangkap pola yang pernah lolos
 * (QA multi bahasa F01, F02, F10), diuji pada berkas contoh yang sengaja salah.
 */
class PemindaiI18nTest extends TestCase
{
    /**
     * @return array{0: int, 1: string}
     */
    private function jalankanPemindai(): array
    {
        $akar = dirname(__DIR__, 2);
        $keluaran = [];
        $kode = 0;
        exec(
            'cd '.escapeshellarg($akar).' && node scripts/i18n-check.mjs --root tests/Fixtures/i18n-pemindai 2>&1',
            $keluaran,
            $kode,
        );

        return [$kode, implode("\n", $keluaran)];
    }

    public function test_kunci_yang_hanya_pertama_kali_diabaikan_tetap_wajib_ada_di_kamus(): void
    {
        [$kode, $keluaran] = $this->jalankanPemindai();

        $this->assertSame(1, $kode, $keluaran);
        $this->assertStringContainsString('en.json belum punya "Alamat"', $keluaran);
    }

    public function test_komentar_abaikan_di_ekor_baris_tidak_menutup_baris_berikutnya(): void
    {
        [, $keluaran] = $this->jalankanPemindai();

        $this->assertStringContainsString('en.json belum punya "Generik"', $keluaran);
    }

    public function test_header_kolom_meta_dan_peta_subtitle_dianggap_teks_tampilan(): void
    {
        [, $keluaran] = $this->jalankanPemindai();

        foreach (['"Nama" (nilai header)', '"Halaman pertama" (peta bandSubtitle)', '"Setelah konten" (peta bandSubtitle)', '"Halaman" (prop meta)'] as $harapan) {
            $this->assertStringContainsString($harapan, $keluaran);
        }
    }
}
