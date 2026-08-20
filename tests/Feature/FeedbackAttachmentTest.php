<?php

namespace Tests\Feature;

use App\Models\Feedback;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Regresi BUG-FB-01: berkas lampiran disimpan ke disk `public` tetapi hook
 * penghapusnya membaca disk default, sehingga berkas tidak pernah benar-benar
 * dibuang — kegagalan yang tidak memunculkan gejala apa pun di jalur normal.
 */
class FeedbackAttachmentTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['view feedbacks', 'create feedbacks', 'respond feedbacks'] as $name) {
            Permission::findOrCreate($name, 'web');
        }

        // notifyAdmins() memanggil User::role(['admin','finance manager']);
        // tanpa kedua role itu Spatie melempar RoleDoesNotExist dan store 500.
        foreach (['admin', 'finance manager'] as $role) {
            Role::findOrCreate($role, 'web');
        }

        setPermissionsTeamId(self::TEST_COMPANY);
        $this->user = User::factory()->create();
        $this->user->companies()->syncWithoutDetaching([self::TEST_COMPANY]);
        $this->user->givePermissionTo(Permission::all());
    }

    public function test_lampiran_feedback_terhapus_dari_disk(): void
    {
        Storage::fake('public');

        $this->actingAs($this->user)->post('/feedbacks', [
            'title' => 'Ada bug',
            'description' => 'Deskripsi yang cukup panjang untuk lolos validasi.',
            'type' => 'bug',
            'priority' => 'medium',
            'attachment' => UploadedFile::fake()->image('tangkapan.png'),
        ])->assertSessionHasNoErrors();

        $this->assertDatabaseCount('feedbacks', 1);

        $feedback = Feedback::firstOrFail();
        $this->assertNotNull($feedback->attachment_path);
        Storage::disk('public')->assertExists($feedback->attachment_path);

        $path = $feedback->attachment_path;
        $feedback->delete();

        Storage::disk('public')->assertMissing($path);
    }
}
