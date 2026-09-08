package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"

	"github.com/youdeee/calendar-rails-react/backend-go/internal/auth"
	"github.com/youdeee/calendar-rails-react/backend-go/internal/config"
	"github.com/youdeee/calendar-rails-react/backend-go/internal/db"
	"github.com/youdeee/calendar-rails-react/backend-go/internal/event"
)

var (
	testH   *harness
	userSeq atomic.Int64
)

type harness struct {
	handler http.Handler
	auth    *auth.Service
	q       *db.Queries
	google  *stubGoogle
}

type stubGoogle struct {
	mu sync.Mutex
	fn func(context.Context, string) (auth.Profile, error)
}

func (s *stubGoogle) Verify(ctx context.Context, idToken string) (auth.Profile, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.fn == nil {
		return auth.Profile{}, auth.ErrInvalidGoogleToken
	}
	return s.fn(ctx, idToken)
}

func (s *stubGoogle) set(fn func(context.Context, string) (auth.Profile, error)) {
	s.mu.Lock()
	s.fn = fn
	s.mu.Unlock()
}

func TestMain(m *testing.M) {
	ctx := context.Background()
	url := os.Getenv("TEST_DATABASE_URL")
	var terminate func()
	if url == "" {
		var err error
		url, terminate, err = startPostgres(ctx)
		if err != nil {
			os.Stderr.WriteString("postgres: " + err.Error() + "\n")
			os.Exit(1)
		}
	}
	pool, err := db.Connect(ctx, url)
	if err != nil {
		os.Stderr.WriteString("connect: " + err.Error() + "\n")
		os.Exit(1)
	}
	q := db.New(pool)
	google := &stubGoogle{}
	cfg := testConfig()
	authSvc := auth.NewService(q, google, cfg.JWTSecret, cfg.AccessTokenTTL)
	testH = &harness{
		handler: New(cfg, authSvc, event.NewService(q)).Handler(),
		auth:    authSvc,
		q:       q,
		google:  google,
	}
	code := m.Run()
	pool.Close()
	if terminate != nil {
		terminate()
	}
	os.Exit(code)
}

func testConfig() config.Config {
	return config.Config{
		JWTSecret:      "dev-only-change-me-use-32bytes!!",
		AccessTokenTTL: 15 * time.Minute,
		FrontendOrigin: "http://localhost:5173",
		CookieSameSite: "Strict",
		RateLimit: config.RateLimit{
			Enabled:                true,
			LoginPerMinute:         10,
			RefreshPerMinute:       30,
			RequestsPerFiveMinutes: 300,
		},
	}
}

func startPostgres(ctx context.Context) (string, func(), error) {
	container, err := postgres.Run(ctx,
		"postgres:16-alpine",
		postgres.WithDatabase("calendar_go"),
		postgres.WithUsername("postgres"),
		postgres.WithPassword("postgres"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").WithOccurrence(2).WithStartupTimeout(60*time.Second),
		),
	)
	if err != nil {
		return "", nil, err
	}
	url, err := container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		_ = container.Terminate(ctx)
		return "", nil, err
	}
	return url, func() { _ = container.Terminate(context.Background()) }, nil
}

func do(method, path, body string, header map[string]string, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	var r io.Reader
	if body != "" {
		r = bytes.NewBufferString(body)
	}
	req := httptest.NewRequest(method, path, r)
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	for k, v := range header {
		req.Header.Set(k, v)
	}
	for _, c := range cookies {
		req.AddCookie(c)
	}
	rec := httptest.NewRecorder()
	testH.handler.ServeHTTP(rec, req)
	return rec
}

func stubValidGoogle() {
	testH.google.set(func(context.Context, string) (auth.Profile, error) {
		return auth.Profile{
			GoogleUID:     "google-1",
			Email:         "a@example.com",
			EmailVerified: true,
			Name:          "Taro",
			Picture:       "https://example.com/a.png",
		}, nil
	})
}

func stubInvalidGoogle() {
	testH.google.set(func(context.Context, string) (auth.Profile, error) {
		return auth.Profile{}, auth.ErrInvalidGoogleToken
	})
}

func persistUser(t *testing.T, email, googleUID, name string) auth.User {
	t.Helper()
	now := time.Now().UTC()
	row, err := testH.q.InsertUser(context.Background(), db.InsertUserParams{
		Email:     email,
		GoogleUid: googleUID,
		Name:      name,
		CreatedAt: now,
		UpdatedAt: now,
	})
	if err != nil {
		t.Fatal(err)
	}
	return auth.User{ID: row.ID, Email: row.Email, GoogleUID: row.GoogleUid, Name: row.Name, AvatarURL: row.AvatarUrl}
}

func persistRandomUser(t *testing.T) auth.User {
	t.Helper()
	suffix := fmt.Sprintf("%d", userSeq.Add(1))
	return persistUser(t, suffix+"@example.com", "g-"+suffix, "Taro")
}

func bearer(t *testing.T, user auth.User) string {
	t.Helper()
	tok, err := testH.auth.Encode(user.ID)
	if err != nil {
		t.Fatal(err)
	}
	return "Bearer " + tok
}

func authHeader(t *testing.T, user auth.User) map[string]string {
	t.Helper()
	return map[string]string{"Authorization": bearer(t, user)}
}

func loginRefreshCookie(t *testing.T) *http.Cookie {
	t.Helper()
	stubValidGoogle()
	rec := do(http.MethodPost, "/api/auth/login", `{"id_token":"valid"}`, nil)
	for _, c := range rec.Result().Cookies() {
		if c.Name == refreshCookie {
			return c
		}
	}
	t.Fatalf("missing refresh cookie, status=%d body=%s", rec.Code, rec.Body.String())
	return nil
}

func jsonBody(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var v map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &v); err != nil {
		t.Fatalf("%v: %s", err, rec.Body.String())
	}
	return v
}

func jsonArray(t *testing.T, rec *httptest.ResponseRecorder) []any {
	t.Helper()
	var v []any
	if err := json.Unmarshal(rec.Body.Bytes(), &v); err != nil {
		t.Fatalf("%v: %s", err, rec.Body.String())
	}
	return v
}
