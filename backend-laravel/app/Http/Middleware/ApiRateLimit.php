<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpFoundation\Response;

class ApiRateLimit
{
    public function handle(Request $request, Closure $next): Response
    {
        $ip = $request->ip() ?: 'unknown';
        if (! $this->allow('all:'.$ip, 300, 300)) {
            return $this->tooMany();
        }
        if ($request->isMethod('POST') && $request->is('api/auth/login') && ! $this->allow('login:'.$ip, 10, 60)) {
            return $this->tooMany();
        }
        if ($request->isMethod('POST') && $request->is('api/auth/refresh') && ! $this->allow('refresh:'.$ip, 30, 60)) {
            return $this->tooMany();
        }

        return $next($request);
    }

    private function allow(string $key, int $max, int $decaySeconds): bool
    {
        if (RateLimiter::tooManyAttempts($key, $max)) {
            return false;
        }
        RateLimiter::hit($key, $decaySeconds);

        return true;
    }

    private function tooMany(): Response
    {
        return response()->json(['error' => ['message' => 'Too Many Requests']], 429);
    }
}
