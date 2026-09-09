package httpapi

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/youdeee/calendar-rails-react/backend-go/internal/auth"
	"github.com/youdeee/calendar-rails-react/backend-go/internal/config"
)

const (
	refreshCookie     = "refresh_token"
	refreshCookiePath = "/api/auth"
	refreshMaxAge     = 30 * 24 * 60 * 60
)

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IDToken *string `json:"id_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err != io.EOF {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	if body.IDToken == nil || *body.IDToken == "" {
		writeError(w, http.StatusBadRequest, "param is missing or the value is empty: id_token")
		return
	}
	session, err := s.auth.Login(r.Context(), *body.IDToken)
	if err != nil {
		handleErr(w, err)
		return
	}
	s.writeRefreshCookie(w, session.RawRefreshToken, refreshMaxAge)
	writeJSON(w, http.StatusCreated, toAuthJSON(session))
}

func (s *Server) refresh(w http.ResponseWriter, r *http.Request) {
	raw, _ := r.Cookie(refreshCookie)
	token := ""
	if raw != nil {
		token = raw.Value
	}
	session, err := s.auth.Refresh(r.Context(), token)
	if err != nil {
		handleErr(w, err)
		return
	}
	s.writeRefreshCookie(w, session.RawRefreshToken, refreshMaxAge)
	writeJSON(w, http.StatusOK, toAuthJSON(session))
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	raw, _ := r.Cookie(refreshCookie)
	token := ""
	if raw != nil {
		token = raw.Value
	}
	if err := s.auth.Logout(r.Context(), token); err != nil {
		handleErr(w, err)
		return
	}
	s.writeRefreshCookie(w, "", -1)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	user := userFrom(r.Context())
	writeJSON(w, http.StatusOK, toUserJSON(user))
}

func toAuthJSON(session auth.Session) authJSON {
	return authJSON{AccessToken: session.AccessToken, User: toUserJSON(session.User)}
}

func toUserJSON(user auth.User) userJSON {
	return userJSON{ID: user.ID, Email: user.Email, Name: user.Name, AvatarURL: user.AvatarURL, TimeZone: user.TimeZone}
}

func (s *Server) updateMe(w http.ResponseWriter, r *http.Request) {
	var body struct {
		TimeZone *string `json:"time_zone"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err != io.EOF {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	if body.TimeZone == nil || *body.TimeZone == "" {
		writeError(w, http.StatusBadRequest, "param is missing or the value is empty: time_zone")
		return
	}
	user, err := s.auth.UpdateTimeZone(r.Context(), userFrom(r.Context()).ID, *body.TimeZone)
	if err != nil {
		handleErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toUserJSON(user))
}

func (s *Server) writeRefreshCookie(w http.ResponseWriter, value string, maxAge int) {
	sameSite := http.SameSiteStrictMode
	switch config.SameSite(s.cfg.CookieSameSite) {
	case "Lax":
		sameSite = http.SameSiteLaxMode
	case "None":
		sameSite = http.SameSiteNoneMode
	}
	http.SetCookie(w, &http.Cookie{
		Name:     refreshCookie,
		Value:    value,
		Path:     refreshCookiePath,
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   s.cfg.CookieSecure,
		SameSite: sameSite,
	})
}
