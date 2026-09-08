package recurrence

import (
	"testing"
	"time"
)

func TestSingleEventInRange(t *testing.T) {
	start := parse(t, "2026-08-10T10:00:00Z")
	end := parse(t, "2026-08-10T11:00:00Z")
	got := OccurrencesBetween(start, end, parse(t, "2026-08-01T00:00:00Z"), parse(t, "2026-08-31T00:00:00Z"), nil)
	if len(got) != 1 || !got[0].Equal(start) {
		t.Fatalf("got %v", got)
	}
}

func TestSingleEventOutOfRange(t *testing.T) {
	start := parse(t, "2026-08-10T10:00:00Z")
	end := parse(t, "2026-08-10T11:00:00Z")
	got := OccurrencesBetween(start, end, parse(t, "2026-09-01T00:00:00Z"), parse(t, "2026-09-30T00:00:00Z"), nil)
	if len(got) != 0 {
		t.Fatalf("got %v", got)
	}
}

func TestExpandsWeeklyAcrossAugust(t *testing.T) {
	start := parse(t, "2026-08-03T10:00:00Z")
	end := parse(t, "2026-08-03T11:00:00Z")
	got := OccurrencesBetween(start, end, parse(t, "2026-08-01T00:00:00Z"), parse(t, "2026-08-31T00:00:00Z"), &Rule{Frequency: "weekly", Interval: 1})
	if len(got) != 5 {
		t.Fatalf("got %d occurrences", len(got))
	}
	y, m, d := got[0].UTC().Date()
	if y != 2026 || m != time.August || d != 3 {
		t.Fatalf("first occurrence %v", got[0])
	}
}

func TestIncludesOccurrenceLaterInRangeEndDay(t *testing.T) {
	start := parse(t, "2026-08-10T10:00:00Z")
	end := parse(t, "2026-08-10T11:00:00Z")
	got := OccurrencesBetween(start, end, parse(t, "2026-08-01T00:00:00Z"), parse(t, "2026-08-10T00:00:00Z"), nil)
	if len(got) != 1 || !got[0].Equal(start) {
		t.Fatalf("got %v", got)
	}
}

func TestExcludesOccurrenceOnDayAfterRangeEnd(t *testing.T) {
	start := parse(t, "2026-08-11T00:30:00Z")
	end := parse(t, "2026-08-11T01:30:00Z")
	got := OccurrencesBetween(start, end, parse(t, "2026-08-01T00:00:00Z"), parse(t, "2026-08-10T00:00:00Z"), nil)
	if len(got) != 0 {
		t.Fatalf("got %v", got)
	}
}

func TestIncludesMultiDayOverlapStartingBeforeRange(t *testing.T) {
	start := parse(t, "2026-08-05T10:00:00Z")
	end := parse(t, "2026-08-12T10:00:00Z")
	got := OccurrencesBetween(start, end, parse(t, "2026-08-10T00:00:00Z"), parse(t, "2026-08-20T00:00:00Z"), nil)
	if len(got) != 1 || !got[0].Equal(start) {
		t.Fatalf("got %v", got)
	}
}

func TestIncludesRecurringMultiDayOccurrenceStartingBeforeRange(t *testing.T) {
	start := parse(t, "2026-08-03T00:00:00Z")
	end := parse(t, "2026-08-06T00:00:00Z")
	got := OccurrencesBetween(start, end, parse(t, "2026-08-05T00:00:00Z"), parse(t, "2026-08-10T00:00:00Z"), &Rule{Frequency: "weekly", Interval: 1})
	want1 := parse(t, "2026-08-03T00:00:00Z")
	want2 := parse(t, "2026-08-10T00:00:00Z")
	if !containsTime(got, want1) || !containsTime(got, want2) {
		t.Fatalf("got %v", got)
	}
}

func parse(t *testing.T, s string) time.Time {
	t.Helper()
	v, err := time.Parse(time.RFC3339, s)
	if err != nil {
		t.Fatal(err)
	}
	return v
}

func containsTime(times []time.Time, want time.Time) bool {
	for _, v := range times {
		if v.Equal(want) {
			return true
		}
	}
	return false
}
