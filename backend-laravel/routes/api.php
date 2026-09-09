<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\EventsController;
use App\Http\Controllers\MeController;
use App\Http\Middleware\AuthenticateJwt;
use Illuminate\Support\Facades\Route;

Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/refresh', [AuthController::class, 'refresh']);
Route::delete('/auth/logout', [AuthController::class, 'logout']);

Route::middleware(AuthenticateJwt::class)->group(function () {
    Route::get('/me', [MeController::class, 'show']);
    Route::get('/events', [EventsController::class, 'index']);
    Route::post('/events', [EventsController::class, 'store']);
    Route::patch('/events/{id}', [EventsController::class, 'update']);
    Route::delete('/events/{id}', [EventsController::class, 'destroy']);
});
