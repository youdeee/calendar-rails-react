<?php

namespace App\Calendar;

use App\Models\Event;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Mail;

class EventReminderMailer
{
    public function send(User $user, Event $event, ?Carbon $occurrenceStartAt, ?Carbon $occurrenceOn): void
    {
        $plain = $event->all_day
            ? $event->title."\n終日: ".$occurrenceOn->utc()->toDateString()
            : $event->title."\n開始: ".$occurrenceStartAt->copy()->utc()->toIso8601String();
        $ics = EventIcs::body($event, $occurrenceStartAt, $occurrenceOn, now('UTC'));

        Mail::raw($plain, function ($message) use ($user, $event, $ics) {
            $message->from('calendar@localhost')
                ->to($user->email)
                ->subject('リマインダー: '.$event->title)
                ->attachData($ics, 'event.ics', ['mime' => 'text/calendar']);
        });
    }
}
