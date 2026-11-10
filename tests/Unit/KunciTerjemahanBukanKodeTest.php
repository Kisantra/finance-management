<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;

/**
 * __() hanya untuk teks tampil. Nama rute, kode status, dan nilai pembanding TIDAK boleh lewat __():
 * begitu kamus zh berisi kuncinya, rute/pemeriksaan status rusak diam-diam (pernah terjadi: route(__('dashboard')),
 * in_array(..., ['draft', __('rejected')])). Kunci berbentuk kode (huruf kecil tanpa spasi) dianggap salah,
 * kecuali kunci grup berkas lang (feedback.*, invoice.*, validation.*, …) dan label satu kata yang memang tampil.
 */
class KunciTerjemahanBukanKodeTest extends TestCase
{
    /** Label tampil satu kata huruf kecil yang sah sebagai kunci (mis. atribut validasi). */
    private const LABEL_SAH = ['bahasa', 'tanpa nomor'];

    /** Awalan kunci grup berkas lang/{locale}/*.php yang memang dipanggil lewat __(). */
    private const GRUP_LANG = ['feedback.', 'invoice.', 'validation.', 'auth.', 'passwords.', 'pagination.'];

    public function test_tidak_ada_route_yang_namanya_diterjemahkan(): void
    {
        $temuan = $this->pindai('/route\(\s*__\(/');

        $this->assertSame([], $temuan, "Nama rute dibungkus __():\n".implode("\n", $temuan));
    }

    public function test_tidak_ada_kunci_terjemahan_berbentuk_kode(): void
    {
        $temuan = [];
        foreach ($this->pindai("/__\(\s*'([a-z0-9_.\-]+)'\s*[,)]/", true) as $baris => $kunci) {
            if (in_array($kunci, self::LABEL_SAH, true)) {
                continue;
            }
            foreach (self::GRUP_LANG as $awalan) {
                if (str_starts_with($kunci, $awalan)) {
                    continue 2;
                }
            }
            $temuan[] = "{$baris} → __('{$kunci}')";
        }

        $this->assertSame([], $temuan, "Kunci __() berbentuk kode/nama rute (harus literal biasa):\n".implode("\n", $temuan));
    }

    /**
     * @return array<int|string, string> tanpa $ambilKunci: daftar "berkas:baris"; dengan $ambilKunci: "berkas:baris" => kunci
     */
    private function pindai(string $pola, bool $ambilKunci = false): array
    {
        $akar = dirname(__DIR__, 2).DIRECTORY_SEPARATOR.'app';
        $hasil = [];
        $berkas = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($akar, RecursiveDirectoryIterator::SKIP_DOTS));

        foreach ($berkas as $info) {
            if ($info->getExtension() !== 'php') {
                continue;
            }
            foreach (file($info->getPathname()) as $i => $baris) {
                if (! preg_match_all($pola, $baris, $cocok)) {
                    continue;
                }
                $lokasi = str_replace($akar.DIRECTORY_SEPARATOR, 'app/', $info->getPathname()).':'.($i + 1);
                if ($ambilKunci) {
                    foreach ($cocok[1] as $kunci) {
                        $hasil[$lokasi.' #'.$kunci] = $kunci;
                    }
                } else {
                    $hasil[] = $lokasi;
                }
            }
        }

        return $hasil;
    }
}
