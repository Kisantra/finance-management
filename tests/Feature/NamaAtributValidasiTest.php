<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Validator;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\DataProvider;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * QA multi bahasa F03/F04: pesan validasi memakai nama field yang dibaca manusia (bukan `type`,
 * `items.0.description`), dan pesan bawaan Laravel di halaman 403 ikut bahasa tampilan.
 */
class NamaAtributValidasiTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        App::setLocale('id');

        parent::tearDown();
    }

    private function adminDenganBahasa(string $locale): User
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        foreach (['view services', 'create services'] as $izin) {
            Permission::firstOrCreate(['name' => $izin]);
        }
        Role::firstOrCreate(['name' => 'admin'])->syncPermissions(['view services', 'create services']);

        $user = User::factory()->create(['locale' => $locale]);
        $user->assignRole('admin');

        return $user;
    }

    /**
     * @return array<string, array{0: string, 1: string}>
     */
    public static function bahasaDanNamaJenis(): array
    {
        return [
            'id' => ['id', 'jenis'],
            'en' => ['en', 'type'],
            'zh' => ['zh', '类型'],
        ];
    }

    #[DataProvider('bahasaDanNamaJenis')]
    public function test_form_layanan_kosong_menampilkan_nama_field_baku(string $locale, string $nama): void
    {
        $user = $this->adminDenganBahasa($locale);

        $respons = $this->actingAs($user)->post('/services', []);

        $respons->assertSessionHasErrors('type');
        $pesan = session('errors')->first('type');
        $this->assertStringContainsStringIgnoringCase($nama, $pesan);
        if ($locale !== 'en') {
            $this->assertStringNotContainsStringIgnoringCase('type', $pesan);
        }
    }

    #[DataProvider('bahasaDanNamaJenis')]
    public function test_nama_atribut_item_berpola_wildcard_diterjemahkan(string $locale, string $nama): void
    {
        App::setLocale($locale);

        $validator = Validator::make(
            ['items' => [[]]],
            [
                'role' => 'required',
                'label' => 'required',
                'slug' => 'required',
                'abbreviation' => 'required',
                'items.*.description' => 'required',
                'items.*.category_id' => 'required',
                'items.*.unit_price' => 'required',
            ],
        );

        $semua = implode(' | ', $validator->errors()->all());

        $mentahSemua = ['items.0.', 'category_id', 'unit_price'];
        if ($locale !== 'en') {
            array_push($mentahSemua, 'abbreviation', 'slug', 'role', 'label');
        }

        foreach ($mentahSemua as $mentah) {
            $this->assertStringNotContainsString($mentah, $semua, "Nama mentah '{$mentah}' bocor di {$locale}: {$semua}");
        }
    }

    public function test_halaman_403_menerjemahkan_pesan_bawaan_laravel(): void
    {
        // Halaman error Inertia hanya tampil bila debug mati; tanpa ini hasilnya ikut .env (CI: debug nyala → halaman bawaan Laravel).
        config(['app.debug' => false]);
        app()[PermissionRegistrar::class]->forgetCachedPermissions();
        $user = User::factory()->create(['locale' => 'zh']);

        $this->actingAs($user)
            ->get('/services')
            ->assertForbidden()
            ->assertInertia(fn (Assert $page) => $page->where('description', '您无权执行此操作。'));

        $user->update(['locale' => 'id']);

        $this->actingAs($user->fresh())
            ->get('/services')
            ->assertForbidden()
            ->assertInertia(fn (Assert $page) => $page->where('description', 'Anda tidak memiliki izin untuk melakukan tindakan ini.'));
    }
}
