package httpapi

import (
	"net/http"
	"testing"
)

func TestCorsReflectsConfiguredOrigin(t *testing.T) {
	rec := do(http.MethodGet, "/api/me", "", map[string]string{
		"Origin":        "http://localhost:5173",
		"Authorization": "Bearer bogus",
	})
	if rec.Header().Get("Access-Control-Allow-Origin") != "http://localhost:5173" {
		t.Fatalf("headers %v", rec.Header())
	}
}

func TestCorsRejectsUnknownOrigin(t *testing.T) {
	rec := do(http.MethodGet, "/api/me", "", map[string]string{
		"Origin":        "http://evil.example.com",
		"Authorization": "Bearer bogus",
	})
	if rec.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatalf("headers %v", rec.Header())
	}
}

func TestCorsAllowsCredentialsOnAuthRoutes(t *testing.T) {
	stubInvalidGoogle()
	rec := do(http.MethodPost, "/api/auth/login", `{"id_token":"x"}`, map[string]string{
		"Origin": "http://localhost:5173",
	})
	if rec.Header().Get("Access-Control-Allow-Origin") != "http://localhost:5173" {
		t.Fatalf("origin %s", rec.Header().Get("Access-Control-Allow-Origin"))
	}
	if rec.Header().Get("Access-Control-Allow-Credentials") != "true" {
		t.Fatalf("credentials %s", rec.Header().Get("Access-Control-Allow-Credentials"))
	}
}

func TestCorsDoesNotAllowCredentialsOnNonAuthApi(t *testing.T) {
	rec := do(http.MethodGet, "/api/me", "", map[string]string{
		"Origin":        "http://localhost:5173",
		"Authorization": "Bearer bogus",
	})
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status %d", rec.Code)
	}
	if rec.Header().Get("Access-Control-Allow-Credentials") != "" {
		t.Fatalf("credentials set: %v", rec.Header())
	}
}
