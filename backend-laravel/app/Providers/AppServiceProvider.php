<?php

namespace App\Providers;

use App\Auth\GoogleIdTokenVerifier;
use App\Auth\GoogleTokenVerifier;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(GoogleTokenVerifier::class, GoogleIdTokenVerifier::class);
    }

    public function boot(): void
    {
        //
    }
}
