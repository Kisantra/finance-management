<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Regresi BUG-03 (QA 2026-08-19): user yang sudah login membuka route guest
 * (/login, /register, /forgot-password) mendapat HTTP 500 karena
 * RedirectIfAuthenticated bawaan Laravel memanggil route('dashboard') yang
 * kini ber-parameter {company}.
 */
class AuthenticatedGuestRedirectTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_visiting_login_is_redirected_not_500(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get('/login')
            ->assertRedirect(route('choose-company'));
    }

    public function test_guest_can_still_open_login_page(): void
    {
        $this->get('/login')->assertOk();
    }
}
