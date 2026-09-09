package httpapi

import (
	"net/http"
	"testing"
)

func TestMeReturnsCurrentUser(t *testing.T) {
	user := persistUser(t, "me@example.com", "g-me", "Taro")
	rec := do(http.MethodGet, "/api/me", "", authHeader(t, user))
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	body := jsonBody(t, rec)
	if body["email"] != "me@example.com" || body["name"] != "Taro" {
		t.Fatalf("body %s", rec.Body.String())
	}
	if body["time_zone"] != "Asia/Tokyo" {
		t.Fatalf("time_zone %v", body["time_zone"])
	}
	if body["avatar_url"] != nil {
		t.Fatalf("avatar_url %v", body["avatar_url"])
	}
}

func TestMeUpdatesTimeZone(t *testing.T) {
	user := persistUser(t, "tz@example.com", "g-tz", "Taro")
	rec := do(http.MethodPatch, "/api/me", `{"time_zone":"America/New_York"}`, authHeader(t, user))
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	if jsonBody(t, rec)["time_zone"] != "America/New_York" {
		t.Fatalf("body %s", rec.Body.String())
	}
}

func TestMeRejectsUnknownTimeZone(t *testing.T) {
	user := persistUser(t, "badtz@example.com", "g-badtz", "Taro")
	rec := do(http.MethodPatch, "/api/me", `{"time_zone":"Not/AZone"}`, authHeader(t, user))
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
}

func TestMeRequiresAuthentication(t *testing.T) {
	rec := do(http.MethodGet, "/api/me", "", nil)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status %d", rec.Code)
	}
}
