<?php

namespace App\Http\Controllers;

use App\Calendar\RecurrenceExpander;
use App\Models\Event;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use JsonException;

class EventsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $from = $this->parseDate($request->query('from'));
        $to = $this->parseDate($request->query('to'));
        if ($to->lt($from)) {
            abort(400, 'to must be after from');
        }
        if ($to->gt($from->copy()->utc()->addMonths(3))) {
            abort(400, 'range too large');
        }

        $toBoundary = RecurrenceExpander::endOfUtcDay($to);
        $candidates = $request->user()->events()
            ->where(function ($query) use ($from, $toBoundary) {
                $query->where(function ($q) use ($from, $toBoundary) {
                    $q->whereNull('recurrence_rule')
                        ->where('start_at', '<=', $toBoundary)
                        ->where('end_at', '>=', $from);
                })->orWhere(function ($q) use ($toBoundary) {
                    $q->whereNotNull('recurrence_rule')
                        ->where('start_at', '<=', $toBoundary);
                });
            })
            ->get();

        $occurrences = [];
        foreach ($candidates as $event) {
            $rule = $this->decodeRule($event);
            $duration = $event->end_at->getTimestamp() - $event->start_at->getTimestamp();
            foreach (RecurrenceExpander::occurrencesBetween($event->start_at, $event->end_at, $from, $to, $rule) as $start) {
                $occurrences[] = $this->serializeEvent($event, $rule, $start, $start->copy()->addSeconds($duration));
            }
        }

        return response()->json($occurrences);
    }

    public function store(Request $request): JsonResponse
    {
        $input = $this->eventPayload($request);
        $event = new Event(['user_id' => $request->user()->id, 'all_day' => false]);
        $this->assign($event, $input, true);
        $this->validateEvent($event);
        $event->save();

        return response()->json($this->serializeEvent($event, $this->decodeRule($event), $event->start_at, $event->end_at), 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $event = $request->user()->events()->whereKey($id)->first();
        if ($event === null) {
            abort(404, 'Not Found');
        }
        $input = $this->eventPayload($request);
        $this->assign($event, $input, false);
        $this->validateEvent($event);
        $event->save();

        return response()->json($this->serializeEvent($event, $this->decodeRule($event), $event->start_at, $event->end_at));
    }

    public function destroy(Request $request, int $id): Response
    {
        $event = $request->user()->events()->whereKey($id)->first();
        if ($event === null) {
            abort(404, 'Not Found');
        }
        $event->delete();

        return response()->noContent();
    }

    private function eventPayload(Request $request): array
    {
        if (! $request->exists('event') || $request->input('event') === null) {
            abort(400, 'param is missing or the value is empty: event');
        }
        $event = $request->input('event');
        if (! is_array($event)) {
            abort(400, 'invalid request');
        }
        if (array_key_exists('recurrence', $event) && $event['recurrence'] !== null && ! is_array($event['recurrence'])) {
            abort(400, 'recurrence must be an object');
        }

        return $event;
    }

    private function assign(Event $event, array $input, bool $creating): void
    {
        if ($creating || array_key_exists('title', $input)) {
            $event->title = $input['title'] ?? null;
        }
        if (array_key_exists('description', $input)) {
            $event->description = $input['description'];
        }
        if ($creating || array_key_exists('start_at', $input)) {
            $event->start_at = isset($input['start_at']) ? $this->parseInstant($input['start_at']) : null;
        }
        if ($creating || array_key_exists('end_at', $input)) {
            $event->end_at = isset($input['end_at']) ? $this->parseInstant($input['end_at']) : null;
        }
        if (array_key_exists('all_day', $input)) {
            $event->all_day = (bool) $input['all_day'];
        }
        if ($creating || array_key_exists('recurrence', $input)) {
            $this->applyRecurrence($event, $input['recurrence'] ?? null);
        }
    }

    private function applyRecurrence(Event $event, mixed $params): void
    {
        if ($params === null) {
            $event->recurrence_rule = null;

            return;
        }
        $interval = $this->flexInt($params['interval'] ?? null);
        $until = isset($params['until']) && $params['until'] !== '' ? (string) $params['until'] : null;
        $rule = array_filter([
            'frequency' => $params['frequency'] ?? null,
            'interval' => $interval,
            'until' => $until,
        ], fn ($v) => $v !== null);
        $this->validateRecurrence($rule);
        $event->recurrence_rule = json_encode($rule, JSON_THROW_ON_ERROR);
    }

    private function validateEvent(Event $event): void
    {
        $errors = [];
        if (! is_string($event->title) || trim($event->title) === '') {
            $errors[] = "Title can't be blank";
        } elseif (strlen($event->title) > 200) {
            $errors[] = 'Title is too long (maximum is 200 characters)';
        }
        if (is_string($event->description) && strlen($event->description) > 5000) {
            $errors[] = 'Description is too long (maximum is 5000 characters)';
        }
        if ($event->start_at === null) {
            $errors[] = "Start at can't be blank";
        }
        if ($event->end_at === null) {
            $errors[] = "End at can't be blank";
        }
        if ($event->start_at && $event->end_at && ! $event->end_at->gt($event->start_at)) {
            $errors[] = 'End at must be after start_at';
        }
        if ($event->recurring()) {
            $this->validateRecurrence($this->decodeRule($event) ?? []);
        }
        if ($errors !== []) {
            abort(422, implode(', ', $errors));
        }
    }

    private function validateRecurrence(array $rule): void
    {
        $errors = [];
        $frequency = $rule['frequency'] ?? null;
        if (! in_array($frequency, ['daily', 'weekly', 'monthly'], true)) {
            $errors[] = 'Recurrence rule frequency must be one of daily, weekly, monthly';
        }
        if ((int) ($rule['interval'] ?? 0) < 1) {
            $errors[] = 'Recurrence rule interval must be a positive integer';
        }
        if (! empty($rule['until'])) {
            try {
                Carbon::createFromFormat('Y-m-d', (string) $rule['until']);
            } catch (\Throwable) {
                $errors[] = 'Recurrence rule until must be a valid date';
            }
        }
        if ($errors !== []) {
            abort(422, implode(', ', $errors));
        }
    }

    private function decodeRule(Event $event): ?array
    {
        if (! $event->recurring()) {
            return null;
        }
        try {
            $decoded = json_decode($event->recurrence_rule, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            abort(422, 'recurrence_rule is not valid JSON');
        }
        if (! is_array($decoded)) {
            abort(422, 'recurrence_rule is not valid JSON');
        }

        return $decoded;
    }

    private function serializeEvent(Event $event, ?array $rule, Carbon $start, Carbon $end): array
    {
        return [
            'id' => $event->id,
            'title' => $event->title,
            'description' => $event->description,
            'start_at' => $start->copy()->utc()->toIso8601String(),
            'end_at' => $end->copy()->utc()->toIso8601String(),
            'all_day' => (bool) $event->all_day,
            'recurring' => $rule !== null,
            'recurrence' => $rule,
        ];
    }

    private function parseDate(mixed $value): Carbon
    {
        if (! is_string($value) || trim($value) === '') {
            abort(400, 'invalid date: '.$value);
        }
        try {
            if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
                return Carbon::createFromFormat('Y-m-d', $value, 'UTC')->startOfDay();
            }

            return Carbon::parse($value)->utc();
        } catch (\Throwable) {
            abort(400, 'invalid date: '.$value);
        }
    }

    private function parseInstant(mixed $value): ?Carbon
    {
        if (! is_string($value) || $value === '') {
            abort(400, 'invalid request');
        }
        try {
            return Carbon::parse($value)->utc();
        } catch (\Throwable) {
            abort(400, 'invalid request');
        }
    }

    private function flexInt(mixed $value): int
    {
        if ($value === null || $value === '') {
            return 0;
        }
        if (is_int($value)) {
            return $value;
        }
        if (is_float($value) || is_numeric($value)) {
            return (int) $value;
        }

        return 0;
    }
}
