<?php

namespace Tests\Feature;

use Tests\TestCase;

class MeTest extends TestCase
{
    public function test_returns_current_user(): void
    {
        $user = $this->persistUser('me@example.com', 'g-me', 'Taro');
        $this->withHeaders($this->bearer($user))
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('email', 'me@example.com')
            ->assertJsonPath('name', 'Taro')
            ->assertJsonPath('avatar_url', null);
    }

    public function test_requires_authentication(): void
    {
        $this->getJson('/api/me')->assertUnauthorized();
    }
}
