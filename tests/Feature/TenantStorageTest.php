<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Regresi BUG-02 (QA 2026-08-19): berkas yang diunggah dalam konteks perusahaan
 * ditulis ke storage/tenant{slug}/app/public tetapi Storage::url() masih
 * menunjuk symlink public/storage milik DB pusat, sehingga setiap lampiran,
 * logo, tanda tangan, dan bukti bayar gagal dimuat (403/404).
 */
class TenantStorageTest extends TestCase
{
    use RefreshDatabase;

    public function test_storage_url_points_to_company_scoped_route(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->get('/dashboard');

        $url = Storage::disk('public')->url('lampiran/contoh.png');

        $this->assertStringContainsString(
            '/c/'.self::TEST_COMPANY.'/storage/lampiran/contoh.png',
            $url,
            'URL berkas harus lewat route perusahaan, bukan symlink /storage pusat.'
        );
    }

    public function test_member_can_download_company_file(): void
    {
        Storage::fake('public');
        $user = User::factory()->create();

        Storage::disk('public')->put('lampiran/bukti.txt', 'isi-bukti');

        $this->actingAs($user)
            ->get('/storage/lampiran/bukti.txt')
            ->assertOk();
    }

    public function test_missing_file_returns_404(): void
    {
        Storage::fake('public');
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get('/storage/lampiran/tidak-ada.txt')
            ->assertNotFound();
    }

    public function test_path_traversal_is_rejected(): void
    {
        Storage::fake('public');
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get('/storage/../../.env')
            ->assertNotFound();
    }

    public function test_uploaded_attachment_is_reachable_end_to_end(): void
    {
        Storage::fake('public');
        $user = User::factory()->create();

        $path = UploadedFile::fake()->image('struk.png')->store('lampiran', 'public');

        $this->actingAs($user)
            ->get(Storage::disk('public')->url($path))
            ->assertOk();
    }
}
