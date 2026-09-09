# calendar_rails_vite

Rails 8.1 API backend + Vite/React frontend. Deployed on Render (backend), Vercel (frontend), and Neon (Postgres).

## Local development

1. Start Postgres, Redis, and Mailpit: `docker compose up -d db redis mailpit`
2. Backend:
   ```
   cd backend
   bundle install
   bin/rails db:prepare
   bundle exec rails server
   ```
3. Sidekiq (another terminal; required for reminder emails):
   ```
   cd backend
   bundle exec sidekiq
   ```
4. Frontend:
   ```
   cd frontend
   npm install
   npm run dev
   ```
5. Reminder emails appear in Mailpit: http://localhost:8025

## Java / Spring Boot backend (study)

Rails は残したまま、学習用の第2バックエンドが `backend-java/` にあります。API 契約は Rails 互換です。

1. Postgres: `docker compose up -d db`
2. DB 作成（既存ボリュームの場合）: `docker compose exec db createdb -U postgres calendar_java || true`
3. `cd backend-java && ./mvnw spring-boot:run`（ポート 8080）
4. フロント: `VITE_API_PROXY_TARGET=http://localhost:8080 npm run dev`

詳細は `backend-java/README.md`。

## Go backend (study)

Rails / Java は残したまま、学習用の第3バックエンドが `backend-go/` にあります。API 契約は Rails 互換です。

1. Postgres: `docker compose up -d db`
2. DB 作成（既存ボリュームの場合）: `docker compose exec db createdb -U postgres calendar_go || true`
3. `cd backend-go && go run ./cmd/api`（ポート 8081）
4. フロント: `VITE_API_PROXY_TARGET=http://localhost:8081 npm run dev`

詳細は `backend-go/README.md`。

## Laravel backend (study)

Rails / Java / Go は残したまま、学習用の第4バックエンドが `backend-laravel/` にあります。API 契約は Rails 互換です。

1. Postgres: `docker compose up -d db`
2. DB 作成（既存ボリュームの場合）: `docker compose exec db createdb -U postgres calendar_laravel || true`
3. `cd backend-laravel && composer install && php artisan key:generate && php artisan migrate && php artisan serve --port=8082`
4. フロント: `VITE_API_PROXY_TARGET=http://localhost:8082 npm run dev`

詳細は `backend-laravel/README.md`。

## Backend environment variables

| Var | Default | Notes |
|---|---|---|
| `DB_HOST` | `localhost` | matches `docker-compose.yml` |
| `DB_PORT` | `5432` | matches `docker-compose.yml` |
| `DB_USERNAME` | `postgres` | matches `docker-compose.yml` |
| `DB_PASSWORD` | `postgres` | matches `docker-compose.yml` |
| `DATABASE_URL` | — | production only; Neon connection string |
| `FRONTEND_ORIGIN` | — | allowed CORS origin |
| `GOOGLE_CLIENT_ID` | — | Google Sign-In |
| `REDIS_URL` | `redis://127.0.0.1:6379/0` | Sidekiq (local) |

## Frontend environment variables

| Var | Default | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | empty | relative paths via the Vite dev proxy locally; set to the deployed backend's absolute URL in production (also added to CSP `connect-src` at Vite build time—redeploy after changing) |
| `VITE_GOOGLE_CLIENT_ID` | — | Google Sign-In |

See `docs/superpowers/specs/2026-08-10-vercel-render-neon-deploy-design.md` for the full deployment design.
