<?php

namespace Tests\Feature;

use App\Calendar\EventReminderMailer;
use App\Calendar\ReminderDispatcher;
use App\Models\Event;
use Carbon\Carbon;
use Mockery;
use Tests\TestCase;

class ReminderDispatchTest extends TestCase
{
    public function test_sends_one_email_fifteen_minutes_before_timed_event(): void
    {
        $mailer = Mockery::mock(EventReminderMailer::class);
        $mailer->shouldReceive('send')->once();
        $this->app->instance(EventReminderMailer::class, $mailer);

        $user = $this->persistUser();
        $event = $this->timed($user->id, 'Lunch', '2026-09-10T06:00:00Z', 15);
        $this->dispatcher()->dispatch($event->id, Carbon::parse('2026-09-10T05:45:00Z'));
    }

    public function test_sends_all_day_reminder_the_day_before_at_eighteen(): void
    {
        $mailer = Mockery::mock(EventReminderMailer::class);
        $mailer->shouldReceive('send')->once();
        $this->app->instance(EventReminderMailer::class, $mailer);

        $user = $this->persistUser();
        $event = $this->allDay($user->id, 'Holiday', '2026-09-10', 360);
        $this->dispatcher()->dispatch($event->id, Carbon::parse('2026-09-09T09:00:00Z'));
    }

    public function test_does_not_send_twice_for_the_same_occurrence(): void
    {
        $mailer = Mockery::mock(EventReminderMailer::class);
        $mailer->shouldReceive('send')->once();
        $this->app->instance(EventReminderMailer::class, $mailer);

        $user = $this->persistUser();
        $event = $this->timed($user->id, 'Lunch', '2026-09-10T06:00:00Z', 15);
        $now = Carbon::parse('2026-09-10T05:45:00Z');
        $this->dispatcher()->dispatch($event->id, $now);
        $this->dispatcher()->dispatch($event->id, $now);
    }

    public function test_does_not_send_when_reminder_minutes_is_blank(): void
    {
        $mailer = Mockery::mock(EventReminderMailer::class);
        $mailer->shouldReceive('send')->never();
        $this->app->instance(EventReminderMailer::class, $mailer);

        $user = $this->persistUser();
        $event = $this->timed($user->id, 'Lunch', '2026-09-10T06:00:00Z', null);
        $this->dispatcher()->dispatch($event->id, Carbon::parse('2026-09-10T05:45:00Z'));
    }

    public function test_does_not_send_after_start_plus_two_hours(): void
    {
        $mailer = Mockery::mock(EventReminderMailer::class);
        $mailer->shouldReceive('send')->never();
        $this->app->instance(EventReminderMailer::class, $mailer);

        $user = $this->persistUser();
        $event = $this->timed($user->id, 'Lunch', '2026-09-10T06:00:00Z', 15);
        $this->dispatcher()->dispatch($event->id, Carbon::parse('2026-09-10T09:00:00Z'));
    }

    public function test_still_sends_late_reminder_when_event_is_in_the_future(): void
    {
        $mailer = Mockery::mock(EventReminderMailer::class);
        $mailer->shouldReceive('send')->once();
        $this->app->instance(EventReminderMailer::class, $mailer);

        $user = $this->persistUser();
        $event = $this->timed($user->id, 'Lunch', '2026-10-10T06:00:00Z', 43_200);
        $this->dispatcher()->dispatch($event->id, Carbon::parse('2026-09-10T11:00:00Z'));
    }

    public function test_does_not_send_all_day_reminder_on_the_morning_of_the_event(): void
    {
        $mailer = Mockery::mock(EventReminderMailer::class);
        $mailer->shouldReceive('send')->never();
        $this->app->instance(EventReminderMailer::class, $mailer);

        $user = $this->persistUser();
        $event = $this->allDay($user->id, 'Holiday', '2026-09-10', 360);
        $this->dispatcher()->dispatch($event->id, Carbon::parse('2026-09-10T00:00:00Z'));
    }

    private function dispatcher(): ReminderDispatcher
    {
        return $this->app->make(ReminderDispatcher::class);
    }

    private function timed(int $userId, string $title, string $start, ?int $minutes): Event
    {
        $startAt = Carbon::parse($start)->utc();

        return Event::query()->create([
            'user_id' => $userId,
            'title' => $title,
            'start_at' => $startAt,
            'end_at' => $startAt->copy()->addHour(),
            'reminder_minutes' => $minutes,
        ]);
    }

    private function allDay(int $userId, string $title, string $on, int $minutes): Event
    {
        return Event::query()->create([
            'user_id' => $userId,
            'title' => $title,
            'all_day' => true,
            'start_on' => $on,
            'end_on' => $on,
            'reminder_minutes' => $minutes,
        ]);
    }
}
