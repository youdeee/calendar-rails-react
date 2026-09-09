# Go / calendar API (study twin)

Rails 互換のカレンダー API を Go で再実装した学習用バックエンドです。既存の `frontend/` は無改修で繋げます。

## 必要環境

- Go 1.22+
- Postgres 16（リポジトリ直下の `docker compose up -d db`）

初回だけ Go 用 DB を作ります（compose の init はボリューム新規作成時のみ実行されます）:

```
docker compose exec db createdb -U postgres calendar_go || true
```

## 起動

```
cd backend-go
go run ./cmd/api
```

既定ポートは `8081`。プロセス内で毎分リマインダーをスイープし、Mailpit（SMTP `127.0.0.1:1025`）へ送ります。フロントを繋ぐときは Vite の proxy 先を切り替えます:

```
cd frontend
VITE_API_PROXY_TARGET=http://localhost:8081 npm run dev
```

## 環境変数

| Var | Default | Notes |
|---|---|---|
| `PORT` | `8081` | |
| `DB_HOST` | `localhost` | |
| `DB_PORT` | `5432` | |
| `DB_NAME` | `calendar_go` | Rails / Java とは別 DB |
| `DB_USERNAME` | `postgres` | |
| `DB_PASSWORD` | `postgres` | |
| `DATABASE_URL` | — | セット時は上の DB_* より優先 |
| `JWT_SECRET` | 開発用ダミー | 32 バイト以上 |
| `GOOGLE_CLIENT_ID` | empty | Google Sign-In |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | CORS |
| `COOKIE_SECURE` | `false` | 本番は `true` |
| `COOKIE_SAME_SITE` | `Strict` | 本番（別ドメイン）は `None` |
| `MAIL_HOST` | `127.0.0.1` | Mailpit SMTP |
| `MAIL_PORT` | `1025` | |

## テスト

```
go test ./...
```

Postgres は Testcontainers（`postgres:16-alpine`）を使います。Docker が必要です。`TEST_DATABASE_URL` をセットした場合はそれを使います。
