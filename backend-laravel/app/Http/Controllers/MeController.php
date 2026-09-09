<?php

namespace App\Http\Controllers;

use DateTimeZone;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json(AuthController::userJson($request->user()));
    }

    public function update(Request $request): JsonResponse
    {
        $timeZone = $request->input('time_zone');
        if (! is_string($timeZone) || $timeZone === '') {
            abort(400, 'param is missing or the value is empty: time_zone');
        }
        try {
            new DateTimeZone($timeZone);
        } catch (Exception) {
            abort(422, 'Time zone is not a valid time zone');
        }
        $user = $request->user();
        $user->time_zone = $timeZone;
        $user->save();

        return response()->json(AuthController::userJson($user));
    }
}
