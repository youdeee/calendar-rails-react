# Vercel / Render / Neon デプロイ設計

## 背景

現状構成:
- `backend/`: Rails 8.1 API専用アプリ（Ruby 3.4.7）。DBはSQLite3。Google IDトークン検証 + JWT（access token）+ Cookie（refresh token）による認証。CORSは`FRONTEND_ORIGIN`環境変数で既に対応済み。ActiveStorage・バックグラウンドジョブ・Redisは未使用。
- `frontend/`: React 19 + Vite + TypeScriptのSPA。ルーティングライブラリなし（単一ページ）。

これを以下の構成でデプロイする。

- フロントエンド → **Vercel**
- バックエンド → **Render**（Webサービス1個。ジョブ・Action Cable未使用のため追加ワーカーやRedisは不要）
- DB → **Neon**（Postgres。開発・テスト・本番すべてPostgresに統一）
- ローカル開発用DB → docker-composeのPostgresコンテナ

## クロスオリジン方針

`backend/app/controllers/auth_controller.rb`のrefresh cookie設定に、フロントとAPIが別ドメイン運用（Vercel/Netlify想定）である前提で`same_site: :none`（本番時）とするコメント付き実装が既に存在する。つまりこのアプリは「フロントから絶対URLでバックエンドAPIを直接叩くクロスオリジン構成」を前提に設計済み。

一方、フロントの`api/client.ts`は現状すべて相対パス（`/api/...`）でfetchしており、開発時のViteプロキシ（`vite.config.ts`）頼みになっている。本番でVercel/Renderが別ドメインになるとこのままでは動かないため、`VITE_API_BASE_URL`環境変数からの絶対URLを使うよう最小限修正する。

Vercelのrewriteでバックエンドをプロキシし同一オリジンに見せる代替案もあるが、既存のCookie設計（`SameSite: :none`前提）と逆行するため採用しない。

## 変更ファイル一覧

| ファイル | 内容 |
|---|---|
| `backend/Gemfile` | `sqlite3` → `pg` |
| `backend/config/database.yml` | 全環境`postgresql`化。本番は`DATABASE_URL`（Neon）、開発/テストは個別ENV（docker-composeのデフォルト値にフォールバック） |
| `backend/.env.example` | DB接続用ENVを追記 |
| `docker-compose.yml`（リポジトリルート新規） | ローカルPostgresコンテナ（database.ymlのdevelopment/testデフォルト値と一致させる） |
| `render.yaml`（リポジトリルート新規） | Render Blueprint。Webサービス1個、ビルドコマンド、デプロイ前マイグレーション、起動コマンドを定義 |
| `frontend/src/api/client.ts` | `VITE_API_BASE_URL`が設定されていれば絶対URLをプレフィックス、未設定なら現状通り相対パス（開発時はViteプロキシのまま動く） |
| `frontend/.env.example` | `VITE_API_BASE_URL`を追記 |

## 環境変数

**Render（バックエンド）**
- `RAILS_MASTER_KEY`
- `DATABASE_URL`（Neon発行の接続文字列）
- `FRONTEND_ORIGIN`（VercelのURL、例: `https://xxx.vercel.app`）
- `GOOGLE_CLIENT_ID`

**Vercel（フロントエンド）**
- `VITE_API_BASE_URL`（RenderのURL、例: `https://xxx.onrender.com`）
- `VITE_GOOGLE_CLIENT_ID`

## スコープ外（ユーザーがダッシュボードで行う手動作業）

設定ファイルの準備のみが本タスクの対象。以下はユーザー側の実施事項。

1. **Neon**: プロジェクト作成 → 接続文字列（`DATABASE_URL`）を取得
2. **Render**: リポジトリを接続 → `render.yaml`をBlueprintとして読み込み（Sync）→ `RAILS_MASTER_KEY` / `DATABASE_URL` / `FRONTEND_ORIGIN` / `GOOGLE_CLIENT_ID`をダッシュボードのシークレットとして登録
3. **Vercel**: プロジェクト作成 → Root Directoryを`frontend`に設定 → `VITE_API_BASE_URL` / `VITE_GOOGLE_CLIENT_ID`を環境変数に登録
4. デプロイ後、RenderのURLが確定したら`FRONTEND_ORIGIN`（Render側）と`VITE_API_BASE_URL`（Vercel側）を実URLで相互に更新

## テスト方針

- `backend`: `database.yml`変更後、既存のrspecスイートがPostgres（docker-compose起動済み）で通ることを確認（新規テストは不要、DBアダプタ変更のみのため）
- `frontend`: `api/client.ts`の絶対URLプレフィックス処理に対する単体テストを追加（`VITE_API_BASE_URL`あり/なしの2パターン）
