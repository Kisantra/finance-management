<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class ClientControllerTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected User $viewer;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $permissions = ['view clients', 'create clients', 'edit clients', 'delete clients'];
        foreach ($permissions as $perm) {
            Permission::firstOrCreate(['name' => $perm]);
        }

        $adminRole = Role::firstOrCreate(['name' => 'admin']);
        $adminRole->syncPermissions($permissions);

        $viewerRole = Role::firstOrCreate(['name' => 'viewer']);
        $viewerRole->syncPermissions(['view clients']);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');

        $this->viewer = User::factory()->create();
        $this->viewer->assignRole('viewer');
    }

    public function test_index_requires_authentication(): void
    {
        $this->get('/clients')->assertRedirect('/login');
    }

    public function test_index_requires_view_clients_permission(): void
    {
        $noPermUser = User::factory()->create();
        $this->actingAs($noPermUser)->get('/clients')->assertForbidden();
    }

    public function test_index_renders_for_authorized_user(): void
    {
        $this->actingAs($this->admin)->get('/clients')->assertOk();
    }

    public function test_store_creates_client(): void
    {
        $this->actingAs($this->admin)->post('/clients', [
            'name' => 'Budi Santoso',
            'type' => 'individual',
            'status' => 'Active',
        ]);

        $this->assertDatabaseHas('clients', ['name' => 'Budi Santoso', 'type' => 'individual']);
    }

    public function test_store_requires_create_clients_permission(): void
    {
        $this->actingAs($this->viewer)->post('/clients', [
            'name' => 'Test',
            'type' => 'individual',
            'status' => 'Active',
        ])->assertForbidden();
    }

    public function test_store_validates_required_fields(): void
    {
        $response = $this->actingAs($this->admin)->post('/clients', []);

        $response->assertSessionHasErrors(['name', 'type', 'status']);
    }

    public function test_store_validates_type_enum(): void
    {
        $response = $this->actingAs($this->admin)->post('/clients', [
            'name' => 'Test',
            'type' => 'invalid',
            'status' => 'Active',
        ]);

        $response->assertSessionHasErrors(['type']);
    }

    public function test_update_modifies_client(): void
    {
        $client = Client::factory()->create(['name' => 'Lama', 'status' => 'Active']);

        $this->actingAs($this->admin)->put("/clients/{$client->id}", [
            'name' => 'Baru',
            'type' => $client->type,
            'status' => 'Inactive',
        ]);

        $this->assertDatabaseHas('clients', ['id' => $client->id, 'name' => 'Baru', 'status' => 'Inactive']);
    }

    public function test_update_requires_edit_clients_permission(): void
    {
        $client = Client::factory()->create();

        $this->actingAs($this->viewer)->put("/clients/{$client->id}", [
            'name' => 'X',
            'type' => $client->type,
            'status' => $client->status,
        ])->assertForbidden();
    }

    public function test_destroy_deletes_client(): void
    {
        $client = Client::factory()->create();

        $this->actingAs($this->admin)->delete("/clients/{$client->id}");

        $this->assertDatabaseMissing('clients', ['id' => $client->id]);
    }

    public function test_destroy_requires_delete_clients_permission(): void
    {
        $client = Client::factory()->create();

        $this->actingAs($this->viewer)->delete("/clients/{$client->id}")->assertForbidden();
        $this->assertDatabaseHas('clients', ['id' => $client->id]);
    }

    public function test_alias_disimpan_huruf_besar_dan_daftar_menampilkan_kode_nomor_invoice(): void
    {
        $this->actingAs($this->admin)->post('/clients', [
            'name' => 'PT Sinar Mas Agro',
            'alias' => ' smag1 ',
            'type' => 'company',
            'status' => 'Active',
        ])->assertSessionHasNoErrors();

        $this->assertDatabaseHas('clients', ['name' => 'PT Sinar Mas Agro', 'alias' => 'SMAG1']);
        Client::factory()->create(['name' => 'PT Bumi Raya Sentosa', 'type' => 'individual', 'alias' => null]);

        $this->actingAs($this->admin)
            ->get('/clients')
            ->assertInertia(fn (Assert $page) => $page
                ->where('clients.data.0.name', 'PT Bumi Raya Sentosa')
                ->where('clients.data.0.alias', null)
                ->where('clients.data.0.invoice_code', 'BRS')
                ->where('clients.data.1.alias', 'SMAG1')
                ->where('clients.data.1.invoice_code', 'SMAG1')
            );
    }

    public function test_alias_ditolak_bila_berspasi_bertanda_baca_atau_lebih_dari_10_karakter(): void
    {
        foreach (['SM-A', 'S M A', 'ABCDEFGHIJK'] as $alias) {
            $this->actingAs($this->admin)->post('/clients', [
                'name' => 'Klien Uji',
                'alias' => $alias,
                'type' => 'individual',
                'status' => 'Active',
            ])->assertSessionHasErrors('alias');
        }

        $this->assertDatabaseMissing('clients', ['name' => 'Klien Uji']);
    }
}
