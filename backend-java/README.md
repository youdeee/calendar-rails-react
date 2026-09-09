# Java / Spring Boot backend (study twin)

Rails 互換のカレンダー API を Spring Boot で再実装した学習用バックエンドです。既存の `frontend/` は無改修で繋げます。

## 必要環境

- JDK 21
- Postgres 16（リポジトリ直下の `docker compose up -d db`）
- リマインダーメールを見るときだけ Mailpit: `docker compose up -d mailpit`

初回だけ Java 用 DB を作ります（compose の init はボリューム新規作成時のみ実行されます）:

```
docker compose exec db createdb -U postgres calendar_java || true
```

## 起動

```
cd backend-java
cp .env.example .env   # 必要なら
./mvnw spring-boot:run
```

既定ポートは `8080`。プロセス内で毎分リマインダーをスイープし、Mailpit（SMTP `127.0.0.1:1025`）へ送ります。フロントを繋ぐときは Vite の proxy 先を切り替えます:

```
cd frontend
VITE_API_PROXY_TARGET=http://localhost:8080 npm run dev
```

## 環境変数

| Var | Default | Notes |
|---|---|---|
| `DB_HOST` | `localhost` | |
| `DB_PORT` | `5432` | |
| `DB_NAME` | `calendar_java` | Rails の `calendar_development` とは別 DB |
| `DB_USERNAME` | `postgres` | |
| `DB_PASSWORD` | `postgres` | |
| `JWT_SECRET` | 開発用ダミー | 本番は 32 バイト以上 |
| `GOOGLE_CLIENT_ID` | empty | Google Sign-In |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | CORS |
| `COOKIE_SECURE` | `false` | 本番は `true` |
| `COOKIE_SAME_SITE` | `Strict` | 本番（別ドメイン）は `None` |

## テスト

```
./mvnw verify
```

Postgres は Testcontainers（`postgres:16-alpine`）を使います。Docker が必要です。
