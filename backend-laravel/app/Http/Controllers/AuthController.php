<?php

namespace App\Http\Controllers;

use App\Auth\GoogleTokenVerifier;
use App\Auth\JsonWebToken;
use App\Exceptions\InvalidGoogleTokenException;
use App\Models\RefreshToken;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\Cookie;

class AuthController extends Controller
{
    public const REFRESH_COOKIE = 'refresh_token';

    public const REFRESH_PATH = '/api/auth';

    public function login(Request $request, GoogleTokenVerifier $google): JsonResponse
    {
        $idToken = $request->input('id_token');
        if (! is_string($idToken) || $idToken === '') {
            abort(400, 'param is missing or the value is empty: id_token');
        }

        try {
            $payload = $google->verify($idToken);
        } catch (InvalidGoogleTokenException $e) {
            abort(401, $e->getMessage());
        }

        if (! ($payload['email_verified'] ?? false)) {
            abort(401, 'Invalid Google token');
        }

        $user = $this->upsertUser($payload);

        return $this->issueSession($user, 201);
    }

    public function refresh(Request $request): JsonResponse
    {
        $record = RefreshToken::authenticate($request->cookie(self::REFRESH_COOKIE));
        if ($record === null) {
            abort(401, 'Unauthorized');
        }
        if (! RefreshToken::claimAtomically($record->id)) {
            abort(401, 'Unauthorized');
        }

        return $this->issueSession($record->user, 200);
    }

    public function logout(Request $request): Response
    {
        $record = RefreshToken::authenticate($request->cookie(self::REFRESH_COOKIE));
        $record?->revoke();

        return response()->noContent()->withCookie($this->refreshCookie('', -1));
    }

    /**
     * @param  array{sub: string, email: string, email_verified: bool, name: ?string, picture: ?string}  $payload
     */
    private function upsertUser(array $payload): User
    {
        $user = User::query()->firstOrNew(['email' => $payload['email']]);
        $user->google_uid = $payload['sub'];
        $user->name = filled($payload['name']) ? $payload['name'] : $payload['email'];
        $user->avatar_url = $payload['picture'];
        $user->save();

        return $user;
    }

    private function issueSession(User $user, int $status): JsonResponse
    {
        $raw = RefreshToken::issue($user);

        return response()
            ->json([
                'access_token' => JsonWebToken::encode($user->id),
                'user' => $this->userJson($user),
            ], $status)
            ->withCookie($this->refreshCookie($raw, 60 * 24 * RefreshToken::TTL_DAYS));
    }

    public static function userJson(User $user): array
    {
        return [
            'id' => $user->id,
            'email' => $user->email,
            'name' => $user->name,
            'avatar_url' => $user->avatar_url,
            'time_zone' => $user->time_zone ?: 'Asia/Tokyo',
        ];
    }

    private function refreshCookie(string $value, int $minutes): Cookie
    {
        $sameSite = strtolower((string) config('calendar.cookie_same_site', 'strict'));

        return cookie(
            self::REFRESH_COOKIE,
            $value,
            $minutes,
            self::REFRESH_PATH,
            null,
            (bool) config('calendar.cookie_secure'),
            true,
            false,
            $sameSite === 'none' ? 'none' : ($sameSite === 'lax' ? 'lax' : 'strict'),
        );
    }
}
