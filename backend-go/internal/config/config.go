package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Port           string
	DatabaseURL    string
	JWTSecret      string
	AccessTokenTTL time.Duration
	GoogleClientID string
	FrontendOrigin string
	CookieSecure   bool
	CookieSameSite string
	MailHost       string
	MailPort       string
	RateLimit      RateLimit
}

type RateLimit struct {
	Enabled                bool
	LoginPerMinute         int
	RefreshPerMinute       int
	RequestsPerFiveMinutes int
}

func Load() (Config, error) {
	cfg := Config{
		Port:           env("PORT", "8081"),
		JWTSecret:      env("JWT_SECRET", "dev-only-change-me-use-32bytes!!"),
		AccessTokenTTL: 15 * time.Minute,
		GoogleClientID: env("GOOGLE_CLIENT_ID", ""),
		FrontendOrigin: env("FRONTEND_ORIGIN", "http://localhost:5173"),
		CookieSecure:   envBool("COOKIE_SECURE", false),
		CookieSameSite: env("COOKIE_SAME_SITE", "Strict"),
		MailHost:       env("MAIL_HOST", "127.0.0.1"),
		MailPort:       env("MAIL_PORT", "1025"),
		RateLimit: RateLimit{
			Enabled:                envBool("RATE_LIMIT_ENABLED", true),
			LoginPerMinute:         10,
			RefreshPerMinute:       30,
			RequestsPerFiveMinutes: 300,
		},
	}
	if url := os.Getenv("DATABASE_URL"); url != "" {
		cfg.DatabaseURL = url
	} else {
		cfg.DatabaseURL = fmt.Sprintf(
			"postgres://%s:%s@%s:%s/%s?sslmode=disable",
			env("DB_USERNAME", "postgres"),
			env("DB_PASSWORD", "postgres"),
			env("DB_HOST", "localhost"),
			env("DB_PORT", "5432"),
			env("DB_NAME", "calendar_go"),
		)
	}
	if len(cfg.JWTSecret) < 32 {
		return Config{}, fmt.Errorf("JWT_SECRET must be at least 32 bytes")
	}
	return cfg, nil
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envBool(key string, fallback bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return fallback
	}
	return b
}

func SameSite(mode string) string {
	switch strings.ToLower(mode) {
	case "lax":
		return "Lax"
	case "none":
		return "None"
	default:
		return "Strict"
	}
}
