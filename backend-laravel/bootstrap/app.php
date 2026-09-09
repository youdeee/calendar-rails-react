<?php

use App\Calendar\ReminderDispatcher;
use App\Exceptions\InvalidGoogleTokenException;
use App\Http\Middleware\ApiCors;
use App\Http\Middleware\ApiRateLimit;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\HandleCors;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->prepend([ApiRateLimit::class, ApiCors::class]);
        $middleware->trustProxies(at: '*');
        $middleware->remove(HandleCors::class);
        $middleware->encryptCookies(['refresh_token']);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->is('api/*') && ! $request->is('up')) {
                return null;
            }
            if ($e instanceof InvalidGoogleTokenException) {
                return response()->json(['error' => ['message' => $e->getMessage()]], 401);
            }
            if ($e instanceof ModelNotFoundException) {
                return response()->json(['error' => ['message' => 'Not Found']], 404);
            }
            if ($e instanceof HttpExceptionInterface) {
                $status = $e->getStatusCode();
                $message = $e->getMessage();
                if ($status === 429) {
                    $message = 'Too Many Requests';
                }
                if ($status === 401 && $message === '') {
                    $message = 'Unauthorized';
                }
                if ($status === 404 && $message === '') {
                    $message = 'Not Found';
                }
                if ($status >= 500) {
                    $message = 'Internal Server Error';
                }

                return response()->json(['error' => ['message' => $message ?: 'Internal Server Error']], $status);
            }

            return response()->json(['error' => ['message' => 'Internal Server Error']], 500);
        });
    })
    ->withSchedule(function (Schedule $schedule): void {
        $schedule->call(fn () => app(ReminderDispatcher::class)->dispatch(null, now('UTC')))->everyMinute();
    })
    ->create();
