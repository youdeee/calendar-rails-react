<?php

namespace Tests\Feature;

use Tests\TestCase;

class RateLimitTest extends TestCase
{
    public function test_throttles_login_after_ten_requests_per_minute(): void
    {
        $this->stubGoogle(invalid: true);
        for ($i = 0; $i < 10; $i++) {
            $this->withHeaders(['X-Forwarded-For' => '10.0.0.1'])
                ->postJson('/api/auth/login', ['id_token' => 'x'])
                ->assertUnauthorized();
        }
        $this->withHeaders(['X-Forwarded-For' => '10.0.0.1'])
            ->postJson('/api/auth/login', ['id_token' => 'x'])
            ->assertStatus(429)
            ->assertJsonPath('error.message', 'Too Many Requests');
    }

    public function test_throttles_any_endpoint_after_300_requests_per_five_minutes(): void
    {
        for ($i = 0; $i < 300; $i++) {
            $this->withHeaders(['X-Forwarded-For' => '10.0.0.2'])
                ->get('/up')
                ->assertOk();
        }
        $this->withHeaders(['X-Forwarded-For' => '10.0.0.2'])
            ->get('/up')
            ->assertStatus(429);
    }
}
