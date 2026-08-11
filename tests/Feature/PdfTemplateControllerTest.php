<?php

namespace Tests\Feature;

use App\Models\PdfTemplate;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class PdfTemplateControllerTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected User $viewer;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        Permission::firstOrCreate(['name' => 'manage pdf templates']);

        $adminRole = Role::firstOrCreate(['name' => 'admin']);
        $adminRole->givePermissionTo('manage pdf templates');

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');

        // User without the permission
        $this->viewer = User::factory()->create();
    }

    // ── Permission gate ──────────────────────────────────────────────────────

    public function test_unauthenticated_user_is_redirected(): void
    {
        $this->get('/settings/pdf-templates')->assertRedirect('/login');
    }

    public function test_user_without_permission_gets_403(): void
    {
        $this->actingAs($this->viewer)
            ->get('/settings/pdf-templates')
            ->assertForbidden();
    }

    public function test_admin_can_access_index(): void
    {
        $this->actingAs($this->admin)
            ->get('/settings/pdf-templates')
            ->assertOk();
    }

    // ── CRUD ─────────────────────────────────────────────────────────────────

    public function test_store_creates_template(): void
    {
        $this->actingAs($this->admin)
            ->post('/settings/pdf-templates', [
                'name' => 'Template A',
                'description' => 'Deskripsi A',
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('pdf_templates', [
            'name' => 'Template A',
            'description' => 'Deskripsi A',
            'is_default' => false,
        ]);
    }

    public function test_store_requires_name(): void
    {
        $this->actingAs($this->admin)
            ->post('/settings/pdf-templates', ['name' => ''])
            ->assertSessionHasErrors('name');
    }

    public function test_update_renames_and_updates_description(): void
    {
        $template = PdfTemplate::query()->create([
            'name' => 'Lama',
            'description' => null,
            'layout' => [],
            'is_default' => false,
        ]);

        $this->actingAs($this->admin)
            ->put("/settings/pdf-templates/{$template->id}", [
                'name' => 'Baru',
                'description' => 'Deskripsi baru',
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('pdf_templates', [
            'id' => $template->id,
            'name' => 'Baru',
            'description' => 'Deskripsi baru',
        ]);
    }

    public function test_destroy_deletes_template(): void
    {
        $template = PdfTemplate::query()->create([
            'name' => 'Hapus Saya',
            'layout' => [],
            'is_default' => false,
        ]);

        $this->actingAs($this->admin)
            ->delete("/settings/pdf-templates/{$template->id}")
            ->assertRedirect('/c/test-company/settings/pdf-templates');

        $this->assertDatabaseMissing('pdf_templates', ['id' => $template->id]);
    }

    public function test_duplicate_creates_copy(): void
    {
        $template = PdfTemplate::query()->create([
            'name' => 'Asli',
            'description' => 'Desc asli',
            'layout' => [['id' => 1, 'type' => 'text', 'x' => 10, 'y' => 20, 'content' => 'Hello']],
            'is_default' => false,
        ]);

        $this->actingAs($this->admin)
            ->post("/settings/pdf-templates/{$template->id}/duplicate")
            ->assertRedirect();

        $this->assertSame(2, PdfTemplate::query()->count());

        $copy = PdfTemplate::query()->where('name', 'Asli (Salinan)')->firstOrFail();
        $this->assertSame('Desc asli', $copy->description);
        $this->assertFalse($copy->is_default);
        $this->assertSame('Hello', $copy->layout[0]['content']);
    }

    // ── Default uniqueness ───────────────────────────────────────────────────

    public function test_set_default_marks_only_one_template(): void
    {
        $t1 = PdfTemplate::query()->create(['name' => 'T1', 'layout' => [], 'is_default' => true]);
        $t2 = PdfTemplate::query()->create(['name' => 'T2', 'layout' => [], 'is_default' => false]);

        $this->actingAs($this->admin)
            ->post("/settings/pdf-templates/{$t2->id}/set-default")
            ->assertRedirect();

        $this->assertFalse($t1->fresh()->is_default);
        $this->assertTrue($t2->fresh()->is_default);
    }

    public function test_update_with_is_default_sets_default_and_clears_others(): void
    {
        $t1 = PdfTemplate::query()->create(['name' => 'T1', 'layout' => [], 'is_default' => true]);
        $t2 = PdfTemplate::query()->create(['name' => 'T2', 'layout' => [], 'is_default' => false]);

        $this->actingAs($this->admin)
            ->put("/settings/pdf-templates/{$t2->id}", [
                'name' => 'T2',
                'is_default' => true,
            ])
            ->assertRedirect();

        $this->assertFalse($t1->fresh()->is_default);
        $this->assertTrue($t2->fresh()->is_default);
    }

    // ── Editor ───────────────────────────────────────────────────────────────

    public function test_edit_returns_correct_layout(): void
    {
        $layout = [
            ['id' => 1, 'type' => 'text', 'x' => 10, 'y' => 20, 'content' => 'Halo', 'fontSize' => 14, 'bold' => false, 'color' => '#000000'],
        ];

        $template = PdfTemplate::query()->create([
            'name' => 'Editor Test',
            'layout' => $layout,
            'is_default' => false,
        ]);

        $response = $this->actingAs($this->admin)
            ->get("/settings/pdf-templates/{$template->id}/edit")
            ->assertOk();

        $response->assertInertia(fn ($page) => $page
            ->component('settings/pdf-templates/edit')
            ->has('template')
            ->where('template.id', $template->id)
            ->where('template.name', 'Editor Test')
        );
    }

    public function test_save_persists_layout_to_correct_template(): void
    {
        $t1 = PdfTemplate::query()->create(['name' => 'T1', 'layout' => [], 'is_default' => false]);
        $t2 = PdfTemplate::query()->create(['name' => 'T2', 'layout' => [], 'is_default' => false]);

        $this->actingAs($this->admin)
            ->post("/settings/pdf-templates/{$t2->id}/save", [
                'layout' => [
                    ['id' => 1, 'type' => 'text', 'x' => 0, 'y' => 0, 'content' => 'Milik T2'],
                ],
            ])
            ->assertRedirect();

        // Only T2's layout changed; T1 stays empty
        $this->assertEmpty($t1->fresh()->layout);
        $this->assertSame('Milik T2', $t2->fresh()->layout[0]['content']);
    }

    public function test_save_legacy_flat_layout_is_accepted(): void
    {
        // ponytail: legacy flat-array layouts are accepted without deep validation (backward-compat).
        $template = PdfTemplate::query()->create(['name' => 'T', 'layout' => [], 'is_default' => false]);

        $this->actingAs($this->admin)
            ->post("/settings/pdf-templates/{$template->id}/save", [
                'layout' => [['id' => 1, 'type' => 'text', 'x' => 0, 'y' => 0, 'content' => 'Hello']],
            ])
            ->assertRedirect();

        $this->assertSame('Hello', $template->fresh()->layout[0]['content']);
    }

    // ── Banded layout (B1) ───────────────────────────────────────────────────

    public function test_save_accepts_banded_layout_and_round_trips(): void
    {
        $template = PdfTemplate::query()->create(['name' => 'Banded', 'layout' => [], 'is_default' => false]);

        $bandedLayout = [
            'paper' => ['margins' => ['top' => 40, 'right' => 40, 'bottom' => 40, 'left' => 40]],
            'bands' => [
                'header' => [
                    'height' => 180,
                    'repeat' => false,
                    'elements' => [
                        ['id' => 1, 'type' => 'text', 'x' => 60, 'y' => 40, 'content' => 'Invoice {{invoice.number}}', 'fontSize' => 20, 'bold' => true, 'color' => '#0f172a'],
                    ],
                ],
                'content' => [
                    'table' => [
                        'id' => 2, 'type' => 'table', 'x' => 0, 'y' => 0, 'width' => 714,
                        'columns' => [['key' => 'description', 'label' => 'Deskripsi', 'width' => 290, 'align' => 'left', 'format' => 'text']],
                        'showFooterSum' => false,
                    ],
                ],
                'footerFlow' => [
                    'height' => 120,
                    'elements' => [
                        ['id' => 3, 'type' => 'rect', 'x' => 0, 'y' => 0, 'width' => 714, 'height' => 1, 'borderWidth' => 1, 'borderColor' => '#cbd5e1', 'borderRadius' => 0],
                    ],
                ],
                'footerFixed' => [
                    'height' => 50,
                    'elements' => [],
                ],
            ],
        ];

        $this->actingAs($this->admin)
            ->post("/settings/pdf-templates/{$template->id}/save", ['layout' => $bandedLayout])
            ->assertRedirect();

        $saved = $template->fresh()->layout;

        $this->assertArrayHasKey('bands', $saved);
        $this->assertArrayHasKey('paper', $saved);
        $this->assertSame(40, $saved['paper']['margins']['top']);
        $this->assertSame(180, $saved['bands']['header']['height']);
        $this->assertFalse($saved['bands']['header']['repeat']);
        $this->assertSame('Invoice {{invoice.number}}', $saved['bands']['header']['elements'][0]['content']);
        $this->assertSame('description', $saved['bands']['content']['table']['columns'][0]['key']);
        $this->assertSame(120, $saved['bands']['footerFlow']['height']);
        $this->assertEmpty($saved['bands']['footerFixed']['elements']);
    }

    public function test_save_banded_layout_requires_all_four_bands(): void
    {
        $template = PdfTemplate::query()->create(['name' => 'T', 'layout' => [], 'is_default' => false]);

        // Missing footerFixed band → should fail validation
        $this->actingAs($this->admin)
            ->post("/settings/pdf-templates/{$template->id}/save", [
                'layout' => [
                    'bands' => ['header' => [], 'content' => [], 'footerFlow' => []],
                    'paper' => ['margins' => ['top' => 40, 'right' => 40, 'bottom' => 40, 'left' => 40]],
                ],
            ])
            ->assertSessionHasErrors('layout.bands.footerFixed');
    }

    // ── Margin persistence (B2) ──────────────────────────────────────────────

    public function test_save_persists_custom_per_side_margins(): void
    {
        $template = PdfTemplate::query()->create(['name' => 'Margins', 'layout' => [], 'is_default' => false]);

        $layout = [
            'paper' => ['margins' => ['top' => 50, 'right' => 30, 'bottom' => 50, 'left' => 30]],
            'bands' => [
                'header' => ['height' => 180, 'repeat' => false, 'elements' => []],
                'content' => ['table' => null],
                'footerFlow' => ['height' => 80, 'elements' => []],
                'footerFixed' => ['height' => 40, 'elements' => []],
            ],
        ];

        $this->actingAs($this->admin)
            ->post("/settings/pdf-templates/{$template->id}/save", ['layout' => $layout])
            ->assertRedirect();

        $saved = $template->fresh()->layout;

        // Must round-trip the custom values — NOT overwritten by hardcoded 40s
        $this->assertSame(50, $saved['paper']['margins']['top']);
        $this->assertSame(30, $saved['paper']['margins']['right']);
        $this->assertSame(50, $saved['paper']['margins']['bottom']);
        $this->assertSame(30, $saved['paper']['margins']['left']);
    }

    public function test_save_banded_layout_rejects_negative_margin(): void
    {
        $template = PdfTemplate::query()->create(['name' => 'T', 'layout' => [], 'is_default' => false]);

        $layout = [
            'paper' => ['margins' => ['top' => -5, 'right' => 40, 'bottom' => 40, 'left' => 40]],
            'bands' => [
                'header' => ['height' => 180, 'repeat' => false, 'elements' => []],
                'content' => ['table' => null],
                'footerFlow' => ['height' => 80, 'elements' => []],
                'footerFixed' => ['height' => 40, 'elements' => []],
            ],
        ];

        $this->actingAs($this->admin)
            ->post("/settings/pdf-templates/{$template->id}/save", ['layout' => $layout])
            ->assertSessionHasErrors('layout.paper.margins.top');
    }

    public function test_save_banded_layout_rejects_missing_margin_key(): void
    {
        $template = PdfTemplate::query()->create(['name' => 'T', 'layout' => [], 'is_default' => false]);

        // 'left' is missing from margins
        $layout = [
            'paper' => ['margins' => ['top' => 40, 'right' => 40, 'bottom' => 40]],
            'bands' => [
                'header' => ['height' => 180, 'repeat' => false, 'elements' => []],
                'content' => ['table' => null],
                'footerFlow' => ['height' => 80, 'elements' => []],
                'footerFixed' => ['height' => 40, 'elements' => []],
            ],
        ];

        $this->actingAs($this->admin)
            ->post("/settings/pdf-templates/{$template->id}/save", ['layout' => $layout])
            ->assertSessionHasErrors('layout.paper.margins.left');
    }

    public function test_save_legacy_flat_layout_backward_compat(): void
    {
        // Old flat-array layout from pre-B1 templates must save without errors.
        $template = PdfTemplate::query()->create(['name' => 'Legacy', 'layout' => [], 'is_default' => false]);

        $legacyLayout = [
            ['id' => 1, 'type' => 'text', 'x' => 10, 'y' => 20, 'content' => 'Lama', 'fontSize' => 14, 'bold' => false, 'color' => '#000'],
            ['id' => 2, 'type' => 'rect', 'x' => 0, 'y' => 0, 'width' => 100, 'height' => 10, 'borderWidth' => 1, 'borderColor' => '#000', 'borderRadius' => 0],
        ];

        $this->actingAs($this->admin)
            ->post("/settings/pdf-templates/{$template->id}/save", ['layout' => $legacyLayout])
            ->assertRedirect();

        $saved = $template->fresh()->layout;
        $this->assertIsArray($saved);
        $this->assertCount(2, $saved);
        $this->assertSame('Lama', $saved[0]['content']);
    }

    // ── PDF render ───────────────────────────────────────────────────────────

    public function test_pdf_renders_with_resolved_tokens(): void
    {
        $template = PdfTemplate::query()->create([
            'name' => 'PDF Test',
            'layout' => [
                ['id' => 1, 'type' => 'text', 'x' => 10, 'y' => 20, 'content' => 'No: {{invoice.number}}', 'fontSize' => 14, 'bold' => false, 'color' => '#000000'],
            ],
            'is_default' => false,
        ]);

        $response = $this->actingAs($this->admin)
            ->get("/settings/pdf-templates/{$template->id}/pdf")
            ->assertOk();

        $this->assertStringContainsString('application/pdf', (string) $response->headers->get('content-type'));
    }

    // ── Backward-compat: old sandbox routes still work ───────────────────────

    public function test_old_sandbox_get_redirects_to_new_module(): void
    {
        $this->actingAs($this->admin)
            ->get('/template-builder-test')
            ->assertRedirect('/c/test-company/settings/pdf-templates');
    }

    public function test_old_sandbox_save_still_works(): void
    {
        $this->actingAs($this->admin)
            ->post('/template-builder-test', [
                'layout' => [
                    ['id' => 1, 'type' => 'text', 'x' => 0, 'y' => 0, 'content' => 'Sandbox'],
                ],
            ])
            ->assertRedirect();
    }
}
