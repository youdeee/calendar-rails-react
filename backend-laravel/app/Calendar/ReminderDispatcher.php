<?php

namespace App\Calendar;

use App\Models\Event;
use App\Models\ReminderDelivery;
use App\Models\User;
use Carbon\Carbon;

class ReminderDispatcher
{
    public const STALE_AFTER_SECONDS = 7200;

    public function __construct(private EventReminderMailer $mailer) {}

    public function dispatchAfterSave(Event $event): void
    {
        if ($event->reminder_minutes === null) {
            return;
        }
        $this->dispatch($event->id, now('UTC'));
    }

    public function dispatch(?int $eventId, Carbon $now): void
    {
        $query = Event::query()->with('user')->whereNotNull('reminder_minutes');
        if ($eventId !== null) {
            $query->whereKey($eventId);
        }
        foreach ($query->get() as $event) {
            $user = $event->user;
            if ($user === null) {
                continue;
            }
            $this->dispatchEvent($event, $user, $now);
        }
    }

    private function dispatchEvent(Event $event, User $user, Carbon $now): void
    {
        $minutes = (int) $event->reminder_minutes;
        $windowStart = $now->copy()->subSeconds(self::STALE_AFTER_SECONDS);
        $windowEnd = $now->copy()->addMinutes($minutes);
        $rule = $event->recurrenceParams();
        $zone = $user->time_zone ?: 'Asia/Tokyo';
        if ($event->all_day) {
            if ($event->start_on === null || $event->end_on === null) {
                return;
            }
            foreach (RecurrenceExpander::allDayOccurrencesBetween($event->start_on, $event->end_on, $windowStart, $windowEnd, $zone, $rule) as $occurrenceOn) {
                $this->deliverAllDay($event, $user, $occurrenceOn, $now, $zone);
            }

            return;
        }
        if ($event->start_at === null || $event->end_at === null) {
            return;
        }
        foreach (RecurrenceExpander::occurrencesBetween($event->start_at, $event->end_at, $windowStart, $windowEnd, $rule) as $occurrenceStart) {
            $this->deliverTimed($event, $user, $occurrenceStart, $now);
        }
    }

    private function deliverTimed(Event $event, User $user, Carbon $occurrenceStart, Carbon $now): void
    {
        $dueAt = $occurrenceStart->copy()->subMinutes((int) $event->reminder_minutes);
        if (! self::due($dueAt, $occurrenceStart, $now)) {
            return;
        }
        $this->sendOnce($event, $user, $occurrenceStart, fn () => $this->mailer->send($user, $event, $occurrenceStart, null));
    }

    private function deliverAllDay(Event $event, User $user, Carbon $occurrenceOn, Carbon $now, string $zone): void
    {
        $startInstant = RecurrenceExpander::allDayStartInstant($occurrenceOn, $zone);
        $dueAt = $startInstant->copy()->subMinutes((int) $event->reminder_minutes);
        if (! self::due($dueAt, $startInstant, $now)) {
            return;
        }
        $marker = Carbon::create($occurrenceOn->utc()->year, $occurrenceOn->utc()->month, $occurrenceOn->utc()->day, 0, 0, 0, 'UTC');
        $this->sendOnce($event, $user, $marker, fn () => $this->mailer->send($user, $event, null, $occurrenceOn));
    }

    private static function due(Carbon $dueAt, Carbon $startInstant, Carbon $now): bool
    {
        return ! $dueAt->gt($now) && $startInstant->gt($now->copy()->subSeconds(self::STALE_AFTER_SECONDS));
    }

    private function sendOnce(Event $event, User $user, Carbon $occurrenceStartAt, callable $send): void
    {
        $stamp = $occurrenceStartAt->copy()->utc();
        $existing = ReminderDelivery::query()
            ->where('event_id', $event->id)
            ->where('occurrence_start_at', $stamp)
            ->first();
        if ($existing?->delivered_at !== null) {
            return;
        }
        if ($existing === null) {
            $now = now('UTC');
            ReminderDelivery::query()->insertOrIgnore([
                'user_id' => $user->id,
                'event_id' => $event->id,
                'occurrence_start_at' => $stamp,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $existing = ReminderDelivery::query()
                ->where('event_id', $event->id)
                ->where('occurrence_start_at', $stamp)
                ->first();
        }
        if ($existing === null || $existing->delivered_at !== null) {
            return;
        }
        $send();
        $existing->delivered_at = now('UTC');
        $existing->save();
    }
}
