<?php

namespace App\Auth;

use App\Exceptions\InvalidGoogleTokenException;
use Google\Auth\AccessToken;

class GoogleIdTokenVerifier implements GoogleTokenVerifier
{
    public function verify(string $idToken): array
    {
        $audience = config('calendar.google_client_id') ?: null;
        $payload = (new AccessToken)->verify($idToken, array_filter([
            'audience' => $audience,
        ]));
        if ($payload === false) {
            throw new InvalidGoogleTokenException;
        }

        $verified = $payload['email_verified'] ?? false;
        if (is_string($verified)) {
            $verified = strcasecmp($verified, 'true') === 0;
        }

        return [
            'sub' => (string) ($payload['sub'] ?? ''),
            'email' => (string) ($payload['email'] ?? ''),
            'email_verified' => (bool) $verified,
            'name' => isset($payload['name']) ? (string) $payload['name'] : null,
            'picture' => isset($payload['picture']) ? (string) $payload['picture'] : null,
        ];
    }
}
