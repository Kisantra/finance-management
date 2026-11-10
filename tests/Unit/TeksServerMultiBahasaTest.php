<?php

namespace Tests\Unit;

use PhpToken;
use PHPUnit\Framework\TestCase;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;

/**
 * Lapis 2 jaring multi bahasa (pemindai server). Teks server yang TAMPIL ke pengguna wajib lewat
 * __() (kunci = teks Indonesia persis, terjemahan di lang/en.json & lang/zh.json), dan berkas bahasa
 * en/zh wajib sejajar dengan id. Konvensi: CLAUDE.md › "Multi Bahasa".
 *
 * Yang ditolak bila berupa literal (bukan __()):
 *   - flash: ->with('success|error|warning|info', …), session()->flash(…), ->with(['error' => …])
 *   - ->withErrors(…), ValidationException::withMessages(…)
 *   - JSON: 'message' => … di dalam ->json(…)
 *   - abort(kode, pesan), abort_if/abort_unless(kondisi, kode, pesan)
 *   - nilai messages() / attributes() di FormRequest
 *
 * Pengecualian SATU baris: komentar `// i18n-abaikan: <alasan>` di baris itu atau tepat di atasnya.
 * Tidak dipindai: app/Console (keluaran terminal), app/Mcp (teks untuk Claude, tetap Indonesia — D12),
 * app/Exports & resources/views/{pdf,exports} (dokumen, selalu Indonesia — K2).
 *
 * Teks yang DISIMPAN ke database atau dikirim ke sistem lain TIDAK boleh lewat __() (D8, D12) — tandai
 * dengan i18n-abaikan bila pemindai menangkapnya.
 */
class TeksServerMultiBahasaTest extends TestCase
{
    /** @var list<string> */
    private const FOLDER = ['app', 'routes'];

    /** @var list<string> */
    private const DIKECUALIKAN = ['app/Console/', 'app/Mcp/', 'app/Exports/', 'app/TallStackUi/', 'routes/console.php'];

    /** Kunci flash yang ditampilkan sebagai toast/peringatan. */
    private const KUNCI_FLASH = ['success', 'error', 'warning', 'info'];

    /** Fungsi penerjemah: literal di dalamnya sudah benar. */
    private const PENERJEMAH = ['__', 'trans', 'trans_choice'];

    /**
     * Grup lang/id/*.php yang hanya dipakai dokumen (PDF selalu Bahasa Indonesia, K2): tidak butuh en/zh.
     *
     * @var list<string>
     */
    private const GRUP_DOKUMEN = ['invoice'];

    public function test_teks_server_yang_tampil_lewat_terjemahan(): void
    {
        $temuan = [];
        foreach ($this->berkasPhp() as $relatif) {
            array_push($temuan, ...$this->pindaiBerkas($relatif));
        }

        $this->assertEmpty($temuan, $this->ringkas(
            'Teks server tampil tanpa __() — bungkus dengan __(\'teks Indonesia persis\') dan tambahkan ke lang/en.json & lang/zh.json'
            .' (teks yang DISIMPAN/dikirim ke sistem lain: tandai // i18n-abaikan: <alasan>).',
            $temuan,
        ));
    }

    public function test_kunci_json_server_ada_di_en_dan_zh(): void
    {
        $en = $this->bacaJson('en');
        $zh = $this->bacaJson('zh');
        $id = $this->bacaJson('id');
        $temuan = [];

        foreach ($this->kunciJsonDipakai() as $kunci => $lokasi) {
            // Kunci berbahasa Inggris bawaan Laravel/Breeze yang sudah diterjemahkan di lang/id.json tidak
            // butuh entri en (kuncinya sudah Inggris). Kunci lain = teks Indonesia (K1): wajib en & zh.
            $sasaran = array_key_exists($kunci, $id) ? ['zh' => $zh] : ['en' => $en, 'zh' => $zh];
            foreach ($sasaran as $bahasa => $kamus) {
                if (! array_key_exists($kunci, $kamus)) {
                    $temuan[] = "{$lokasi}  lang/{$bahasa}.json belum punya \"{$kunci}\"";
                } elseif ($this->placeholder($kamus[$kunci]) !== $this->placeholder($kunci)) {
                    $temuan[] = "{$lokasi}  lang/{$bahasa}.json \"{$kunci}\": placeholder :x tidak sama";
                }
            }
        }

        // Teks bawaan Laravel (kunci Inggris, mis. email reset kata sandi) yang diterjemahkan untuk id wajib juga ada di zh.
        foreach ($id as $kunci => $nilai) {
            if (! array_key_exists($kunci, $zh)) {
                $temuan[] = "lang/id.json  lang/zh.json belum punya \"{$kunci}\"";
            } elseif ($this->placeholder($zh[$kunci]) !== $this->placeholder((string) $nilai)) {
                $temuan[] = "lang/id.json  lang/zh.json \"{$kunci}\": placeholder :x tidak sama dengan id";
            }
        }

        $this->assertEmpty($temuan, $this->ringkas(
            'Kunci JSON server belum lengkap di lang/en.json / lang/zh.json'
            .' (kunci berbahasa Inggris bawaan Laravel: tambahkan terjemahannya ke lang/id.json & lang/zh.json).',
            $temuan,
        ));
    }

    public function test_berkas_lang_php_en_dan_zh_sejajar_dengan_id(): void
    {
        $temuan = [];
        foreach (glob($this->akar('lang/id/*.php')) ?: [] as $berkasId) {
            $grup = basename($berkasId, '.php');
            if (in_array($grup, self::GRUP_DOKUMEN, true)) {
                continue;
            }
            $sumber = $this->ratakan(require $berkasId);

            foreach (['en', 'zh'] as $bahasa) {
                $berkas = $this->akar("lang/{$bahasa}/{$grup}.php");
                if (! is_file($berkas)) {
                    $temuan[] = "lang/{$bahasa}/{$grup}.php belum ada (".count($sumber).' kunci di lang/id)';

                    continue;
                }
                $sasaran = $this->ratakan(require $berkas);
                foreach ($sumber as $kunci => $nilai) {
                    if (! array_key_exists($kunci, $sasaran)) {
                        $temuan[] = "lang/{$bahasa}/{$grup}.php belum punya '{$kunci}'";
                    } elseif ($this->placeholder($sasaran[$kunci]) !== $this->placeholder($nilai)) {
                        $temuan[] = "lang/{$bahasa}/{$grup}.php '{$kunci}': placeholder :x tidak sama dengan id";
                    }
                }
            }
        }

        $this->assertEmpty($temuan, $this->ringkas('Berkas lang/en & lang/zh tidak sejajar dengan lang/id.', $temuan));
    }

    /* ── Pemindaian literal ─────────────────────────────────────────────────────────────────── */

    /**
     * @return list<string>
     */
    private function pindaiBerkas(string $relatif): array
    {
        $kode = (string) file_get_contents($this->akar($relatif));
        $baris = preg_split('/\R/', $kode) ?: [];
        $abaikan = [];
        foreach ($baris as $i => $isi) {
            if (preg_match('/i18n-abaikan\s*:\s*\S/', $isi)) {
                $abaikan[$i + 1] = true;
            }
        }

        $tok = array_values(array_filter(
            PhpToken::tokenize($kode),
            fn (PhpToken $t): bool => ! $t->is([T_WHITESPACE, T_COMMENT, T_DOC_COMMENT, T_OPEN_TAG, T_CLOSE_TAG, T_INLINE_HTML]),
        ));
        $isFormRequest = str_starts_with($relatif, 'app/Http/Requests/');
        $temuan = [];
        $lapor = function (PhpToken $t, string $konteks) use (&$temuan, $relatif, $abaikan): void {
            if (isset($abaikan[$t->line]) || isset($abaikan[$t->line - 1])) {
                return;
            }
            $temuan[] = sprintf('%s:%d  %s  %s', $relatif, $t->line, $konteks, mb_strimwidth($t->text, 0, 90, '…'));
        };

        $n = count($tok);
        for ($i = 0; $i < $n; $i++) {
            $t = $tok[$i];
            $sebelum = $tok[$i - 1] ?? null;
            $buka = $tok[$i + 1] ?? null;
            if ($buka === null || $buka->text !== '(') {
                continue;
            }

            $nama = $t->text;
            $diPanggilSebagaiMetode = $sebelum !== null && $sebelum->is([T_OBJECT_OPERATOR, T_NULLSAFE_OBJECT_OPERATOR]);
            $diPanggilStatis = $sebelum !== null && $sebelum->is(T_DOUBLE_COLON);

            if (! $t->is([T_STRING, T_NAME_QUALIFIED, T_NAME_FULLY_QUALIFIED])) {
                continue;
            }
            [$argumen] = $this->argumen($tok, $i + 1);

            // Flash: ->with('success', …), ->with(['error' => …]), session()->flash(…), Session::flash(…)
            if (($diPanggilSebagaiMetode && $nama === 'with') || (($diPanggilSebagaiMetode || $diPanggilStatis) && $nama === 'flash')) {
                $kunciFlash = $this->stringLiteral($tok, $argumen[0] ?? null);
                if (count($argumen) >= 2 && in_array($kunciFlash, self::KUNCI_FLASH, true)) {
                    foreach ($this->literalTeks($tok, $argumen[1]) as $lit) {
                        $lapor($lit, "flash {$nama}('{$kunciFlash}')");
                    }
                } elseif (isset($argumen[0]) && $tok[$argumen[0][0]]->text === '[') {
                    foreach ($this->nilaiArray($tok, $argumen[0], self::KUNCI_FLASH) as $lit) {
                        $lapor($lit, "flash {$nama}([…])");
                    }
                }
            }

            if ($diPanggilSebagaiMetode && $nama === 'withErrors') {
                foreach ($argumen as $arg) {
                    foreach ($this->literalTeks($tok, $arg) as $lit) {
                        $lapor($lit, 'withErrors');
                    }
                }
            }

            if ($diPanggilStatis && $nama === 'withMessages') {
                foreach ($argumen as $arg) {
                    foreach ($this->literalTeks($tok, $arg) as $lit) {
                        $lapor($lit, 'ValidationException::withMessages');
                    }
                }
            }

            if ($diPanggilSebagaiMetode && $nama === 'json' && isset($argumen[0]) && $tok[$argumen[0][0]]->text === '[') {
                foreach ($this->nilaiArray($tok, $argumen[0], ['message']) as $lit) {
                    $lapor($lit, "json 'message'");
                }
            }

            if (! $diPanggilSebagaiMetode && ! $diPanggilStatis && in_array($nama, ['abort', 'abort_if', 'abort_unless'], true)) {
                $posisi = $nama === 'abort' ? 1 : 2;
                if (isset($argumen[$posisi])) {
                    foreach ($this->literalTeks($tok, $argumen[$posisi]) as $lit) {
                        $lapor($lit, $nama);
                    }
                }
            }

            // FormRequest: nilai messages() / attributes().
            if ($isFormRequest && $sebelum !== null && $sebelum->is(T_FUNCTION) && in_array($nama, ['messages', 'attributes'], true)) {
                $tubuh = $this->tubuhFungsi($tok, $i);
                if ($tubuh !== null) {
                    foreach ($this->literalTeks($tok, $tubuh) as $lit) {
                        $lapor($lit, "{$nama}()");
                    }
                }
            }
        }

        return $temuan;
    }

    /**
     * Argumen pemanggilan: daftar rentang [awal, akhir] (indeks token, inklusif) pada kedalaman 0.
     *
     * @param  list<PhpToken>  $tok
     * @return array{0: list<array{0: int, 1: int}>, 1: int}
     */
    private function argumen(array $tok, int $buka): array
    {
        $kedalaman = 0;
        $awal = $buka + 1;
        $hasil = [];
        $n = count($tok);
        for ($j = $buka; $j < $n; $j++) {
            $x = $tok[$j]->text;
            if (in_array($x, ['(', '[', '{'], true) || $tok[$j]->is([T_CURLY_OPEN, T_DOLLAR_OPEN_CURLY_BRACES])) {
                $kedalaman++;
            } elseif (in_array($x, [')', ']', '}'], true)) {
                $kedalaman--;
                if ($kedalaman === 0) {
                    if ($j > $awal) {
                        $hasil[] = [$awal, $j - 1];
                    }

                    return [$hasil, $j];
                }
            } elseif ($x === ',' && $kedalaman === 1) {
                $hasil[] = [$awal, $j - 1];
                $awal = $j + 1;
            }
        }

        return [$hasil, $n - 1];
    }

    /**
     * Rentang tubuh fungsi (di antara kurung kurawalnya) dari indeks nama fungsi.
     *
     * @param  list<PhpToken>  $tok
     * @return array{0: int, 1: int}|null
     */
    private function tubuhFungsi(array $tok, int $nama): ?array
    {
        $n = count($tok);
        for ($j = $nama; $j < $n && $tok[$j]->text !== '{'; $j++) {
            if ($tok[$j]->text === ';') {
                return null;
            }
        }
        $kedalaman = 0;
        for ($k = $j; $k < $n; $k++) {
            if ($tok[$k]->text === '{' || $tok[$k]->is([T_CURLY_OPEN, T_DOLLAR_OPEN_CURLY_BRACES])) {
                $kedalaman++;
            } elseif ($tok[$k]->text === '}') {
                $kedalaman--;
                if ($kedalaman === 0) {
                    return [$j + 1, $k - 1];
                }
            }
        }

        return null;
    }

    /**
     * Literal string berhuruf di dalam rentang yang BUKAN: argumen __()/trans(), kunci array (diikuti =>),
     * atau perbandingan. Literal yang dirangkai ('Gagal: '.$e) tetap tertangkap.
     *
     * @param  list<PhpToken>  $tok
     * @param  array{0: int, 1: int}|null  $rentang
     * @return list<PhpToken>
     */
    private function literalTeks(array $tok, ?array $rentang, bool $hanyaBerhuruf = true): array
    {
        if ($rentang === null) {
            return [];
        }
        [$awal, $akhir] = $rentang;
        $hasil = [];
        for ($j = $awal; $j <= $akhir; $j++) {
            $t = $tok[$j];
            // Lewati seluruh pemanggilan penerjemah: __('Teks :x', ['x' => 'nilai']).
            if ($t->is(T_STRING) && in_array($t->text, self::PENERJEMAH, true) && ($tok[$j + 1]->text ?? null) === '(') {
                [, $tutup] = $this->argumen($tok, $j + 1);
                $j = $tutup;

                continue;
            }
            $literal = $t->is(T_CONSTANT_ENCAPSED_STRING) || $t->text === '"' || $t->is(T_START_HEREDOC);
            if (! $literal) {
                continue;
            }
            $berikut = $tok[$j + 1] ?? null;
            if ($berikut !== null && $berikut->is(T_DOUBLE_ARROW)) {
                continue;
            }
            $isi = $t->text === '"' || $t->is(T_START_HEREDOC) ? $this->isiTerinterpolasi($tok, $j) : $t->text;
            if ($hanyaBerhuruf && ! preg_match('/\p{L}{2,}/u', $isi)) {
                continue;
            }
            $hasil[] = new PhpToken(T_CONSTANT_ENCAPSED_STRING, $isi, $t->line, $t->pos);
            if ($t->text === '"' || $t->is(T_START_HEREDOC)) {
                $j = $this->akhirTerinterpolasi($tok, $j);
            }
        }

        return $hasil;
    }

    /**
     * Literal nilai untuk kunci tertentu di sebuah array: ['message' => 'Teks'].
     *
     * @param  list<PhpToken>  $tok
     * @param  array{0: int, 1: int}  $rentang
     * @param  list<string>  $kunci
     * @return list<PhpToken>
     */
    private function nilaiArray(array $tok, array $rentang, array $kunci): array
    {
        [$elemen] = $this->argumen($tok, $rentang[0]);
        $hasil = [];
        foreach ($elemen as [$awal, $akhir]) {
            if (($tok[$awal + 1] ?? null)?->is(T_DOUBLE_ARROW) && in_array($this->stringLiteral($tok, [$awal, $awal]), $kunci, true)) {
                array_push($hasil, ...$this->literalTeks($tok, [$awal + 2, $akhir]));
            }
        }

        return $hasil;
    }

    /**
     * @param  list<PhpToken>  $tok
     * @param  array{0: int, 1: int}|null  $rentang
     */
    private function stringLiteral(array $tok, ?array $rentang): ?string
    {
        if ($rentang === null || ! $tok[$rentang[0]]->is(T_CONSTANT_ENCAPSED_STRING)) {
            return null;
        }

        return stripcslashes(substr($tok[$rentang[0]]->text, 1, -1));
    }

    /** @param  list<PhpToken>  $tok */
    private function isiTerinterpolasi(array $tok, int $awal): string
    {
        $akhir = $this->akhirTerinterpolasi($tok, $awal);

        return implode('', array_map(fn (PhpToken $t): string => $t->text, array_slice($tok, $awal, $akhir - $awal + 1)));
    }

    /** @param  list<PhpToken>  $tok */
    private function akhirTerinterpolasi(array $tok, int $awal): int
    {
        $penutup = $tok[$awal]->is(T_START_HEREDOC) ? T_END_HEREDOC : null;
        $n = count($tok);
        for ($j = $awal + 1; $j < $n; $j++) {
            if ($penutup !== null ? $tok[$j]->is($penutup) : $tok[$j]->text === '"') {
                return $j;
            }
        }

        return $awal;
    }

    /* ── Kunci & berkas bahasa ──────────────────────────────────────────────────────────────── */

    /**
     * Kunci JSON (__('teks Indonesia')) yang dipakai kode & view tampilan → lokasi pertama.
     *
     * @return array<string, string>
     */
    private function kunciJsonDipakai(): array
    {
        $berkas = $this->berkasPhp();
        foreach ($this->telusuri('resources/views') as $view) {
            if (! str_starts_with($view, 'resources/views/pdf/') && ! str_starts_with($view, 'resources/views/exports/')) {
                $berkas[] = $view;
            }
        }

        $kunci = [];
        foreach ($berkas as $relatif) {
            $tok = array_values(array_filter(
                PhpToken::tokenize((string) file_get_contents($this->akar($relatif))),
                fn (PhpToken $t): bool => ! $t->is([T_WHITESPACE, T_COMMENT, T_DOC_COMMENT]),
            ));
            foreach ($tok as $j => $t) {
                if (! $t->is(T_STRING) || ! in_array($t->text, self::PENERJEMAH, true) || ($tok[$j + 1]->text ?? null) !== '(') {
                    continue;
                }
                $teks = $this->stringLiteral($tok, [$j + 2, $j + 2]);
                if ($teks === null || $teks === '' || $this->kunciGrup($teks)) {
                    continue;
                }
                $kunci[$teks] ??= "{$relatif}:{$t->line}";
            }
            // Blade: @lang('…') dan {{ __('…') }} ikut tertangkap tokenizer sebagai T_STRING __ di dalam HTML? Tidak:
            // Blade bukan PHP murni, jadi pindai teksnya juga.
            if (str_ends_with($relatif, '.blade.php')) {
                preg_match_all("/(?:__|@lang|trans)\(\s*'((?:[^'\\\\]|\\\\.)*)'/", (string) file_get_contents($this->akar($relatif)), $cocok);
                foreach ($cocok[1] as $teks) {
                    $teks = stripcslashes($teks);
                    if ($teks !== '' && ! $this->kunciGrup($teks)) {
                        $kunci[$teks] ??= $relatif;
                    }
                }
            }
        }

        return $kunci;
    }

    /** "invoice.title" (grup lang/id/invoice.php) atau "paket::grup.kunci" — bukan kunci JSON. */
    private function kunciGrup(string $kunci): bool
    {
        if (str_contains($kunci, '::')) {
            return true;
        }

        return (bool) preg_match('/^([a-z][a-z0-9_-]*)\.[A-Za-z0-9_.-]+$/', $kunci, $m) && is_file($this->akar("lang/id/{$m[1]}.php"));
    }

    /**
     * @return array<string, string>
     */
    private function bacaJson(string $bahasa): array
    {
        $berkas = $this->akar("lang/{$bahasa}.json");

        return is_file($berkas) ? (array) json_decode((string) file_get_contents($berkas), true, 512, JSON_THROW_ON_ERROR) : [];
    }

    /**
     * @param  array<array-key, mixed>  $data
     * @return array<string, string>
     */
    private function ratakan(array $data, string $awalan = ''): array
    {
        $hasil = [];
        foreach ($data as $kunci => $nilai) {
            $nama = $awalan === '' ? (string) $kunci : "{$awalan}.{$kunci}";
            if (is_array($nilai)) {
                $hasil += $this->ratakan($nilai, $nama);
            } else {
                $hasil[$nama] = (string) $nilai;
            }
        }

        return $hasil;
    }

    /**
     * Placeholder Laravel (:nama), tanpa membedakan :Nama / :NAMA.
     *
     * @return list<string>
     */
    private function placeholder(string $teks): array
    {
        preg_match_all('/:([A-Za-z_]+)/', $teks, $m);
        $nama = array_values(array_unique(array_map('strtolower', $m[1])));
        sort($nama);

        return $nama;
    }

    /* ── Berkas ──────────────────────────────────────────────────────────────────────────────── */

    /**
     * @return list<string>
     */
    private function berkasPhp(): array
    {
        $hasil = [];
        foreach (self::FOLDER as $folder) {
            foreach ($this->telusuri($folder) as $relatif) {
                foreach (self::DIKECUALIKAN as $kecuali) {
                    if (str_starts_with($relatif, $kecuali)) {
                        continue 2;
                    }
                }
                $hasil[] = $relatif;
            }
        }

        return $hasil;
    }

    /**
     * @return list<string>
     */
    private function telusuri(string $folder): array
    {
        $hasil = [];
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($this->akar($folder), RecursiveDirectoryIterator::SKIP_DOTS));
        foreach ($iterator as $berkas) {
            if ($berkas->isFile() && str_ends_with($berkas->getFilename(), '.php')) {
                $hasil[] = str_replace('\\', '/', substr($berkas->getPathname(), strlen($this->akar(''))));
            }
        }
        sort($hasil);

        return $hasil;
    }

    private function akar(string $relatif): string
    {
        return dirname(__DIR__, 2).'/'.ltrim($relatif, '/');
    }

    /**
     * @param  list<string>  $temuan
     */
    private function ringkas(string $judul, array $temuan): string
    {
        $tampil = array_slice($temuan, 0, 400);

        return $judul.' ('.count($temuan)." temuan)\n  ".implode("\n  ", $tampil)
            .(count($temuan) > count($tampil) ? "\n  … ".(count($temuan) - count($tampil)).' lagi' : '');
    }
}
