<?php

return [
    'jwt_secret' => env('JWT_SECRET', 'dev-only-change-me-use-32bytes!!'),
    'google_client_id' => env('GOOGLE_CLIENT_ID', ''),
    'frontend_origin' => env('FRONTEND_ORIGIN', 'http://localhost:5173'),
    'cookie_secure' => env('COOKIE_SECURE', false),
    'cookie_same_site' => env('COOKIE_SAME_SITE', 'strict'),
];
