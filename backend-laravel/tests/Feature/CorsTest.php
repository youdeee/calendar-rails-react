<?php

namespace Tests\Feature;

use Tests\TestCase;

class CorsTest extends TestCase
{
    public function test_reflects_configured_origin(): void
    {
        $this->withHeaders([
            'Origin' => 'http://localhost:5173',
            'Authorization' => 'Bearer bogus',
        ])->getJson('/api/me')
            ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
    }

    public function test_rejects_unknown_origin(): void
    {
        $this->withHeaders([
            'Origin' => 'http://evil.example.com',
            'Authorization' => 'Bearer bogus',
        ])->getJson('/api/me')
            ->assertHeaderMissing('Access-Control-Allow-Origin');
    }

    public function test_allows_credentials_on_auth_routes(): void
    {
        $this->stubGoogle(invalid: true);
        $this->withHeaders(['Origin' => 'http://localhost:5173'])
            ->postJson('/api/auth/login', ['id_token' => 'x'])
            ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5173')
            ->assertHeader('Access-Control-Allow-Credentials', 'true');
    }

    public function test_does_not_allow_credentials_on_non_auth_api(): void
    {
        $this->withHeaders([
            'Origin' => 'http://localhost:5173',
            'Authorization' => 'Bearer bogus',
        ])->getJson('/api/me')
            ->assertUnauthorized()
            ->assertHeaderMissing('Access-Control-Allow-Credentials');
    }
}
