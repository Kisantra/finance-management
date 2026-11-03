<?php

namespace Tests\Feature;

use PHPUnit\Framework\TestCase;
use Symfony\Component\Finder\Finder;

/**
 * Prop halaman TIDAK BOLEH memakai nama yang sudah dipakai prop bersama.
 *
 * HandleInertiaRequests::share() mengirim `company` (identitas tenant:
 * {slug, name, abbreviation}) ke SETIAP halaman. Prop halaman dengan nama sama
 * menimpanya diam-diam — tidak ada peringatan, tidak ada error, halaman tetap
 * render.
 *
 * Akibatnya baru terlihat di browser: `activeCompanySlug` menjadi null, lalu
 * `companyUrl()` DAN jaring pengaman `installCompanyUrlPrefix()` mati
 * bersamaan, sehingga setiap tautan dan form di halaman itu kehilangan prefiks
 * `/c/{slug}` dan menjawab 404/405. QC 2026-11-03 menemukannya di dua tempat
 * sekaligus: halaman Laba Rugi (preset periode 404, panel klasifikasi 405,
 * unduh PDF 404) dan Pengaturan › Profil Perusahaan (formulirnya tidak bisa
 * disimpan sama sekali). Dua laporan terpisah, satu akar.
 *
 * Test ini memindai kode, bukan satu-dua halaman, supaya controller yang
 * ditulis nanti ikut terjaga tanpa mengubah test. Memakai token_get_all, bukan
 * regex: nama prop hanya dihitung bila ia kunci array di KEDALAMAN PERTAMA
 * panggilan Inertia::render() — `'company' => 5` di dalam sub-array `stats`
 * tidak bertabrakan dan tidak boleh ikut dilaporkan.
 */
class PropHalamanTidakMenimpaPropBersamaTest extends TestCase
{
    /**
     * Nama yang dikirim HandleInertiaRequests::share() ke semua halaman.
     *
     * @var list<string>
     */
    private const PROP_BERSAMA = [
        'company',
        'companies',
        'auth',
        'locale',
        'flash',
        'notifications',
        'actionCounts',
    ];

    public function test_tidak_ada_prop_halaman_yang_menimpa_prop_bersama(): void
    {
        $pelanggaran = [];

        foreach (Finder::create()->files()->in(__DIR__.'/../../app/Http/Controllers')->name('*.php') as $berkas) {
            foreach ($this->kunciTingkatPertama($berkas->getContents()) as $baris => $kunci) {
                if (in_array($kunci, self::PROP_BERSAMA, true)) {
                    $pelanggaran[] = $berkas->getRelativePathname().':'.$baris." mengirim prop '{$kunci}'";
                }
            }
        }

        $this->assertSame(
            [],
            $pelanggaran,
            "Prop halaman di bawah ini memakai nama yang sudah dipakai prop bersama, sehingga MENIMPANYA:\n  "
            .implode("\n  ", $pelanggaran)
            ."\n\nGanti namanya (mis. 'company' -> 'companyProfile'). Kalau tidak, activeCompanySlug "
            .'jadi null di halaman itu dan setiap tautan serta form kehilangan prefiks /c/{slug}.'
        );
    }

    /**
     * Kontrol positif: pemindainya harus benar-benar bisa melihat pelanggaran,
     * dan harus MENGABAIKAN kunci yang bersarang lebih dalam.
     */
    public function test_pemindai_membedakan_kunci_tingkat_pertama_dari_yang_bersarang(): void
    {
        $melanggar = <<<'PHP'
        <?php
        return Inertia::render('halaman', [
            'company' => ['name' => 'X'],
        ]);
        PHP;

        $aman = <<<'PHP'
        <?php
        return Inertia::render('halaman', [
            'stats' => ['company' => 5, 'individual' => 3],
        ]);
        PHP;

        $this->assertSame(
            ['company'],
            array_values($this->kunciTingkatPertama($melanggar)),
            'Pemindai tidak melihat prop tingkat pertama — gerbang ini tidak mengukur apa pun.'
        );

        // 'stats' MEMANG kunci tingkat pertama dan benar dikembalikan; yang harus
        // TIDAK muncul adalah 'company' yang bersarang di dalamnya.
        $this->assertNotContains(
            'company',
            array_values($this->kunciTingkatPertama($aman)),
            "Pemindai ikut menghitung kunci bersarang. Itu lapor palsu: 'company' di dalam "
            .'sub-array tidak menimpa prop bersama apa pun.'
        );
    }

    /**
     * Kunci array di kedalaman PERTAMA setiap panggilan Inertia::render().
     *
     * @return array<int, string> baris => nama kunci
     */
    private function kunciTingkatPertama(string $kode): array
    {
        $token = token_get_all($kode);
        $hasil = [];
        $jumlah = count($token);

        for ($i = 0; $i < $jumlah; $i++) {
            if (! is_array($token[$i]) || $token[$i][0] !== T_STRING || $token[$i][1] !== 'render') {
                continue;
            }

            // Maju ke '(' pembuka argumen.
            $j = $i + 1;
            while ($j < $jumlah && $token[$j] !== '(') {
                $j++;
            }
            if ($j >= $jumlah) {
                continue;
            }

            // Telusuri sampai '[' pertama pada kedalaman argumen — itu array prop.
            $dalam = 0;
            $mulai = null;
            for ($k = $j; $k < $jumlah; $k++) {
                $t = $token[$k];
                if ($t === '(') {
                    $dalam++;
                } elseif ($t === ')') {
                    $dalam--;
                    if ($dalam === 0) {
                        break;
                    }
                } elseif ($t === '[' && $dalam === 1) {
                    $mulai = $k;
                    break;
                }
            }
            if ($mulai === null) {
                continue;
            }

            // Kumpulkan kunci string pada kedalaman 1 array tersebut.
            $kurung = 0;
            for ($k = $mulai; $k < $jumlah; $k++) {
                $t = $token[$k];

                if ($t === '[' || $t === '(') {
                    $kurung++;

                    continue;
                }
                if ($t === ']' || $t === ')') {
                    $kurung--;
                    if ($kurung === 0) {
                        break;
                    }

                    continue;
                }

                if ($kurung !== 1 || ! is_array($t) || $t[0] !== T_CONSTANT_ENCAPSED_STRING) {
                    continue;
                }

                // Hanya hitung bila benar-benar diikuti '=>'.
                $n = $k + 1;
                while ($n < $jumlah && is_array($token[$n]) && $token[$n][0] === T_WHITESPACE) {
                    $n++;
                }
                if ($n < $jumlah && is_array($token[$n]) && $token[$n][0] === T_DOUBLE_ARROW) {
                    $hasil[$t[2]] = trim($t[1], "'\"");
                }
            }
        }

        return $hasil;
    }
}
