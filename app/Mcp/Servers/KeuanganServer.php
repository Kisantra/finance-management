<?php

namespace App\Mcp\Servers;

use App\Mcp\Tools\DaftarInvoice;
use App\Mcp\Tools\DaftarKlien;
use App\Mcp\Tools\DaftarLayanan;
use App\Mcp\Tools\DaftarPengajuanDana;
use App\Mcp\Tools\DaftarPerusahaan;
use App\Mcp\Tools\DaftarPinjaman;
use App\Mcp\Tools\DaftarPiutang;
use App\Mcp\Tools\DaftarReimbursement;
use App\Mcp\Tools\DetailInvoice;
use App\Mcp\Tools\InvoiceBerulang;
use App\Mcp\Tools\KategoriTransaksi;
use App\Mcp\Tools\LabaRugi;
use App\Mcp\Tools\MutasiRekening;
use App\Mcp\Tools\RekeningBank;
use App\Mcp\Tools\RingkasanKeuangan;
use Laravel\Mcp\Server;

/**
 * Koneksi Claude ke data keuangan (hanya baca). Rute & autentikasi: routes/ai.php.
 * Aturan akses tiap alat: App\Mcp\AksesClaude + App\Mcp\Tools\AlatKeuangan.
 */
class KeuanganServer extends Server
{
    protected string $name = 'Kisantra Finance';

    protected string $version = '1.0.0';

    protected string $instructions = <<<'MARKDOWN'
        Data keuangan perusahaan dari aplikasi Kisantra Finance. Semua alat hanya membaca; tidak ada yang bisa mengubah data.

        Cara memakai:
        - Panggil `daftar-perusahaan` lebih dulu. Setiap alat lain wajib diberi argumen `perusahaan` berisi kode dari daftar itu.
        - Pengguna bisa saja anggota beberapa perusahaan (satu grup). Data tiap perusahaan terpisah; bandingkan atau jumlahkan sendiri bila diminta, dan sebutkan perusahaan mana yang dihitung.
        - Semua nominal dalam rupiah penuh (integer, tanpa desimal). Tanggal berformat YYYY-MM-DD.
        - Daftar yang panjang dibagi per halaman: perhatikan `halaman`, `total_halaman`, dan panggil lagi dengan `halaman` berikutnya bila perlu data lengkap.
        - Bila alat menjawab tidak punya izin, sampaikan apa adanya; jangan menebak angka.
        - Jawab dalam bahasa pengguna; sebut sumber angka (nama alat dan rentang tanggal) bila pengguna mengambil keputusan dari angka itu.
        MARKDOWN;

    protected array $tools = [
        DaftarPerusahaan::class,
        RingkasanKeuangan::class,
        LabaRugi::class,
        RekeningBank::class,
        MutasiRekening::class,
        KategoriTransaksi::class,
        DaftarInvoice::class,
        DetailInvoice::class,
        DaftarKlien::class,
        DaftarLayanan::class,
        InvoiceBerulang::class,
        DaftarReimbursement::class,
        DaftarPengajuanDana::class,
        DaftarPinjaman::class,
        DaftarPiutang::class,
    ];
}
