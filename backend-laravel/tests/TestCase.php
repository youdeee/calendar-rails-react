<?php

namespace Tests;

use App\Auth\GoogleTokenVerifier;
use App\Auth\JsonWebToken;
use App\Exceptions\InvalidGoogleTokenException;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Cache;
use Mockery;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
    }

    protected function stubGoogle(array $overrides = [], bool $invalid = false): void
    {
        $mock = Mockery::mock(GoogleTokenVerifier::class);
        if ($invalid) {
            $mock->shouldReceive('verify')->andThrow(new InvalidGoogleTokenException);
        } else {
            $mock->shouldReceive('verify')->andReturn(array_merge([
                'sub' => 'google-1',
                'email' => 'a@example.com',
                'email_verified' => true,
                'name' => 'Taro',
                'picture' => 'https://example.com/a.png',
            ], $overrides));
        }
        $this->app->instance(GoogleTokenVerifier::class, $mock);
    }

    protected function persistUser(?string $email = null, ?string $googleUid = null, string $name = 'Taro'): User
    {
        $suffix = (string) str_replace('.', '', uniqid('', true));

        return User::query()->create([
            'email' => $email ?? $suffix.'@example.com',
            'google_uid' => $googleUid ?? 'g-'.$suffix,
            'name' => $name,
        ]);
    }

    protected function bearer(User $user): array
    {
        return ['Authorization' => 'Bearer '.JsonWebToken::encode($user->id)];
    }

    protected function withRefreshCookie(string $raw): static
    {
        return $this->withCredentials()->withUnencryptedCookie('refresh_token', $raw);
    }

    protected function loginRefreshCookie(): string
    {
        $this->stubGoogle();
        $response = $this->postJson('/api/auth/login', ['id_token' => 'valid']);
        $cookie = $response->getCookie('refresh_token', false);

        return $cookie?->getValue() ?? '';
    }
}
