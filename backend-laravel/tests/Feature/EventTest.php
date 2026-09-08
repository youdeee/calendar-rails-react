<?php

namespace Tests\Feature;

use App\Models\User;
use Tests\TestCase;

class EventTest extends TestCase
{
    public function test_requires_authentication(): void
    {
        $this->getJson('/api/events?from=2026-08-01&to=2026-08-31')->assertUnauthorized();
    }

    public function test_lists_events_in_range(): void
    {
        $user = $this->persistUser();
        $this->createEvent($user, 'In range', '2026-08-10T10:00:00Z', '2026-08-10T11:00:00Z');
        $this->createEvent($user, 'Out of range', '2026-09-10T10:00:00Z', '2026-09-10T11:00:00Z');
        $this->withHeaders($this->bearer($user))
            ->getJson('/api/events?from=2026-08-01&to=2026-08-31')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.title', 'In range');
    }

    public function test_excludes_other_users_events(): void
    {
        $user = $this->persistUser();
        $other = $this->persistUser();
        $this->createEvent($other, 'Not mine', '2026-08-10T10:00:00Z', '2026-08-10T11:00:00Z');
        $this->withHeaders($this->bearer($user))
            ->getJson('/api/events?from=2026-08-01&to=2026-08-31')
            ->assertOk()
            ->assertJsonCount(0);
    }

    public function test_expands_weekly_recurring_event(): void
    {
        $user = $this->persistUser();
        $created = $this->createEvent($user, 'Standup', '2026-08-03T10:00:00Z', '2026-08-03T10:15:00Z', [
            'frequency' => 'weekly',
            'interval' => 1,
        ]);
        $this->withHeaders($this->bearer($user))
            ->getJson('/api/events?from=2026-08-01&to=2026-08-31')
            ->assertOk()
            ->assertJsonCount(5)
            ->assertJsonPath('0.id', $created['id'])
            ->assertJsonPath('0.recurring', true)
            ->assertJsonPath('0.recurrence.frequency', 'weekly')
            ->assertJsonPath('0.recurrence.interval', 1);
    }

    public function test_includes_event_later_in_to_day(): void
    {
        $user = $this->persistUser();
        $this->createEvent($user, 'Evening', '2026-08-31T22:00:00Z', '2026-08-31T23:00:00Z');
        $this->withHeaders($this->bearer($user))
            ->getJson('/api/events?from=2026-08-01&to=2026-08-31')
            ->assertOk()
            ->assertJsonPath('0.title', 'Evening');
    }

    public function test_rejects_invalid_date(): void
    {
        $user = $this->persistUser();
        $this->withHeaders($this->bearer($user))
            ->getJson('/api/events?from=not-a-date&to=2026-08-31')
            ->assertBadRequest();
    }

    public function test_rejects_range_over_three_months(): void
    {
        $user = $this->persistUser();
        $this->withHeaders($this->bearer($user))
            ->getJson('/api/events?from=2026-01-01&to=2026-08-31')
            ->assertBadRequest();
    }

    public function test_creates_non_recurring_event(): void
    {
        $user = $this->persistUser();
        $this->withHeaders($this->bearer($user))
            ->postJson('/api/events', [
                'event' => [
                    'title' => 'Lunch',
                    'start_at' => '2026-08-10T12:00:00+09:00',
                    'end_at' => '2026-08-10T13:00:00+09:00',
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('title', 'Lunch')
            ->assertJsonPath('recurring', false);
    }

    public function test_creates_recurring_event(): void
    {
        $user = $this->persistUser();
        $this->withHeaders($this->bearer($user))
            ->postJson('/api/events', [
                'event' => [
                    'title' => 'Standup',
                    'start_at' => '2026-08-03T10:00:00+09:00',
                    'end_at' => '2026-08-03T10:15:00+09:00',
                    'recurrence' => ['frequency' => 'weekly', 'interval' => '1', 'until' => '2026-12-31'],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('recurring', true)
            ->assertJsonPath('recurrence.frequency', 'weekly')
            ->assertJsonPath('recurrence.interval', 1)
            ->assertJsonPath('recurrence.until', '2026-12-31');
    }

    public function test_rejects_invalid_frequency(): void
    {
        $user = $this->persistUser();
        $this->withHeaders($this->bearer($user))
            ->postJson('/api/events', [
                'event' => [
                    'title' => 'Bad',
                    'start_at' => '2026-08-03T10:00:00+09:00',
                    'end_at' => '2026-08-03T10:15:00+09:00',
                    'recurrence' => ['frequency' => 'yearly', 'interval' => '1'],
                ],
            ])
            ->assertUnprocessable();
    }

    public function test_rejects_long_title(): void
    {
        $user = $this->persistUser();
        $this->withHeaders($this->bearer($user))
            ->postJson('/api/events', [
                'event' => [
                    'title' => str_repeat('a', 201),
                    'start_at' => '2026-08-10T12:00:00+09:00',
                    'end_at' => '2026-08-10T13:00:00+09:00',
                ],
            ])
            ->assertUnprocessable();
    }

    public function test_create_requires_authentication(): void
    {
        $this->postJson('/api/events', [
            'event' => [
                'title' => 'Lunch',
                'start_at' => '2026-08-10T12:00:00+09:00',
                'end_at' => '2026-08-10T13:00:00+09:00',
            ],
        ])->assertUnauthorized();
    }

    public function test_rejects_non_object_recurrence(): void
    {
        $user = $this->persistUser();
        $this->withHeaders($this->bearer($user))
            ->postJson('/api/events', [
                'event' => [
                    'title' => 'Lunch',
                    'start_at' => '2026-08-10T12:00:00+09:00',
                    'end_at' => '2026-08-10T13:00:00+09:00',
                    'recurrence' => 'not-a-hash',
                ],
            ])
            ->assertBadRequest();
    }

    public function test_rejects_invalid_until(): void
    {
        $user = $this->persistUser();
        $this->withHeaders($this->bearer($user))
            ->postJson('/api/events', [
                'event' => [
                    'title' => 'Bad until',
                    'start_at' => '2026-08-03T10:00:00+09:00',
                    'end_at' => '2026-08-03T10:15:00+09:00',
                    'recurrence' => ['frequency' => 'weekly', 'interval' => '1', 'until' => 'not-a-date'],
                ],
            ])
            ->assertUnprocessable();
    }

    public function test_updates_event_times(): void
    {
        $user = $this->persistUser();
        $created = $this->createEvent($user, 'Meeting', '2026-08-10T10:00:00Z', '2026-08-10T11:00:00Z');
        $response = $this->withHeaders($this->bearer($user))
            ->patchJson('/api/events/'.$created['id'], [
                'event' => [
                    'start_at' => '2026-08-11T10:00:00+09:00',
                    'end_at' => '2026-08-11T11:00:00+09:00',
                ],
            ])
            ->assertOk();
        $this->assertStringStartsWith('2026-08-11T01:00:00', $response->json('start_at'));
        $this->assertStringStartsWith('2026-08-11T02:00:00', $response->json('end_at'));
    }

    public function test_updates_recurrence(): void
    {
        $user = $this->persistUser();
        $created = $this->createEvent($user, 'Standup', '2026-08-03T10:00:00Z', '2026-08-03T10:15:00Z', [
            'frequency' => 'weekly',
            'interval' => 1,
        ]);
        $this->withHeaders($this->bearer($user))
            ->patchJson('/api/events/'.$created['id'], [
                'event' => [
                    'recurrence' => ['frequency' => 'weekly', 'interval' => '2', 'until' => '2026-12-31'],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('recurrence.interval', 2)
            ->assertJsonPath('recurrence.until', '2026-12-31');
    }

    public function test_update_rejects_blank_title(): void
    {
        $user = $this->persistUser();
        $created = $this->createEvent($user, 'Meeting', '2026-08-10T10:00:00Z', '2026-08-10T11:00:00Z');
        $this->withHeaders($this->bearer($user))
            ->patchJson('/api/events/'.$created['id'], ['event' => ['title' => '']])
            ->assertUnprocessable();
    }

    public function test_cannot_update_other_users_event(): void
    {
        $user = $this->persistUser();
        $other = $this->persistUser();
        $created = $this->createEvent($other, 'Not mine', '2026-08-10T10:00:00Z', '2026-08-10T11:00:00Z');
        $this->withHeaders($this->bearer($user))
            ->patchJson('/api/events/'.$created['id'], ['event' => ['title' => 'Hijacked']])
            ->assertNotFound();
    }

    public function test_deletes_own_event(): void
    {
        $user = $this->persistUser();
        $created = $this->createEvent($user, 'Meeting', '2026-08-10T10:00:00Z', '2026-08-10T11:00:00Z');
        $this->withHeaders($this->bearer($user))
            ->deleteJson('/api/events/'.$created['id'])
            ->assertNoContent();
        $this->withHeaders($this->bearer($user))
            ->getJson('/api/events?from=2026-08-01&to=2026-08-31')
            ->assertJsonCount(0);
    }

    public function test_cannot_delete_other_users_event(): void
    {
        $user = $this->persistUser();
        $other = $this->persistUser();
        $created = $this->createEvent($other, 'Not mine', '2026-08-10T10:00:00Z', '2026-08-10T11:00:00Z');
        $this->withHeaders($this->bearer($user))
            ->deleteJson('/api/events/'.$created['id'])
            ->assertNotFound();
    }

    private function createEvent(User $owner, string $title, string $start, string $end, ?array $recurrence = null): array
    {
        $event = ['title' => $title, 'start_at' => $start, 'end_at' => $end];
        if ($recurrence !== null) {
            $event['recurrence'] = $recurrence;
        }
        $response = $this->withHeaders($this->bearer($owner))
            ->postJson('/api/events', ['event' => $event]);
        $response->assertCreated();

        return $response->json();
    }
}
