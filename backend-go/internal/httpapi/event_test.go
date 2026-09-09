package httpapi

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/youdeee/calendar-rails-react/backend-go/internal/auth"
)

func TestEventsRequireAuthentication(t *testing.T) {
	rec := do(http.MethodGet, "/api/events?from=2026-08-01&to=2026-08-31", "", nil)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status %d", rec.Code)
	}
}

func TestListsEventsInRange(t *testing.T) {
	user := persistRandomUser(t)
	createEvent(t, user, "In range", "2026-08-10T10:00:00Z", "2026-08-10T11:00:00Z", "")
	createEvent(t, user, "Out of range", "2026-09-10T10:00:00Z", "2026-09-10T11:00:00Z", "")
	rec := do(http.MethodGet, "/api/events?from=2026-08-01&to=2026-08-31", "", authHeader(t, user))
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	arr := jsonArray(t, rec)
	if len(arr) != 1 || arr[0].(map[string]any)["title"] != "In range" {
		t.Fatalf("body %s", rec.Body.String())
	}
}

func TestExcludesOtherUsersEvents(t *testing.T) {
	user := persistRandomUser(t)
	other := persistRandomUser(t)
	createEvent(t, other, "Not mine", "2026-08-10T10:00:00Z", "2026-08-10T11:00:00Z", "")
	rec := do(http.MethodGet, "/api/events?from=2026-08-01&to=2026-08-31", "", authHeader(t, user))
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d", rec.Code)
	}
	if len(jsonArray(t, rec)) != 0 {
		t.Fatalf("body %s", rec.Body.String())
	}
}

func TestExpandsWeeklyRecurringEvent(t *testing.T) {
	user := persistRandomUser(t)
	created := createEvent(t, user, "Standup", "2026-08-03T10:00:00Z", "2026-08-03T10:15:00Z", `{"frequency":"weekly","interval":1}`)
	id := created["id"]
	rec := do(http.MethodGet, "/api/events?from=2026-08-01&to=2026-08-31", "", authHeader(t, user))
	arr := jsonArray(t, rec)
	if len(arr) != 5 {
		t.Fatalf("len %d body %s", len(arr), rec.Body.String())
	}
	first := arr[0].(map[string]any)
	if first["id"] != id || first["recurring"] != true {
		t.Fatalf("first %v", first)
	}
	recurrence := first["recurrence"].(map[string]any)
	if recurrence["frequency"] != "weekly" || recurrence["interval"] != float64(1) {
		t.Fatalf("recurrence %v", recurrence)
	}
}

func TestIncludesEventLaterInToDay(t *testing.T) {
	user := persistRandomUser(t)
	createEvent(t, user, "Evening", "2026-08-31T22:00:00Z", "2026-08-31T23:00:00Z", "")
	rec := do(http.MethodGet, "/api/events?from=2026-08-01&to=2026-08-31", "", authHeader(t, user))
	arr := jsonArray(t, rec)
	if len(arr) == 0 || arr[0].(map[string]any)["title"] != "Evening" {
		t.Fatalf("body %s", rec.Body.String())
	}
}

func TestRejectsInvalidDate(t *testing.T) {
	user := persistRandomUser(t)
	rec := do(http.MethodGet, "/api/events?from=not-a-date&to=2026-08-31", "", authHeader(t, user))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d", rec.Code)
	}
}

func TestRejectsRangeOverThreeMonths(t *testing.T) {
	user := persistRandomUser(t)
	rec := do(http.MethodGet, "/api/events?from=2026-01-01&to=2026-08-31", "", authHeader(t, user))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d", rec.Code)
	}
}

func TestCreatesNonRecurringEvent(t *testing.T) {
	user := persistRandomUser(t)
	rec := do(http.MethodPost, "/api/events",
		`{"event":{"title":"Lunch","start_at":"2026-08-10T12:00:00+09:00","end_at":"2026-08-10T13:00:00+09:00"}}`,
		authHeader(t, user))
	if rec.Code != http.StatusCreated {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	body := jsonBody(t, rec)
	if body["title"] != "Lunch" || body["recurring"] != false {
		t.Fatalf("body %s", rec.Body.String())
	}
}

func TestCreatesRecurringEvent(t *testing.T) {
	user := persistRandomUser(t)
	rec := do(http.MethodPost, "/api/events",
		`{"event":{"title":"Standup","start_at":"2026-08-03T10:00:00+09:00","end_at":"2026-08-03T10:15:00+09:00","recurrence":{"frequency":"weekly","interval":"1","until":"2026-12-31"}}}`,
		authHeader(t, user))
	if rec.Code != http.StatusCreated {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	body := jsonBody(t, rec)
	if body["recurring"] != true {
		t.Fatalf("body %s", rec.Body.String())
	}
	r := body["recurrence"].(map[string]any)
	if r["frequency"] != "weekly" || r["interval"] != float64(1) || r["until"] != "2026-12-31" {
		t.Fatalf("recurrence %v", r)
	}
}

func TestRejectsInvalidFrequency(t *testing.T) {
	user := persistRandomUser(t)
	rec := do(http.MethodPost, "/api/events",
		`{"event":{"title":"Bad","start_at":"2026-08-03T10:00:00+09:00","end_at":"2026-08-03T10:15:00+09:00","recurrence":{"frequency":"yearly","interval":"1"}}}`,
		authHeader(t, user))
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
}

func TestRejectsLongTitle(t *testing.T) {
	user := persistRandomUser(t)
	rec := do(http.MethodPost, "/api/events",
		`{"event":{"title":"`+strings.Repeat("a", 201)+`","start_at":"2026-08-10T12:00:00+09:00","end_at":"2026-08-10T13:00:00+09:00"}}`,
		authHeader(t, user))
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status %d", rec.Code)
	}
}

func TestCreateRequiresAuthentication(t *testing.T) {
	rec := do(http.MethodPost, "/api/events",
		`{"event":{"title":"Lunch","start_at":"2026-08-10T12:00:00+09:00","end_at":"2026-08-10T13:00:00+09:00"}}`,
		nil)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status %d", rec.Code)
	}
}

func TestRejectsNonObjectRecurrence(t *testing.T) {
	user := persistRandomUser(t)
	rec := do(http.MethodPost, "/api/events",
		`{"event":{"title":"Lunch","start_at":"2026-08-10T12:00:00+09:00","end_at":"2026-08-10T13:00:00+09:00","recurrence":"not-a-hash"}}`,
		authHeader(t, user))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
}

func TestRejectsInvalidUntil(t *testing.T) {
	user := persistRandomUser(t)
	rec := do(http.MethodPost, "/api/events",
		`{"event":{"title":"Bad until","start_at":"2026-08-03T10:00:00+09:00","end_at":"2026-08-03T10:15:00+09:00","recurrence":{"frequency":"weekly","interval":"1","until":"not-a-date"}}}`,
		authHeader(t, user))
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
}

func TestUpdatesEventTimes(t *testing.T) {
	user := persistRandomUser(t)
	created := createEvent(t, user, "Meeting", "2026-08-10T10:00:00Z", "2026-08-10T11:00:00Z", "")
	id := int64(created["id"].(float64))
	rec := do(http.MethodPatch, "/api/events/"+itoa64(id),
		`{"event":{"start_at":"2026-08-11T10:00:00+09:00","end_at":"2026-08-11T11:00:00+09:00"}}`,
		authHeader(t, user))
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	body := jsonBody(t, rec)
	if !strings.HasPrefix(body["start_at"].(string), "2026-08-11T01:00:00") {
		t.Fatalf("start_at %v", body["start_at"])
	}
	if !strings.HasPrefix(body["end_at"].(string), "2026-08-11T02:00:00") {
		t.Fatalf("end_at %v", body["end_at"])
	}
}

func TestUpdatesRecurrence(t *testing.T) {
	user := persistRandomUser(t)
	created := createEvent(t, user, "Standup", "2026-08-03T10:00:00Z", "2026-08-03T10:15:00Z", `{"frequency":"weekly","interval":1}`)
	id := int64(created["id"].(float64))
	rec := do(http.MethodPatch, "/api/events/"+itoa64(id),
		`{"event":{"recurrence":{"frequency":"weekly","interval":"2","until":"2026-12-31"}}}`,
		authHeader(t, user))
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	r := jsonBody(t, rec)["recurrence"].(map[string]any)
	if r["interval"] != float64(2) || r["until"] != "2026-12-31" {
		t.Fatalf("recurrence %v", r)
	}
}

func TestUpdateRejectsBlankTitle(t *testing.T) {
	user := persistRandomUser(t)
	created := createEvent(t, user, "Meeting", "2026-08-10T10:00:00Z", "2026-08-10T11:00:00Z", "")
	id := int64(created["id"].(float64))
	rec := do(http.MethodPatch, "/api/events/"+itoa64(id), `{"event":{"title":""}}`, authHeader(t, user))
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status %d", rec.Code)
	}
}

func TestCannotUpdateOtherUsersEvent(t *testing.T) {
	user := persistRandomUser(t)
	other := persistRandomUser(t)
	created := createEvent(t, other, "Not mine", "2026-08-10T10:00:00Z", "2026-08-10T11:00:00Z", "")
	id := int64(created["id"].(float64))
	rec := do(http.MethodPatch, "/api/events/"+itoa64(id), `{"event":{"title":"Hijacked"}}`, authHeader(t, user))
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status %d", rec.Code)
	}
}

func TestDeletesOwnEvent(t *testing.T) {
	user := persistRandomUser(t)
	created := createEvent(t, user, "Meeting", "2026-08-10T10:00:00Z", "2026-08-10T11:00:00Z", "")
	id := int64(created["id"].(float64))
	rec := do(http.MethodDelete, "/api/events/"+itoa64(id), "", authHeader(t, user))
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status %d", rec.Code)
	}
	rec = do(http.MethodGet, "/api/events?from=2026-08-01&to=2026-08-31", "", authHeader(t, user))
	if len(jsonArray(t, rec)) != 0 {
		t.Fatalf("body %s", rec.Body.String())
	}
}

func TestCannotDeleteOtherUsersEvent(t *testing.T) {
	user := persistRandomUser(t)
	other := persistRandomUser(t)
	created := createEvent(t, other, "Not mine", "2026-08-10T10:00:00Z", "2026-08-10T11:00:00Z", "")
	id := int64(created["id"].(float64))
	rec := do(http.MethodDelete, "/api/events/"+itoa64(id), "", authHeader(t, user))
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status %d", rec.Code)
	}
}

func TestCreatesAllDayEventFromStartOnAndEndOn(t *testing.T) {
	user := persistRandomUser(t)
	rec := do(http.MethodPost, "/api/events",
		`{"event":{"title":"Holiday","all_day":true,"start_on":"2026-08-10","end_on":"2026-08-12","reminder_minutes":360}}`,
		authHeader(t, user))
	if rec.Code != http.StatusCreated {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	body := jsonBody(t, rec)
	if body["all_day"] != true || body["start_on"] != "2026-08-10" || body["end_on"] != "2026-08-12" {
		t.Fatalf("body %s", rec.Body.String())
	}
	if body["start_at"] != nil {
		t.Fatalf("start_at %v", body["start_at"])
	}
	if body["reminder_minutes"] != float64(360) {
		t.Fatalf("reminder_minutes %v", body["reminder_minutes"])
	}
}

func TestListsAllDayEventInRange(t *testing.T) {
	user := persistRandomUser(t)
	rec := do(http.MethodPost, "/api/events",
		`{"event":{"title":"Holiday","all_day":true,"start_on":"2026-08-10","end_on":"2026-08-10"}}`,
		authHeader(t, user))
	if rec.Code != http.StatusCreated {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	rec = do(http.MethodGet, "/api/events?from=2026-08-01&to=2026-08-31", "", authHeader(t, user))
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	arr := jsonArray(t, rec)
	if len(arr) == 0 || arr[0].(map[string]any)["title"] != "Holiday" || arr[0].(map[string]any)["start_on"] != "2026-08-10" {
		t.Fatalf("body %s", rec.Body.String())
	}
}

func TestRejectsReminderMinutesAboveThirtyDays(t *testing.T) {
	user := persistRandomUser(t)
	rec := do(http.MethodPost, "/api/events",
		`{"event":{"title":"Lunch","start_at":"2026-08-10T12:00:00+09:00","end_at":"2026-08-10T13:00:00+09:00","reminder_minutes":43201}}`,
		authHeader(t, user))
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
}

func createEvent(t *testing.T, owner auth.User, title, start, end, recurrenceJSON string) map[string]any {
	t.Helper()
	recurrence := ""
	if recurrenceJSON != "" {
		recurrence = `,"recurrence":` + recurrenceJSON
	}
	body := `{"event":{"title":"` + title + `","start_at":"` + start + `","end_at":"` + end + `"` + recurrence + `}}`
	rec := do(http.MethodPost, "/api/events", body, authHeader(t, owner))
	if rec.Code != http.StatusCreated {
		t.Fatalf("create status %d body %s", rec.Code, rec.Body.String())
	}
	return jsonBody(t, rec)
}

func itoa64(n int64) string {
	b, _ := json.Marshal(n)
	return string(b)
}
