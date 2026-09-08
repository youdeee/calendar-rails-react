package httpapi

import (
	"net/http"
	"testing"
)

func TestThrottlesLoginAfterTenRequestsPerMinute(t *testing.T) {
	stubInvalidGoogle()
	hdr := map[string]string{"X-Forwarded-For": "10.0.0.1"}
	for i := 0; i < 10; i++ {
		rec := do(http.MethodPost, "/api/auth/login", `{"id_token":"x"}`, hdr)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("i=%d status %d", i, rec.Code)
		}
	}
	rec := do(http.MethodPost, "/api/auth/login", `{"id_token":"x"}`, hdr)
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
}

func TestThrottlesAnyEndpointAfter300RequestsPerFiveMinutes(t *testing.T) {
	hdr := map[string]string{"X-Forwarded-For": "10.0.0.2"}
	for i := 0; i < 300; i++ {
		rec := do(http.MethodGet, "/up", "", hdr)
		if rec.Code != http.StatusOK {
			t.Fatalf("i=%d status %d", i, rec.Code)
		}
	}
	rec := do(http.MethodGet, "/up", "", hdr)
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("status %d", rec.Code)
	}
}
