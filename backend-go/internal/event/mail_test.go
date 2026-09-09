package event

import (
	"strings"
	"testing"
	"time"
)

func TestIcsTimedEvent(t *testing.T) {
	start := time.Date(2026, 9, 10, 6, 0, 0, 0, time.UTC)
	end := start.Add(time.Hour)
	body := icsBody("Lunch", 1, false, &start, nil, nil, nil, &start, &end, start)
	if !strings.Contains(body, "DTSTART:20260910T060000Z") || !strings.Contains(body, "BEGIN:VCALENDAR") {
		t.Fatalf("ics %s", body)
	}
}

func TestDueAtStartMinusReminder(t *testing.T) {
	start := time.Date(2026, 9, 10, 6, 0, 0, 0, time.UTC)
	dueAt := start.Add(-15 * time.Minute)
	if !due(dueAt, start, time.Date(2026, 9, 10, 5, 45, 0, 0, time.UTC)) {
		t.Fatal("expected due at reminder time")
	}
	if due(dueAt, start, time.Date(2026, 9, 10, 5, 44, 0, 0, time.UTC)) {
		t.Fatal("too early")
	}
	if due(dueAt, start, time.Date(2026, 9, 10, 9, 0, 0, 0, time.UTC)) {
		t.Fatal("stale after two hours")
	}
}
