package event

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/youdeee/calendar-rails-react/backend-go/internal/db"
	"github.com/youdeee/calendar-rails-react/backend-go/internal/recurrence"
)

const staleAfter = 2 * time.Hour

func (s *Service) Dispatch(ctx context.Context, eventID *int64, now time.Time) error {
	rows, err := s.q.FindEventsWithReminders(ctx, eventID)
	if err != nil {
		return err
	}
	for _, row := range rows {
		user, err := s.q.FindUserByID(ctx, row.UserID)
		if err != nil {
			continue
		}
		if err := s.dispatchEvent(ctx, row, user, now); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) dispatchEvent(ctx context.Context, row db.Event, user db.User, now time.Time) error {
	if row.ReminderMinutes == nil {
		return nil
	}
	minutes := time.Duration(*row.ReminderMinutes) * time.Minute
	windowStart := now.Add(-staleAfter)
	windowEnd := now.Add(minutes)
	rule, err := decodeRule(row.RecurrenceRule)
	if err != nil {
		return err
	}
	loc := locationOf(user.TimeZone)
	if row.AllDay {
		if row.StartOn == nil || row.EndOn == nil {
			return nil
		}
		for _, occurrenceOn := range recurrence.AllDayOccurrencesBetween(*row.StartOn, *row.EndOn, windowStart, windowEnd, loc, rule) {
			if err := s.deliverAllDay(ctx, row, user, occurrenceOn, now, loc); err != nil {
				return err
			}
		}
		return nil
	}
	if row.StartAt == nil || row.EndAt == nil {
		return nil
	}
	for _, occurrenceStart := range recurrence.OccurrencesBetween(*row.StartAt, *row.EndAt, windowStart, windowEnd, rule) {
		if err := s.deliverTimed(ctx, row, user, occurrenceStart, now); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) deliverTimed(ctx context.Context, row db.Event, user db.User, occurrenceStart, now time.Time) error {
	dueAt := occurrenceStart.Add(-time.Duration(*row.ReminderMinutes) * time.Minute)
	if !due(dueAt, occurrenceStart, now) {
		return nil
	}
	return s.sendOnce(ctx, row, user, occurrenceStart, func() error {
		start := occurrenceStart
		body := fmt.Sprintf("%s\n開始: %s", row.Title, occurrenceStart.UTC().Format(time.RFC3339))
		ics := icsBody(row.Title, row.ID, false, &start, nil, row.StartOn, row.EndOn, row.StartAt, row.EndAt, now)
		return s.mailer.SendReminder(user.Email, "リマインダー: "+row.Title, body, ics)
	})
}

func (s *Service) deliverAllDay(ctx context.Context, row db.Event, user db.User, occurrenceOn, now time.Time, loc *time.Location) error {
	startInstant := recurrence.AllDayStartInstant(occurrenceOn, loc)
	dueAt := startInstant.Add(-time.Duration(*row.ReminderMinutes) * time.Minute)
	if !due(dueAt, startInstant, now) {
		return nil
	}
	marker := time.Date(occurrenceOn.UTC().Year(), occurrenceOn.UTC().Month(), occurrenceOn.UTC().Day(), 0, 0, 0, 0, time.UTC)
	on := occurrenceOn
	return s.sendOnce(ctx, row, user, marker, func() error {
		body := fmt.Sprintf("%s\n終日: %s", row.Title, occurrenceOn.UTC().Format("2006-01-02"))
		ics := icsBody(row.Title, row.ID, true, nil, &on, row.StartOn, row.EndOn, row.StartAt, row.EndAt, now)
		return s.mailer.SendReminder(user.Email, "リマインダー: "+row.Title, body, ics)
	})
}

func due(dueAt, startInstant, now time.Time) bool {
	return !dueAt.After(now) && startInstant.After(now.Add(-staleAfter))
}

func (s *Service) sendOnce(ctx context.Context, row db.Event, user db.User, occurrenceStart time.Time, send func() error) error {
	existing, err := s.q.FindReminderDelivery(ctx, db.FindReminderDeliveryParams{
		EventID:           row.ID,
		OccurrenceStartAt: occurrenceStart,
	})
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	if err == nil && existing.DeliveredAt != nil {
		return nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		now := time.Now().UTC()
		if _, err := s.q.InsertReminderDelivery(ctx, db.InsertReminderDeliveryParams{
			UserID:            user.ID,
			EventID:           row.ID,
			OccurrenceStartAt: occurrenceStart,
			CreatedAt:         now,
			UpdatedAt:         now,
		}); err != nil {
			return err
		}
		existing, err = s.q.FindReminderDelivery(ctx, db.FindReminderDeliveryParams{
			EventID:           row.ID,
			OccurrenceStartAt: occurrenceStart,
		})
		if err != nil {
			return err
		}
	}
	if existing.DeliveredAt != nil {
		return nil
	}
	if err := send(); err != nil {
		return err
	}
	delivered := time.Now().UTC()
	return s.q.MarkReminderDelivered(ctx, db.MarkReminderDeliveredParams{ID: existing.ID, DeliveredAt: &delivered})
}
