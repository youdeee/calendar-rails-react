package httpapi

import (
	"context"
	"testing"
	"time"

	"github.com/youdeee/calendar-rails-react/backend-go/internal/db"
	"github.com/youdeee/calendar-rails-react/backend-go/internal/event"
)

func TestSendsOneEmailFifteenMinutesBeforeTimedEvent(t *testing.T) {
	testH.mailer.Reset()
	user := persistRandomUser(t)
	start := time.Date(2026, 9, 10, 6, 0, 0, 0, time.UTC)
	ev := insertTimedReminder(t, user.ID, "Lunch", start, ptrInt32(15))
	dispatchAt(t, ev.ID, time.Date(2026, 9, 10, 5, 45, 0, 0, time.UTC))
	if len(testH.mailer.Subjects) != 1 || testH.mailer.Subjects[0] != "リマインダー: Lunch" {
		t.Fatalf("subjects %v", testH.mailer.Subjects)
	}
}

func TestSendsAllDayReminderTheDayBeforeAtEighteen(t *testing.T) {
	testH.mailer.Reset()
	user := persistRandomUser(t)
	on := time.Date(2026, 9, 10, 0, 0, 0, 0, time.UTC)
	ev := insertAllDayReminder(t, user.ID, "Holiday", on, 360)
	dispatchAt(t, ev.ID, time.Date(2026, 9, 9, 9, 0, 0, 0, time.UTC))
	if len(testH.mailer.Subjects) != 1 || testH.mailer.Subjects[0] != "リマインダー: Holiday" {
		t.Fatalf("subjects %v", testH.mailer.Subjects)
	}
}

func TestDoesNotSendTwiceForTheSameOccurrence(t *testing.T) {
	testH.mailer.Reset()
	user := persistRandomUser(t)
	start := time.Date(2026, 9, 10, 6, 0, 0, 0, time.UTC)
	ev := insertTimedReminder(t, user.ID, "Lunch", start, ptrInt32(15))
	now := time.Date(2026, 9, 10, 5, 45, 0, 0, time.UTC)
	dispatchAt(t, ev.ID, now)
	dispatchAt(t, ev.ID, now)
	if len(testH.mailer.Subjects) != 1 {
		t.Fatalf("subjects %v", testH.mailer.Subjects)
	}
}

func TestDoesNotSendWhenReminderMinutesIsBlank(t *testing.T) {
	testH.mailer.Reset()
	user := persistRandomUser(t)
	start := time.Date(2026, 9, 10, 6, 0, 0, 0, time.UTC)
	ev := insertTimedReminder(t, user.ID, "Lunch", start, nil)
	dispatchAt(t, ev.ID, time.Date(2026, 9, 10, 5, 45, 0, 0, time.UTC))
	if len(testH.mailer.Subjects) != 0 {
		t.Fatalf("subjects %v", testH.mailer.Subjects)
	}
}

func TestDoesNotSendAfterStartPlusTwoHours(t *testing.T) {
	testH.mailer.Reset()
	user := persistRandomUser(t)
	start := time.Date(2026, 9, 10, 6, 0, 0, 0, time.UTC)
	ev := insertTimedReminder(t, user.ID, "Lunch", start, ptrInt32(15))
	dispatchAt(t, ev.ID, time.Date(2026, 9, 10, 9, 0, 0, 0, time.UTC))
	if len(testH.mailer.Subjects) != 0 {
		t.Fatalf("subjects %v", testH.mailer.Subjects)
	}
}

func TestStillSendsLateReminderWhenEventIsInTheFuture(t *testing.T) {
	testH.mailer.Reset()
	user := persistRandomUser(t)
	start := time.Date(2026, 10, 10, 6, 0, 0, 0, time.UTC)
	ev := insertTimedReminder(t, user.ID, "Lunch", start, ptrInt32(43_200))
	dispatchAt(t, ev.ID, time.Date(2026, 9, 10, 11, 0, 0, 0, time.UTC))
	if len(testH.mailer.Subjects) != 1 {
		t.Fatalf("subjects %v", testH.mailer.Subjects)
	}
}

func TestDoesNotSendAllDayReminderOnTheMorningOfTheEvent(t *testing.T) {
	testH.mailer.Reset()
	user := persistRandomUser(t)
	on := time.Date(2026, 9, 10, 0, 0, 0, 0, time.UTC)
	ev := insertAllDayReminder(t, user.ID, "Holiday", on, 360)
	dispatchAt(t, ev.ID, time.Date(2026, 9, 10, 0, 0, 0, 0, time.UTC))
	if len(testH.mailer.Subjects) != 0 {
		t.Fatalf("subjects %v", testH.mailer.Subjects)
	}
}

func dispatchAt(t *testing.T, eventID int64, now time.Time) {
	t.Helper()
	svc := event.NewService(testH.q, testH.mailer)
	if err := svc.Dispatch(context.Background(), &eventID, now); err != nil {
		t.Fatal(err)
	}
}

func insertTimedReminder(t *testing.T, userID int64, title string, start time.Time, minutes *int32) db.Event {
	t.Helper()
	now := time.Now().UTC()
	end := start.Add(time.Hour)
	row, err := testH.q.InsertEvent(context.Background(), db.InsertEventParams{
		UserID:          userID,
		Title:           title,
		StartAt:         &start,
		EndAt:           &end,
		ReminderMinutes: minutes,
		CreatedAt:       now,
		UpdatedAt:       now,
	})
	if err != nil {
		t.Fatal(err)
	}
	return row
}

func insertAllDayReminder(t *testing.T, userID int64, title string, on time.Time, minutes int32) db.Event {
	t.Helper()
	now := time.Now().UTC()
	day := time.Date(on.UTC().Year(), on.UTC().Month(), on.UTC().Day(), 0, 0, 0, 0, time.UTC)
	row, err := testH.q.InsertEvent(context.Background(), db.InsertEventParams{
		UserID:          userID,
		Title:           title,
		StartOn:         &day,
		EndOn:           &day,
		AllDay:          true,
		ReminderMinutes: &minutes,
		CreatedAt:       now,
		UpdatedAt:       now,
	})
	if err != nil {
		t.Fatal(err)
	}
	return row
}

func ptrInt32(n int32) *int32 { return &n }
