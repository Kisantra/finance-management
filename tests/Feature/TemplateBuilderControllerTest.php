<?php

namespace Tests\Feature;

use App\Models\PdfTemplate;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class TemplateBuilderControllerTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Route sandbox kini dijaga `can:manage pdf templates`, sama seperti grup
     * settings/pdf-templates yang sah. Fixture lama memakai User::factory()
     * polos — pengguna tanpa izin apa pun — sehingga test ini menguji keadaan
     * yang di produksi justru HARUS ditolak. QC 2026-11-03 membuktikan celah itu
     * nyata: staff menimpa template PDF bawaan perusahaan lewat route ini.
     */
    private function berwenang(): User
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        Permission::firstOrCreate(['name' => 'manage pdf templates']);
        Role::firstOrCreate(['name' => 'admin'])->givePermissionTo('manage pdf templates');

        $user = User::factory()->create();
        $user->assignRole('admin');

        return $user;
    }

    public function test_saves_layout_to_database(): void
    {
        $user = $this->berwenang();

        $this->actingAs($user)
            ->post('/template-builder-test', [
                'layout' => [
                    ['id' => 1, 'type' => 'text', 'x' => 10, 'y' => 20, 'content' => 'Halo {{client.name}}'],
                ],
            ])
            ->assertRedirect();

        $template = PdfTemplate::query()->firstOrFail();
        $this->assertSame('Halo {{client.name}}', $template->layout[0]['content']);
    }

    public function test_save_upserts_single_template(): void
    {
        $user = $this->berwenang();

        $payload = fn (string $text) => [
            'layout' => [['id' => 1, 'type' => 'text', 'x' => 0, 'y' => 0, 'content' => $text]],
        ];

        $this->actingAs($user)->post('/template-builder-test', $payload('first'));
        $this->actingAs($user)->post('/template-builder-test', $payload('second'));

        $this->assertSame(1, PdfTemplate::query()->count());
        $this->assertSame('second', PdfTemplate::query()->first()->layout[0]['content']);
    }

    public function test_save_rejects_invalid_element_type(): void
    {
        $user = $this->berwenang();

        $this->actingAs($user)
            ->post('/template-builder-test', [
                'layout' => [['id' => 1, 'type' => 'bogus', 'x' => 0, 'y' => 0]],
            ])
            ->assertSessionHasErrors('layout.0.type');
    }

    public function test_pdf_renders_with_resolved_tokens(): void
    {
        $user = $this->berwenang();
        PdfTemplate::query()->create([
            'name' => 'Sandbox',
            'layout' => [
                ['id' => 1, 'type' => 'text', 'x' => 10, 'y' => 20, 'content' => 'Invoice {{invoice.number}}', 'fontSize' => 14, 'bold' => false, 'color' => '#000000'],
            ],
        ]);

        $response = $this->actingAs($user)->get('/template-builder-test/pdf');

        $response->assertOk();
        $this->assertStringContainsString('application/pdf', (string) $response->headers->get('content-type'));
    }

    public function test_pdf_renders_base64_image(): void
    {
        $user = $this->berwenang();
        // 1x1 transparent PNG data URI.
        $png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        PdfTemplate::query()->create([
            'name' => 'Sandbox',
            'layout' => [
                ['id' => 1, 'type' => 'image', 'x' => 10, 'y' => 20, 'src' => $png, 'width' => 100],
            ],
        ]);

        $response = $this->actingAs($user)->get('/template-builder-test/pdf');

        $response->assertOk();
        $this->assertStringContainsString('application/pdf', (string) $response->headers->get('content-type'));
    }

    public function test_pdf_renders_with_off_canvas_elements(): void
    {
        $user = $this->berwenang();
        // Negatif (lewat kiri/atas) & jauh melewati kanan/bawah → harus tetap 1 dokumen, tak crash.
        PdfTemplate::query()->create([
            'name' => 'Sandbox',
            'layout' => [
                ['id' => 1, 'type' => 'text', 'x' => -100, 'y' => -50, 'content' => 'Bleed kiri-atas', 'fontSize' => 14, 'bold' => false, 'color' => '#000000'],
                ['id' => 2, 'type' => 'text', 'x' => 700, 'y' => 1100, 'content' => 'Bleed kanan-bawah', 'fontSize' => 14, 'bold' => false, 'color' => '#000000'],
            ],
        ]);

        $response = $this->actingAs($user)->get('/template-builder-test/pdf');

        $response->assertOk();
        $this->assertStringContainsString('application/pdf', (string) $response->headers->get('content-type'));
    }

    public function test_routes_require_authentication(): void
    {
        $this->get('/template-builder-test')->assertRedirect('/login');
    }
}
