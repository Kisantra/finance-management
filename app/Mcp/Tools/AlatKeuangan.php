<?php

namespace App\Mcp\Tools;

use App\Mcp\AksesClaude;
use App\Models\Company;
use App\Models\User;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\JsonSchema\Types\Type;
use Illuminate\Support\Facades\Log;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Tool;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

/**
 * Dasar setiap alat data perusahaan. Alat turunan cukup mengisi izin(), skemaTambahan(),
 * dan jalankan(); bagian di sini menjamin, untuk SEMUA alat:
 *
 * 1. Hanya membaca. Tidak ada alat yang menulis; anotasi read-only diumumkan ke klien.
 * 2. Perusahaan diminta lewat argumen `perusahaan` (slug). User harus anggota aktifnya
 *    dan memegang `use claude` + izin modul alat itu DI perusahaan tersebut.
 * 3. jalankan() berjalan di database perusahaan, dan koneksi SELALU dikembalikan ke
 *    pusat lewat finally. Tenant::run() bawaan stancl tidak memakai finally, sehingga
 *    exception di tengah meninggalkan sisa request tersambung ke database perusahaan.
 * 4. Setiap panggilan dicatat (user, perusahaan, alat, argumen) ke log aplikasi.
 */
abstract class AlatKeuangan extends Tool
{
    /**
     * Atribut PHP tidak diwariskan dan HasAnnotations hanya membaca atribut kelas konkret,
     * jadi tanda read-only dipasang di sini agar setiap alat turunan membawanya.
     *
     * @return array<string, mixed>
     */
    public function annotations(): array
    {
        return [...parent::annotations(), (new IsReadOnly)->key() => true];
    }

    /** Izin modul yang wajib dimiliki di perusahaan yang diminta, mis. 'view invoices'. */
    abstract protected function izin(): string;

    /**
     * Isi alat. Berjalan dengan tenancy perusahaan aktif dan team Spatie terpasang.
     * Nominal uang dikembalikan sebagai integer rupiah penuh (sama dengan database).
     *
     * @return array<string, mixed>
     */
    abstract protected function jalankan(Request $request, Company $perusahaan): array;

    /**
     * Argumen tambahan selain `perusahaan`.
     *
     * @return array<string, Type>
     */
    protected function skemaTambahan(JsonSchema $schema): array
    {
        return [];
    }

    /**
     * @return array<string, Type>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'perusahaan' => $schema->string()
                ->description('Kode perusahaan (slug), mis. "utama". Daftar kode yang boleh dibaca: alat daftar-perusahaan.')
                ->required(),
            ...$this->skemaTambahan($schema),
        ];
    }

    public function handle(Request $request, AksesClaude $akses): Response
    {
        $user = $request->user();
        $slug = trim((string) $request->get('perusahaan', ''));
        $perusahaan = $slug === '' ? null : Company::query()->find($slug);

        if (! $user instanceof User || ! $perusahaan || ! $akses->boleh($user, $perusahaan, $this->izin())) {
            // Satu pesan untuk "tidak ada", "bukan anggota", dan "tanpa izin": keberadaan
            // perusahaan lain bukan informasi yang perlu dibocorkan.
            return Response::error("Perusahaan \"{$slug}\" tidak bisa dibaca: tidak ada, Anda bukan anggotanya, atau peran Anda di sana tidak punya izin {$this->izin()}. Panggil daftar-perusahaan untuk melihat kode yang boleh dibaca.");
        }

        Log::info('mcp.alat', [
            'user_id' => $user->getAuthIdentifier(),
            'perusahaan' => $perusahaan->getKey(),
            'alat' => $this->name(),
            'argumen' => $request->all(),
        ]);

        $timSebelumnya = getPermissionsTeamId();
        setPermissionsTeamId($perusahaan->getKey());
        $user->unsetRelation('roles')->unsetRelation('permissions');
        tenancy()->initialize($perusahaan);

        try {
            $hasil = $this->jalankan($request, $perusahaan);
        } finally {
            tenancy()->end();
            setPermissionsTeamId($timSebelumnya);
            $user->unsetRelation('roles')->unsetRelation('permissions');
        }

        return Response::json([
            'perusahaan' => ['kode' => $perusahaan->getKey(), 'nama' => $perusahaan->name],
            ...$hasil,
        ]);
    }
}
