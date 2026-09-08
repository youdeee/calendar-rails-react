<?php

namespace App\Auth;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use UnexpectedValueException;

class JsonWebToken
{
    public static function encode(int $userId): string
    {
        return JWT::encode([
            'sub' => (string) $userId,
            'exp' => time() + 15 * 60,
        ], self::secret(), 'HS256');
    }

    public static function decode(string $token): int
    {
        try {
            $payload = JWT::decode($token, new Key(self::secret(), 'HS256'));
        } catch (UnexpectedValueException) {
            abort(401, 'Unauthorized');
        }

        $sub = $payload->sub ?? null;
        if (! is_numeric($sub)) {
            abort(401, 'Unauthorized');
        }

        return (int) $sub;
    }

    private static function secret(): string
    {
        $secret = (string) config('calendar.jwt_secret');
        if (strlen($secret) < 32) {
            throw new \RuntimeException('JWT_SECRET must be at least 32 bytes');
        }

        return $secret;
    }
}
