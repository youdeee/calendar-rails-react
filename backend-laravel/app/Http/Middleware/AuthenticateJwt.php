<?php

namespace App\Http\Middleware;

use App\Auth\JsonWebToken;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateJwt
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();
        if ($token === null || $token === '') {
            abort(401, 'Unauthorized');
        }

        $user = User::query()->find(JsonWebToken::decode($token));
        if ($user === null) {
            abort(401, 'Unauthorized');
        }

        $request->setUserResolver(fn () => $user);

        return $next($request);
    }
}
