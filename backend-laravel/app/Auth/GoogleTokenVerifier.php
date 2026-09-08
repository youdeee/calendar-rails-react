<?php

namespace App\Auth;

interface GoogleTokenVerifier
{
    /**
     * @return array{sub: string, email: string, email_verified: bool, name: ?string, picture: ?string}
     */
    public function verify(string $idToken): array;
}
