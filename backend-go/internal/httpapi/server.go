package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/youdeee/calendar-rails-react/backend-go/internal/auth"
	"github.com/youdeee/calendar-rails-react/backend-go/internal/config"
	"github.com/youdeee/calendar-rails-react/backend-go/internal/event"
)

type ctxKey int

const userCtxKey ctxKey = 1

type Server struct {
	cfg    config.Config
	auth   *auth.Service
	events *event.Service
	limit  *rateLimiter
}

func New(cfg config.Config, authSvc *auth.Service, events *event.Service) *Server {
	return &Server{cfg: cfg, auth: authSvc, events: events, limit: newRateLimiter(cfg.RateLimit)}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /up", s.health)
	mux.HandleFunc("POST /api/auth/login", s.login)
	mux.HandleFunc("POST /api/auth/refresh", s.refresh)
	mux.HandleFunc("DELETE /api/auth/logout", s.logout)
	mux.Handle("GET /api/me", s.requireAuth(s.me))
	mux.Handle("PATCH /api/me", s.requireAuth(s.updateMe))
	mux.Handle("GET /api/events", s.requireAuth(s.listEvents))
	mux.Handle("POST /api/events", s.requireAuth(s.createEvent))
	mux.Handle("PATCH /api/events/{id}", s.requireAuth(s.updateEvent))
	mux.Handle("DELETE /api/events/{id}", s.requireAuth(s.deleteEvent))
	return s.limit.wrap(s.cors(mux))
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok"))
}

func (s *Server) requireAuth(next http.HandlerFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			writeError(w, http.StatusUnauthorized, "Unauthorized")
			return
		}
		id, err := s.auth.ParseUserID(strings.TrimPrefix(header, "Bearer "))
		if err != nil {
			writeError(w, http.StatusUnauthorized, "Unauthorized")
			return
		}
		user, err := s.auth.UserByID(r.Context(), id)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "Unauthorized")
			return
		}
		ctx := contextWithUser(r.Context(), user)
		next(w, r.WithContext(ctx))
	})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(body)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]any{
		"error": map[string]string{"message": message},
	})
}

func handleErr(w http.ResponseWriter, err error) {
	if err == nil {
		return
	}
	switch {
	case errors.Is(err, auth.ErrUnauthorized):
		writeError(w, http.StatusUnauthorized, auth.ErrUnauthorized.Error())
	case errors.Is(err, auth.ErrInvalidGoogleToken):
		writeError(w, http.StatusUnauthorized, auth.ErrInvalidGoogleToken.Error())
	case errors.Is(err, event.ErrNotFound):
		writeError(w, http.StatusNotFound, event.ErrNotFound.Error())
	default:
		var authAPI auth.APIError
		if errors.As(err, &authAPI) {
			writeError(w, authAPI.Status, authAPI.Message)
			return
		}
		var api event.APIError
		if errors.As(err, &api) {
			writeError(w, api.Status, api.Message)
			return
		}
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
	}
}

func parseID(r *http.Request) (int64, error) {
	return strconv.ParseInt(r.PathValue("id"), 10, 64)
}
