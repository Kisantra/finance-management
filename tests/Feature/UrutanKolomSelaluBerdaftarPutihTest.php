<?php

namespace Tests\Feature;

use PHPUnit\Framework\TestCase;
use Symfony\Component\Finder\Finder;

/**
 * Nilai `sort` dari URL tidak boleh langsung masuk ke orderBy().
 *
 * `orderBy($sort, ...)` dengan `$sort` yang diambil mentah dari query string
 * berarti input pengguna menjadi nama kolom SQL: `?sort=ngawur` menjatuhkan
 * halaman dengan 500. Bukan kebocoran data, tetapi halaman yang bisa dimatikan
 * siapa saja hanya dengan mengarang satu parameter.
 *
 * QC 2026-11-03 menemukannya di satu tempat (/services). Pemindaian setelahnya
 * menemukan empat controller lain dengan pola yang sama persis — padahal
 * ClientController sudah memakai daftar putih sejak awal. Jadi yang dibutuhkan
 * bukan perbaikan satu halaman, melainkan aturan yang berlaku untuk semuanya.
 *
 * Test ini memindai kode, bukan menjalankan halaman, supaya controller yang
 * ditulis nanti ikut terjaga tanpa mengubah test.
 */
class UrutanKolomSelaluBerdaftarPutihTest extends TestCase
{
    public function test_setiap_order_by_dinamis_disaring_daftar_putih(): void
    {
        $pelanggaran = [];

        foreach (Finder::create()->files()->in(__DIR__.'/../../app/Http/Controllers')->name('*.php') as $berkas) {
            $isi = $berkas->getContents();

            if (! str_contains($isi, 'orderBy($sort')) {
                continue;
            }

            // Daftar putih diakui bila nilai $sort disaring in_array() terhadap
            // sebuah konstanta, apa pun namanya.
            if (preg_match('/\$sort\s*=\s*in_array\(/', $isi) === 1) {
                continue;
            }

            $pelanggaran[] = $berkas->getRelativePathname();
        }

        $this->assertSame(
            [],
            $pelanggaran,
            "Controller berikut meneruskan nilai `sort` dari URL langsung ke orderBy():\n  "
            .implode("\n  ", $pelanggaran)
            ."\n\nSaring dulu dengan daftar putih kolom, mengikuti pola ClientController::KOLOM_URUT. "
            .'Tanpa itu, `?sort=<apa saja>` menjatuhkan halaman dengan 500.'
        );
    }

    /**
     * Kontrol positif: pemindainya harus benar-benar bisa membedakan yang
     * disaring dari yang tidak. Tanpa ini, gerbang yang selalu hijau tidak
     * membuktikan apa-apa.
     */
    public function test_pemindai_membedakan_yang_disaring_dari_yang_tidak(): void
    {
        $rentan = '<?php $sort = $request->input("sort", "created_at"); $q->orderBy($sort, $dir);';
        $aman = '<?php $sort = in_array($request->input("sort"), self::KOLOM_URUT, true) ? $request->input("sort") : "created_at"; $q->orderBy($sort, $dir);';

        $disaring = fn (string $kode): bool => str_contains($kode, 'orderBy($sort')
            && preg_match('/\$sort\s*=\s*in_array\(/', $kode) === 1;

        $this->assertFalse($disaring($rentan), 'Pemindai menganggap kode rentan sudah aman — gerbang ini tidak mengukur apa pun.');
        $this->assertTrue($disaring($aman), 'Pemindai menolak kode yang sudah benar — ia akan melapor palsu.');
    }
}
