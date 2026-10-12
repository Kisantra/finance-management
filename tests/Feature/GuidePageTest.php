<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class GuidePageTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_is_redirected_to_login(): void
    {
        $this->get('/panduan')->assertRedirect('/login');
    }

    public function test_guide_index_renders_without_slug(): void
    {
        $this->actingAs(User::factory()->create())
            ->get('/panduan')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('guide/index', false)->where('slug', null));
    }

    public function test_guide_module_page_passes_slug(): void
    {
        $this->actingAs(User::factory()->create())
            ->get('/panduan/reimbursements')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('guide/index', false)->where('slug', 'reimbursements'));
    }

    public function test_invalid_slug_is_not_found(): void
    {
        $this->actingAs(User::factory()->create())
            ->get('/panduan/Bad_Slug')
            ->assertNotFound();
    }
}
