<?php

namespace Tests\Feature;

use Tests\TestCase;

class AuthTest extends TestCase
{
    public function test_login_creates_session(): void
    {
        $this->stubGoogle();
        $response = $this->postJson('/api/auth/login', ['id_token' => 'valid']);
        $response->assertCreated()
            ->assertJsonPath('user.email', 'a@example.com')
            ->assertCookie('refresh_token')
            ->assertCookieNotExpired('refresh_token');
        $this->assertNotEmpty($response->json('access_token'));
        $cookie = $response->getCookie('refresh_token', false);
        $this->assertTrue($cookie->isHttpOnly());
        $this->assertSame('/api/auth', $cookie->getPath());
    }

    public function test_login_rejects_invalid_google_token(): void
    {
        $this->stubGoogle(invalid: true);
        $this->postJson('/api/auth/login', ['id_token' => 'bad'])
            ->assertUnauthorized()
            ->assertJsonPath('error.message', 'Invalid Google token');
    }

    public function test_login_rejects_unverified_email(): void
    {
        $this->stubGoogle(['email_verified' => false]);
        $this->postJson('/api/auth/login', ['id_token' => 'valid'])->assertUnauthorized();
    }

    public function test_logout_revokes_refresh_token(): void
    {
        $raw = $this->loginRefreshCookie();
        $this->withRefreshCookie($raw)
            ->deleteJson('/api/auth/logout')
            ->assertNoContent();
        $this->withRefreshCookie($raw)
            ->postJson('/api/auth/refresh')
            ->assertUnauthorized();
    }

    public function test_logout_without_cookie_is_no_content(): void
    {
        $this->deleteJson('/api/auth/logout')->assertNoContent();
    }

    public function test_refresh_rotates_token(): void
    {
        $original = $this->loginRefreshCookie();
        $response = $this->withRefreshCookie($original)
            ->postJson('/api/auth/refresh');
        $response->assertOk();
        $rotated = $response->getCookie('refresh_token', false)?->getValue();
        $this->assertNotSame($original, $rotated);
        $this->withRefreshCookie($rotated)
            ->postJson('/api/auth/refresh')
            ->assertOk();
    }

    public function test_reused_refresh_token_revokes_family(): void
    {
        $original = $this->loginRefreshCookie();
        $rotated = $this->withRefreshCookie($original)
            ->postJson('/api/auth/refresh')
            ->getCookie('refresh_token', false)
            ?->getValue();
        $this->withRefreshCookie($original)
            ->postJson('/api/auth/refresh')
            ->assertUnauthorized();
        $this->withRefreshCookie($rotated)
            ->postJson('/api/auth/refresh')
            ->assertUnauthorized();
    }

    public function test_refresh_without_cookie_is_unauthorized(): void
    {
        $this->postJson('/api/auth/refresh')->assertUnauthorized();
    }
}
