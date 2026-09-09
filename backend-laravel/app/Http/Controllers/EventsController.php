<?php

namespace App\Http\Controllers;

use App\Calendar\RecurrenceExpander;
use App\Calendar\ReminderDispatcher;
use App\Models\Event;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use JsonException;

class EventsController extends Controller
{
    private const REMINDER_MINUTES_MAX = 43_200;

    public function __construct(private ReminderDispatcher $reminders) {}

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
        $zone = $request->user()->time_zone ?: 'Asia/Tokyo';
        $zoneStartDate = $from->copy()->timezone($zone)->toDateString();
        $zoneEndDate = $toBoundary->copy()->timezone($zone)->toDateString();
        $candidates = $request->user()->events()
            ->where(function ($query) use ($from, $toBoundary, $zoneStartDate, $zoneEndDate) {
                $query->where(function ($q) use ($from, $toBoundary) {
                    $q->where('all_day', false)
                        ->whereNull('recurrence_rule')
                        ->where('start_at', '<=', $toBoundary)
                        ->where('end_at', '>=', $from);
                })->orWhere(function ($q) use ($toBoundary) {
                    $q->where('all_day', false)
                        ->whereNotNull('recurrence_rule')
                        ->where('start_at', '<=', $toBoundary);
                })->orWhere(function ($q) use ($zoneStartDate, $zoneEndDate) {
                    $q->where('all_day', true)
                        ->whereNull('recurrence_rule')
                        ->whereDate('start_on', '<=', $zoneEndDate)
                        ->whereDate('end_on', '>=', $zoneStartDate);
                })->orWhere(function ($q) use ($zoneEndDate) {
                    $q->where('all_day', true)
                        ->whereNotNull('recurrence_rule')
                        ->whereDate('start_on', '<=', $zoneEndDate);
                });
            })
            ->get();

        $occurrences = [];
        foreach ($candidates as $event) {
            $rule = $this->decodeRule($event);
            if ($event->all_day) {
                if ($event->start_on === null || $event->end_on === null) {
                    continue;
                }
                $durationDays = (int) $event->start_on->copy()->startOfDay()->diffInDays($event->end_on->copy()->startOfDay());
                foreach (RecurrenceExpander::allDayOccurrencesBetween($event->start_on, $event->end_on, $from, $to, $zone, $rule) as $startOn) {
                    $occurrences[] = $this->serializeAllDay($event, $rule, $startOn, $startOn->copy()->addDays($durationDays));
                }

                continue;
            }
            if ($event->start_at === null || $event->end_at === null) {
                continue;
            }
            $duration = $event->end_at->getTimestamp() - $event->start_at->getTimestamp();
            foreach (RecurrenceExpander::occurrencesBetween($event->start_at, $event->end_at, $from, $to, $rule) as $start) {
                $occurrences[] = $this->serializeTimed($event, $rule, $start, $start->copy()->addSeconds($duration));
            }
        }

        return response()->json($occurrences);
    }

    public function store(Request $request): JsonResponse
    {
        $input = $this->eventPayload($request);
        $event = new Event(['user_id' => $request->user()->id, 'all_day' => false]);
        $this->assign($event, $input, true);
        $this->applyScheduleKind($event);
        $this->validateEvent($event);
        $event->save();
        $this->reminders->dispatchAfterSave($event);

        return response()->json($this->serializeSaved($event), 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $event = $request->user()->events()->whereKey($id)->first();
        if ($event === null) {
            abort(404, 'Not Found');
        }
        $input = $this->eventPayload($request);
        $this->assign($event, $input, false);
        $this->applyScheduleKind($event);
        $this->validateEvent($event);
        $event->save();
        $this->reminders->dispatchAfterSave($event);

        return response()->json($this->serializeSaved($event));
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
            $event->start_at = array_key_exists('start_at', $input) ? $this->parseInstant($input['start_at']) : $event->start_at;
        }
        if ($creating || array_key_exists('end_at', $input)) {
            $event->end_at = array_key_exists('end_at', $input) ? $this->parseInstant($input['end_at']) : $event->end_at;
        }
        if (array_key_exists('start_on', $input)) {
            $event->start_on = $this->parseCivilDate($input['start_on']);
        }
        if (array_key_exists('end_on', $input)) {
            $event->end_on = $this->parseCivilDate($input['end_on']);
        }
        if (array_key_exists('all_day', $input)) {
            $event->all_day = (bool) $input['all_day'];
        }
        if (array_key_exists('reminder_minutes', $input)) {
            $event->reminder_minutes = $this->parseReminderMinutes($input['reminder_minutes']);
        }
        if ($creating || array_key_exists('recurrence', $input)) {
            $this->applyRecurrence($event, $input['recurrence'] ?? null);
        }
    }

    private function applyScheduleKind(Event $event): void
    {
        if ($event->all_day) {
            $event->start_at = null;
            $event->end_at = null;
        } else {
            $event->start_on = null;
            $event->end_on = null;
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
        if ($event->all_day) {
            if ($event->start_on === null) {
                $errors[] = "Start on can't be blank";
            }
            if ($event->end_on === null) {
                $errors[] = "End on can't be blank";
            }
            if ($event->start_on && $event->end_on && $event->end_on->lt($event->start_on)) {
                $errors[] = 'End on must be on or after start_on';
            }
        } else {
            if ($event->start_at === null) {
                $errors[] = "Start at can't be blank";
            }
            if ($event->end_at === null) {
                $errors[] = "End at can't be blank";
            }
            if ($event->start_at && $event->end_at && ! $event->end_at->gt($event->start_at)) {
                $errors[] = 'End at must be after start_at';
            }
        }
        if ($event->reminder_minutes !== null && ($event->reminder_minutes < 1 || $event->reminder_minutes > self::REMINDER_MINUTES_MAX)) {
            $errors[] = 'Reminder minutes is not a number';
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

    private function serializeSaved(Event $event): array
    {
        $rule = $this->decodeRule($event);
        if ($event->all_day) {
            return $this->serializeAllDay($event, $rule, $event->start_on, $event->end_on);
        }

        return $this->serializeTimed($event, $rule, $event->start_at, $event->end_at);
    }

    private function serializeTimed(Event $event, ?array $rule, Carbon $start, Carbon $end): array
    {
        return [
            'id' => $event->id,
            'title' => $event->title,
            'description' => $event->description,
            'start_at' => $start->copy()->utc()->toIso8601String(),
            'end_at' => $end->copy()->utc()->toIso8601String(),
            'start_on' => null,
            'end_on' => null,
            'all_day' => (bool) $event->all_day,
            'reminder_minutes' => $event->reminder_minutes,
            'recurring' => $rule !== null,
            'recurrence' => $rule,
        ];
    }

    private function serializeAllDay(Event $event, ?array $rule, Carbon $startOn, Carbon $endOn): array
    {
        return [
            'id' => $event->id,
            'title' => $event->title,
            'description' => $event->description,
            'start_at' => null,
            'end_at' => null,
            'start_on' => $startOn->toDateString(),
            'end_on' => $endOn->toDateString(),
            'all_day' => true,
            'reminder_minutes' => $event->reminder_minutes,
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

    private function parseCivilDate(mixed $value): Carbon
    {
        if (! is_string($value) || $value === '') {
            abort(400, 'invalid request');
        }
        try {
            $parsed = Carbon::createFromFormat('Y-m-d', $value, 'UTC');
            if ($parsed === false || $parsed->format('Y-m-d') !== $value) {
                abort(400, 'invalid request');
            }

            return $parsed->startOfDay();
        } catch (\Throwable) {
            abort(400, 'invalid request');
        }
    }

    private function parseReminderMinutes(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (is_int($value)) {
            return $value;
        }
        if (is_float($value) || is_numeric($value)) {
            return (int) $value;
        }

        return 0;
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
