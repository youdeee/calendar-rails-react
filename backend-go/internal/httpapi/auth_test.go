package httpapi

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/youdeee/calendar-rails-react/backend-go/internal/auth"
)

func TestLoginCreatesSession(t *testing.T) {
	stubValidGoogle()
	rec := do(http.MethodPost, "/api/auth/login", `{"id_token":"valid"}`, nil)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	body := jsonBody(t, rec)
	if body["access_token"] == nil || body["access_token"] == "" {
		t.Fatalf("missing access_token: %s", rec.Body.String())
	}
	user := body["user"].(map[string]any)
	if user["email"] != "a@example.com" {
		t.Fatalf("email %v", user["email"])
	}
	c := cookieNamed(rec, refreshCookie)
	if c == nil || !c.HttpOnly || c.Path != refreshCookiePath {
		t.Fatalf("cookie %+v", c)
	}
}

func TestLoginRejectsInvalidGoogleToken(t *testing.T) {
	stubInvalidGoogle()
	rec := do(http.MethodPost, "/api/auth/login", `{"id_token":"bad"}`, nil)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status %d", rec.Code)
	}
	if jsonBody(t, rec)["error"].(map[string]any)["message"] != "Invalid Google token" {
		t.Fatalf("body %s", rec.Body.String())
	}
}

func TestLoginRejectsUnverifiedEmail(t *testing.T) {
	testH.google.set(func(ctx context.Context, id string) (auth.Profile, error) {
		return auth.Profile{GoogleUID: "google-1", Email: "a@example.com", EmailVerified: false, Name: "Taro"}, nil
	})
	rec := do(http.MethodPost, "/api/auth/login", `{"id_token":"valid"}`, nil)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
}

func TestLogoutRevokesRefreshToken(t *testing.T) {
	c := loginRefreshCookie(t)
	rec := do(http.MethodDelete, "/api/auth/logout", "", nil, c)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status %d", rec.Code)
	}
	rec = do(http.MethodPost, "/api/auth/refresh", "", nil, c)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status %d", rec.Code)
	}
}

func TestLogoutWithoutCookieIsNoContent(t *testing.T) {
	rec := do(http.MethodDelete, "/api/auth/logout", "", nil)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status %d", rec.Code)
	}
}

func TestRefreshRotatesToken(t *testing.T) {
	original := loginRefreshCookie(t)
	rec := do(http.MethodPost, "/api/auth/refresh", "", nil, original)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	rotated := cookieNamed(rec, refreshCookie)
	if rotated == nil || rotated.Value == original.Value {
		t.Fatalf("cookie not rotated")
	}
	rec = do(http.MethodPost, "/api/auth/refresh", "", nil, rotated)
	if rec.Code != http.StatusOK {
		t.Fatalf("second refresh %d", rec.Code)
	}
}

func TestReusedRefreshTokenRevokesFamily(t *testing.T) {
	original := loginRefreshCookie(t)
	rec := do(http.MethodPost, "/api/auth/refresh", "", nil, original)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d", rec.Code)
	}
	rotated := cookieNamed(rec, refreshCookie)
	rec = do(http.MethodPost, "/api/auth/refresh", "", nil, original)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("reuse status %d", rec.Code)
	}
	rec = do(http.MethodPost, "/api/auth/refresh", "", nil, rotated)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("family status %d body %s", rec.Code, rec.Body.String())
	}
}

func TestRefreshWithoutCookieIsUnauthorized(t *testing.T) {
	rec := do(http.MethodPost, "/api/auth/refresh", "", nil)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status %d", rec.Code)
	}
}

func cookieNamed(rec *httptest.ResponseRecorder, name string) *http.Cookie {
	for _, c := range rec.Result().Cookies() {
		if c.Name == name {
			return c
		}
	}
	return nil
}
