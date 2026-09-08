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
	if body["avatar_url"] != nil {
		t.Fatalf("avatar_url %v", body["avatar_url"])
	}
}

func TestMeRequiresAuthentication(t *testing.T) {
	rec := do(http.MethodGet, "/api/me", "", nil)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status %d", rec.Code)
	}
}
