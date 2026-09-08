# calendar_rails_vite

Rails 8.1 API backend + Vite/React frontend. Deployed on Render (backend), Vercel (frontend), and Neon (Postgres).

## Local development

1. Start Postgres: `docker compose up -d db`
2. Backend:
   ```
   cd backend
   bundle install
   bin/rails db:prepare
   bundle exec rails server
   ```
3. Frontend:
   ```
   cd frontend
   npm install
   npm run dev
   ```

## Java / Spring Boot backend (study)

Rails は残したまま、学習用の第2バックエンドが `backend-java/` にあります。API 契約は Rails 互換です。

1. Postgres: `docker compose up -d db`
2. DB 作成（既存ボリュームの場合）: `docker compose exec db createdb -U postgres calendar_java || true`
3. `cd backend-java && ./mvnw spring-boot:run`（ポート 8080）
4. フロント: `VITE_API_PROXY_TARGET=http://localhost:8080 npm run dev`

詳細は `backend-java/README.md`。

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

## Frontend environment variables

| Var | Default | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | empty | relative paths via the Vite dev proxy locally; set to the deployed backend's absolute URL in production (also added to CSP `connect-src` at Vite build time—redeploy after changing) |
| `VITE_GOOGLE_CLIENT_ID` | — | Google Sign-In |

See `docs/superpowers/specs/2026-08-10-vercel-render-neon-deploy-design.md` for the full deployment design.
