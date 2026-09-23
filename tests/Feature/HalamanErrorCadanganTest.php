<?php

namespace Tests\Feature;

use App\Services\ErrorReportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\View;
use Tests\TestCase;

/**
 * Lapisan terakhir penanganan error. Halaman Inertia `error` butuh view + database
 * yang sehat; ketika justru itu yang rusak (2026-09-17: view composer memanggil
 * tabel yang tidak ada), Laravel jatuh ke halaman Symfony polos. Halaman Blade ini
 * menggantikannya, dengan syarat mutlak: tidak menyentuh database sama sekali.
 */
class HalamanErrorCadanganTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return list<array{0: string}>
     */
    public static function daftarHalaman(): array
    {
        return [['403'], ['404'], ['419'], ['429'], ['500'], ['503']];
    }

    /**
     * @dataProvider daftarHalaman
     */
    public function test_halaman_dirender_tanpa_satu_pun_query_database(string $kode): void
    {
        $queries = [];
        DB::listen(function ($query) use (&$queries) {
            $queries[] = $query->sql;
        });

        $html = View::make("errors.{$kode}")->render();

        $this->assertSame([], $queries,
            "Halaman cadangan {$kode} menyentuh database — padahal database yang rusak justru penyebab halaman ini tampil.");
        $this->assertStringContainsString("Kode {$kode}", $html);
        $this->assertMatchesRegularExpression('/ERR-[A-Z0-9]{10}/', $html,
            'ID referensi wajib ada supaya bisa dicocokkan dengan laravel.log.');
    }

    public function test_tidak_memuat_aset_vite_karena_build_bisa_ikut_bermasalah(): void
    {
        $html = View::make('errors.500')->render();

        $this->assertStringNotContainsString('/build/', $html);
        $this->assertStringNotContainsString('@vite', $html);
    }

    public function test_tetap_tampil_meski_tabel_company_profiles_hilang(): void
    {
        // Persis kegagalan produksi: view composer global memanggil company_profiles.
        Schema::drop('company_profiles');

        $html = View::make('errors.500')->render();

        $this->assertStringContainsString('Terjadi kesalahan di sistem', $html);
    }

    public function test_id_referensi_sama_dengan_yang_dipakai_layanan_laporan(): void
    {
        $id = ErrorReportService::referenceId(request());

        $this->assertStringContainsString($id, View::make('errors.404')->render(),
            'ID di halaman cadangan dan di log harus satu, bukan dua ID berbeda untuk satu error.');
    }
}
