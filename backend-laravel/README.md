# Laravel backend (study twin)

Rails 互換のカレンダー API を Laravel で再実装した学習用バックエンドです。既存の `frontend/` は無改修で繋げます。

## 必要環境

- PHP 8.3+
- Composer
- Postgres 16（リポジトリ直下の `docker compose up -d db`）

初回だけ Laravel 用 DB を作ります（compose の init はボリューム新規作成時のみ実行されます）:

```
docker compose exec db createdb -U postgres calendar_laravel || true
```

## 起動

```
cd backend-laravel
cp .env.example .env
composer install
php artisan key:generate
php artisan migrate
php artisan serve --port=8082
```

既定ポートは `8082`。`php artisan schedule:work` で毎分リマインダーをスイープし、Mailpit（SMTP `127.0.0.1:1025`）へ送ります。フロントを繋ぐときは Vite の proxy 先を切り替えます:

```
cd frontend
VITE_API_PROXY_TARGET=http://localhost:8082 npm run dev
```

## 環境変数

| Var | Default | Notes |
|---|---|---|
| `DB_HOST` | `127.0.0.1` | |
| `DB_PORT` | `5432` | |
| `DB_DATABASE` | `calendar_laravel` | Rails / Java / Go とは別 DB |
| `DB_USERNAME` | `postgres` | |
| `DB_PASSWORD` | `postgres` | |
| `JWT_SECRET` | 開発用ダミー | 32 バイト以上 |
| `GOOGLE_CLIENT_ID` | empty | Google Sign-In |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | CORS |
| `COOKIE_SECURE` | `false` | 本番は `true` |
| `COOKIE_SAME_SITE` | `strict` | 本番（別ドメイン）は `none` |

## テスト

```
php artisan test
```

テストは SQLite インメモリを使います。
