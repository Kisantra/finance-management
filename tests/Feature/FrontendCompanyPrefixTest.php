<?php

namespace Tests\Feature;

use PHPUnit\Framework\TestCase;

/**
 * GERBANG: tidak boleh ada path aplikasi literal di resources/js.
 *
 * Setiap URL aplikasi harus lewat `companyUrl()` / `api()` / `<AppLink>` supaya
 * mendapat prefix `/c/{company}`. Melewatkannya GAGAL SENYAP: tidak gagal compile,
 * dan suite request tidak melihatnya karena Tests\TestCase memberi prefix sendiri
 * ke setiap URI. Pecahnya baru di browser — 404, atau path relatif yang resolve
 * ke perusahaan lain.
 *
 * Ini pemeriksaan BERKAS STATIS: sengaja memakai PHPUnit\Framework\TestCase, bukan
 * Tests\TestCase, agar tidak membuka koneksi database sama sekali.
 */
class FrontendCompanyPrefixTest extends TestCase
{
    /**
     * Path di LUAR grup /c/{company} plus aset publik — keduanya tidak boleh diberi prefix.
     * Rute diturunkan dari `php artisan route:list` (otoritatif), bukan dari membaca berkas route.
     *
     * @var list<string>
     */
    private const ALLOW = [
        '/', '/login', '/logout', '/register', '/forgot-password', '/reset-password',
        '/confirm-password', '/verify-email', '/email', '/choose-company', '/panduan',
        '/language', '/tenancy', '/up', '/_inertia', '/_boost',
        '/images', '/videos', '/build', '/fonts', '/favicon.ico',
    ];

    /**
     * Berkas yang memang menulis path mentah: helper prefix itu sendiri, halaman
     * central (pra-login), dan kode hasil generate Wayfinder.
     *
     * @var list<string>
     */
    private const SKIP = [
        '/lib/company.ts', '/components/app-link.tsx',
        '/pages/auth/', '/pages/guide/', '/pages/choose-company.tsx',
        '/actions/', '/routes/', '/wayfinder/',
    ];

    public function test_tidak_ada_path_aplikasi_literal_di_resources_js(): void
    {
        $base = str_replace(DIRECTORY_SEPARATOR, '/', dirname(__DIR__, 2)).'/resources/js';
        $pelanggaran = [];

        foreach ($this->berkasFrontend($base) as $berkas) {
            $rel = substr(str_replace(DIRECTORY_SEPARATOR, '/', $berkas), strlen($base));

            foreach (self::SKIP as $skip) {
                if (str_contains($rel, $skip)) {
                    continue 2;
                }
            }

            $kode = file_get_contents($berkas);

            /** Panggilan: router.get('/x'), form.post('/x'), fetch('/x'), window.open('/x'). */
            preg_match_all(
                '~(?:\.(?:get|post|put|patch|delete|visit|submit)|\bfetch|window\.open)\(\s*[\'`](/[^\'`$]*)~',
                $kode,
                $panggilan
            );

            /** href literal pada <a>/<Link> mentah; <AppLink> & turunannya memberi prefix sendiri. */
            preg_match_all('~<(?:a|Link)\b[^>]*?\shref=(?:"|\{\s*[\'`])(/[^"\'`$]*)~', $kode, $href);

            foreach (array_merge($panggilan[1], $href[1]) as $path) {
                if (! $this->diizinkan($path)) {
                    $pelanggaran[] = $rel.' → '.$path;
                }
            }
        }

        $this->assertSame([], $pelanggaran, implode("\n", array_merge(
            ['Path aplikasi literal tanpa prefix perusahaan. Pakai companyUrl() / api() / <AppLink>:'],
            $pelanggaran
        )));
    }

    private function diizinkan(string $path): bool
    {
        $bersih = strtok($path, '?#') ?: $path;

        if (str_starts_with($bersih, '/c/')) {
            return true;
        }

        foreach (self::ALLOW as $allow) {
            // '/' hanya cocok persis — sebagai prefix ia mengizinkan SEMUA path.
            if ($bersih === $allow || ($allow !== '/' && str_starts_with($bersih, $allow.'/'))) {
                return true;
            }
        }

        return false;
    }

    /** @return list<string> */
    private function berkasFrontend(string $base): array
    {
        $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($base, \FilesystemIterator::SKIP_DOTS));
        $berkas = [];

        foreach ($iterator as $file) {
            if ($file->isFile() && preg_match('~\.tsx?$~', $file->getFilename())) {
                $berkas[] = $file->getPathname();
            }
        }

        return $berkas;
    }
}
