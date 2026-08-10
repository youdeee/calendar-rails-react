# Vercel / Render / Neon デプロイ設定 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vercel（フロントエンド）/ Render（バックエンド）/ Neon（DB）にデプロイできるよう、設定ファイル一式（DBアダプタ切り替え、ローカルPostgres、Render Blueprint、クロスオリジンAPI呼び出し対応）を用意する。

**Architecture:** バックエンドはSQLite3からPostgreSQLへ切り替え（開発・テスト・本番を統一）、ローカル開発はdocker-composeのPostgresコンテナで再現する。フロントエンドは既存の相対パスfetchを維持しつつ、`VITE_API_BASE_URL`が設定されている場合のみ絶対URLへ変換するヘルパーを追加し、本番（Vercel⇄Render間のクロスオリジン）でも開発（Viteプロキシ）でも同じコードで動くようにする。Renderへのデプロイは`render.yaml`のBlueprintで完結させる。

**Tech Stack:** Rails 8.1 / Ruby 3.4.7 / PostgreSQL（pg gem）/ Docker Compose / React 19 + Vite + TypeScript / Vitest

## Global Constraints

- 実際のVercel/Render/Neonダッシュボード上の操作（アカウント作成、環境変数登録、Blueprint Sync等）はスコープ外。設定ファイルの用意のみを行う。
- 開発・テスト・本番すべてPostgresに統一する（SQLiteは残さない）。
- ローカルPostgresはdocker-composeで用意する。
- `backend/.env.example` と `frontend/.env.example` は権限設定によりRead/Edit不可のため変更しない。必要な環境変数は本計画のタスク内コメントとコミットメッセージ、および既存の設計書（`docs/superpowers/specs/2026-08-10-vercel-render-neon-deploy-design.md`）に記載済みとする。
- バックグラウンドジョブ・Redis・Action Cableは未使用のため、Render側に追加サービスは作らない（Webサービス1個のみ）。

---

### Task 1: ローカルPostgresのdocker-compose

**Files:**
- Create: `docker-compose.yml`（リポジトリルート）

**Interfaces:**
- Produces: `localhost:5432`でリッスンするPostgres（ユーザー`postgres`、パスワード`postgres`）。Task 2の`database.yml`はこの認証情報をデフォルト値として使う。

- [ ] **Step 1: docker-compose.ymlを作成**

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  db_data:
```

- [ ] **Step 2: コンテナが起動し健全になることを確認**

Run: `docker compose up -d db && sleep 3 && docker compose ps`
Expected: `db`サービスの`STATUS`列が`healthy`と表示される

- [ ] **Step 3: コンテナを停止**

Run: `docker compose down`
Expected: 正常終了（エラーなし）

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: add docker-compose for local Postgres"
```

---

### Task 2: バックエンドをPostgreSQLへ切り替え

**Files:**
- Modify: `backend/Gemfile`
- Modify: `backend/config/database.yml`
- Test: 既存の `backend/spec/` 一式（新規テストは追加しない — アダプタ切り替えのみで振る舞いは変わらないため、既存スイートの通過をもって検証する）

**Interfaces:**
- Consumes: Task 1で起動した`localhost:5432`のPostgres（ユーザー/パスワード `postgres`/`postgres`）
- Produces: `production`環境は`DATABASE_URL`環境変数（Neonの接続文字列）からPostgresに接続する構成。Task 4の`render.yaml`はこの`DATABASE_URL`環境変数を前提にする。

- [ ] **Step 1: Gemfileのsqlite3をpgへ置き換え**

`backend/Gemfile`の以下の2行を:

```ruby
# Use sqlite3 as the database for Active Record
gem "sqlite3", ">= 1.4"
```

以下に置き換える:

```ruby
# Use PostgreSQL as the database for Active Record
gem "pg", "~> 1.5"
```

- [ ] **Step 2: database.ymlを全環境Postgres化**

`backend/config/database.yml`を以下の内容に全面置き換え:

```yaml
default: &default
  adapter: postgresql
  encoding: unicode
  pool: <%= ENV.fetch("RAILS_MAX_THREADS") { 5 } %>
  host: <%= ENV.fetch("DB_HOST", "localhost") %>
  port: <%= ENV.fetch("DB_PORT", 5432) %>
  username: <%= ENV.fetch("DB_USERNAME", "postgres") %>
  password: <%= ENV.fetch("DB_PASSWORD", "postgres") %>

development:
  <<: *default
  database: calendar_development

test:
  <<: *default
  database: calendar_test

# Neon接続文字列（DATABASE_URL）をそのまま使う。Neonの接続文字列には
# sslmode=require が含まれているため個別のSSL設定は不要。
production:
  url: <%= ENV["DATABASE_URL"] %>
```

- [ ] **Step 3: 依存関係を更新**

Run: `cd backend && bundle install`
Expected: 正常終了し、`Gemfile.lock`から`sqlite3`が消え`pg`が追加される

- [ ] **Step 4: ローカルPostgresを起動しテスト用DBを準備**

Run: `docker compose up -d db && cd backend && bin/rails db:prepare RAILS_ENV=test`
Expected: `Created database`のようなログの後、エラーなく完了する

- [ ] **Step 5: 既存テストスイートを実行し全て通ることを確認**

Run: `cd backend && bundle exec rspec`
Expected: PASS（failuresが0件。SQLite時点と同じ結果になることを確認）

- [ ] **Step 6: コンテナを停止**

Run: `docker compose down`

- [ ] **Step 7: Commit**

```bash
git add backend/Gemfile backend/Gemfile.lock backend/config/database.yml
git commit -m "feat(backend): switch database adapter from SQLite to PostgreSQL"
```

---

### Task 3: フロントエンドのクロスオリジンAPIベースURL対応

**Files:**
- Modify: `frontend/src/api/client.ts`
- Test: `frontend/src/api/client.test.ts`

**Interfaces:**
- Produces: `export function apiUrl(path: string, baseUrl?: string): string` — `baseUrl`省略時は`import.meta.env.VITE_API_BASE_URL`（未設定なら空文字）を使う。空文字なら`path`をそのまま返す（相対パス、開発時のViteプロキシ互換）。値があれば`${baseUrl}${path}`を返す。

- [ ] **Step 1: 失敗するテストを書く**

`frontend/src/api/client.test.ts`の先頭importに`apiUrl`を追加:

```ts
import { apiFetch, apiRequest, apiUrl, setAccessToken, setUnauthorizedHandler, ApiError } from "./client";
```

ファイル末尾に以下を追記:

```ts

describe("apiUrl", () => {
  it("leaves the path unchanged when no base URL is configured", () => {
    expect(apiUrl("/api/events", "")).toBe("/api/events");
  });

  it("prefixes the path with the configured base URL", () => {
    expect(apiUrl("/api/events", "https://api.example.com")).toBe("https://api.example.com/api/events");
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd frontend && npx vitest run src/api/client.test.ts`
Expected: FAIL（`apiUrl` is not exported / not defined）

- [ ] **Step 3: apiUrlを実装しfetch呼び出しに適用**

`frontend/src/api/client.ts`の先頭（`let accessToken: string | null = null;`の直前）に追加:

```ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export function apiUrl(path: string, baseUrl: string = API_BASE_URL): string {
  return `${baseUrl}${path}`;
}
```

`refreshAccessToken`内の`fetch("/api/auth/refresh", ...)`を:

```ts
const response = await fetch(apiUrl("/api/auth/refresh"), { method: "POST", credentials: "include" });
```

に変更。

`fetchWithAuth`内の`fetch(path, {...})`を:

```ts
const response = await fetch(apiUrl(path), {
  ...options,
  headers,
  credentials: isAuthEndpoint ? "include" : "same-origin",
});
```

に変更。

- [ ] **Step 4: テストが通ることを確認**

Run: `cd frontend && npx vitest run src/api/client.test.ts`
Expected: PASS（新規2件を含め全件成功。既存テストは`VITE_API_BASE_URL`未設定時 = `apiUrl`が素通しのため、変更なしで通り続ける）

- [ ] **Step 5: フロントの全テストスイートを実行し回帰がないことを確認**

Run: `cd frontend && npm test`
Expected: PASS（全件成功）

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/api/client.test.ts
git commit -m "feat(frontend): support absolute API base URL for cross-origin deploys"
```

---

### Task 4: Render Blueprint

**Files:**
- Create: `render.yaml`（リポジトリルート）

**Interfaces:**
- Consumes: Task 2で確立した`DATABASE_URL`環境変数によるPostgres接続
- Produces: Renderダッシュボードで「Blueprint」としてSyncできるWebサービス定義

- [ ] **Step 1: render.yamlを作成**

```yaml
services:
  - type: web
    name: calendar-backend
    runtime: ruby
    rootDir: backend
    plan: free
    buildCommand: bundle install
    preDeployCommand: bundle exec rails db:migrate
    startCommand: bundle exec puma -C config/puma.rb
    envVars:
      - key: RAILS_ENV
        value: production
      - key: RAILS_MASTER_KEY
        sync: false
      - key: DATABASE_URL
        sync: false
      - key: FRONTEND_ORIGIN
        sync: false
      - key: GOOGLE_CLIENT_ID
        sync: false
```

`sync: false`の4項目はRenderダッシュボード側でシークレットとして手動登録する値（Blueprintには値を含めない）。

- [ ] **Step 2: YAML構文が正しいことを確認**

Run: `ruby -ryaml -e "YAML.load_file('render.yaml') and puts 'OK'"`
Expected: `OK`と出力される（構文エラーなし）

- [ ] **Step 3: Commit**

```bash
git add render.yaml
git commit -m "chore: add Render blueprint for backend deploy"
```

---

## Self-Review Notes

- **Spec coverage:** design specの変更ファイル一覧7件のうち、`backend/.env.example`と`frontend/.env.example`はGlobal Constraintsに記載の通り権限制約で対象外とした（実質的な必要環境変数はrender.yamlのenvVarsキーとdesign specに明記済みのため機能上の欠落はない）。残り5件（Gemfile, database.yml, docker-compose.yml, render.yaml, api/client.ts）は全てTask 1〜4でカバー。
- **Placeholder scan:** 全ステップに具体的なコード・コマンド・期待結果を記載済み。「後で実装」「適切なエラーハンドリングを追加」等のプレースホルダーなし。
- **Type consistency:** `apiUrl(path: string, baseUrl?: string): string`はTask 3のStep 1（テスト）とStep 3（実装）で一致。
