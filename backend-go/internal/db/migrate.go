package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/golang-migrate/migrate/v4"
	pgxmigrate "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"

	"github.com/youdeee/calendar-rails-react/backend-go/migrations"
)

func Connect(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, err
	}
	cfg.ConnConfig.RuntimeParams["timezone"] = "UTC"
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	pingCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, err
	}
	if err := Migrate(databaseURL); err != nil {
		pool.Close()
		return nil, err
	}
	return pool, nil
}

func Migrate(databaseURL string) error {
	src, err := iofs.New(migrations.FS, ".")
	if err != nil {
		return err
	}
	std, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return err
	}
	defer std.Close()
	driver, err := pgxmigrate.WithInstance(std, &pgxmigrate.Config{})
	if err != nil {
		return err
	}
	m, err := migrate.NewWithInstance("iofs", src, "pgx", driver)
	if err != nil {
		return err
	}
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("migrate: %w", err)
	}
	return nil
}
