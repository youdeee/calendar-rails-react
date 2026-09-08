package httpapi

import (
	"context"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/youdeee/calendar-rails-react/backend-go/internal/auth"
	"github.com/youdeee/calendar-rails-react/backend-go/internal/config"
)

func contextWithUser(ctx context.Context, user auth.User) context.Context {
	return context.WithValue(ctx, userCtxKey, user)
}

func userFrom(ctx context.Context) auth.User {
	user, _ := ctx.Value(userCtxKey).(auth.User)
	return user
}

func (s *Server) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == s.cfg.FrontendOrigin {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "*")
			if strings.HasPrefix(r.URL.Path, "/api/auth/") {
				w.Header().Set("Access-Control-Allow-Credentials", "true")
			}
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

type rateLimiter struct {
	cfg     config.RateLimit
	mu      sync.Mutex
	windows map[string]*window
}

type window struct {
	startMillis int64
	count       int
}

func newRateLimiter(cfg config.RateLimit) *rateLimiter {
	return &rateLimiter{cfg: cfg, windows: map[string]*window{}}
}

func (l *rateLimiter) wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !l.cfg.Enabled {
			next.ServeHTTP(w, r)
			return
		}
		ip := clientIP(r)
		allowed := l.allow("all:"+ip, l.cfg.RequestsPerFiveMinutes, 5*time.Minute)
		if r.Method == http.MethodPost && r.URL.Path == "/api/auth/login" {
			allowed = l.allow("login:"+ip, l.cfg.LoginPerMinute, time.Minute) && allowed
		}
		if r.Method == http.MethodPost && r.URL.Path == "/api/auth/refresh" {
			allowed = l.allow("refresh:"+ip, l.cfg.RefreshPerMinute, time.Minute) && allowed
		}
		if !allowed {
			writeError(w, http.StatusTooManyRequests, "Too Many Requests")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (l *rateLimiter) allow(key string, limit int, period time.Duration) bool {
	now := time.Now().UnixMilli()
	l.mu.Lock()
	defer l.mu.Unlock()
	existing := l.windows[key]
	if existing == nil || now-existing.startMillis >= period.Milliseconds() {
		l.windows[key] = &window{startMillis: now, count: 1}
		return 1 <= limit
	}
	existing.count++
	return existing.count <= limit
}

func clientIP(r *http.Request) string {
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		return strings.TrimSpace(strings.Split(forwarded, ",")[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
