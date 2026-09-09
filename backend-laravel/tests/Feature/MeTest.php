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
            ->assertJsonPath('time_zone', 'Asia/Tokyo')
            ->assertJsonPath('avatar_url', null);
    }

    public function test_updates_time_zone(): void
    {
        $user = $this->persistUser('tz@example.com', 'g-tz', 'Taro');
        $this->withHeaders($this->bearer($user))
            ->patchJson('/api/me', ['time_zone' => 'America/New_York'])
            ->assertOk()
            ->assertJsonPath('time_zone', 'America/New_York');
    }

    public function test_rejects_unknown_time_zone(): void
    {
        $user = $this->persistUser('badtz@example.com', 'g-badtz', 'Taro');
        $this->withHeaders($this->bearer($user))
            ->patchJson('/api/me', ['time_zone' => 'Not/AZone'])
            ->assertUnprocessable();
    }

    public function test_requires_authentication(): void
    {
        $this->getJson('/api/me')->assertUnauthorized();
    }
}
