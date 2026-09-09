package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/youdeee/calendar-rails-react/backend-go/internal/auth"
	"github.com/youdeee/calendar-rails-react/backend-go/internal/config"
	"github.com/youdeee/calendar-rails-react/backend-go/internal/db"
	"github.com/youdeee/calendar-rails-react/backend-go/internal/event"
	"github.com/youdeee/calendar-rails-react/backend-go/internal/httpapi"
)

func main() {
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, nil)))
	cfg, err := config.Load()
	if err != nil {
		slog.Error("config", "err", err)
		os.Exit(1)
	}
	ctx := context.Background()
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("database", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	q := db.New(pool)
	authSvc := auth.NewService(q, auth.NewGoogleVerifier(cfg), cfg.JWTSecret, cfg.AccessTokenTTL)
	mailer := event.SMTPMailer{Addr: cfg.MailHost + ":" + cfg.MailPort}
	events := event.NewService(q, mailer)
	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           httpapi.New(cfg, authSvc, events).Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	runCtx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				if err := events.Dispatch(context.Background(), nil, time.Now().UTC()); err != nil {
					slog.Error("reminders", "err", err)
				}
			case <-runCtx.Done():
				return
			}
		}
	}()

	go func() {
		slog.Info("listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server", "err", err)
			os.Exit(1)
		}
	}()

	<-runCtx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
}
