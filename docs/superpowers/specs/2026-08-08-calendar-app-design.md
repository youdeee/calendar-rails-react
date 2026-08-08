# カレンダーアプリ 設計書

## 目的

Google Calendarライクなカレンダーアプリを、Rails API + React SPA構成で構築する。作者はRailsをメインに就職活動中で、5年のブランクがあるフロントエンドの復習を目的としている。本プロジェクトはポートフォリオ・学習用であり、実運用のユーザーを想定した高負荷対応や本格的な監視は対象外とする。

## 技術選定の背景

Rails求人の傾向を調査した結果、企業規模・フロントエンド専任体制の有無で構成が分かれる。中小・受託系はvite_railsなどによるモノリシック構成、成長中の自社開発SaaS系はRails APIモード + React SPAが主流で、フロントエンドチームが育つとNext.js化が進む傾向がある(SmartHRの事例)。

学習目的(モダンフロントエンドのエコシステムを一通り触る)と求人適合性の両面から、**Rails APIモード + Vite/React SPA(TypeScript)** を採用する。Next.jsは対象アプリが認証必須の非公開ツールでありSSR/SEOの恩恵が薄いこと、学習コストが素のSPAと別の思考モデルを要求することから、MVPでは採用しない。React SPAのロジック(hooks・コンポーネント)はNext.js移行時にも再利用できるため、拡張の余地は残る。

## 全体アーキテクチャ

- **バックエンド**: `backend/` — Rails 7, `--api` モードで新規作成
- **フロントエンド**: `frontend/` — Vite + React + TypeScript
- **開発時**: Vite dev server (`:5173`) のproxy機能で `/api/*` をRails (`:3000`) に転送
- **本番**: JWT認証採用により同一オリジン制約がないため、フロントエンドは静的ホスティング(Vercel/Netlify等)、APIはRailsホスティング(Render/Fly.io等)に分けて配置可能。CORSはoriginの許可リストのみで足り、`credentials: true` は不要

## 認証設計

Google認証のみをサポートする(自前パスワード認証は実装しない)。

### データモデル

`RefreshToken`: `id, user_id, token_digest, expires_at, revoked_at`

### フロー

1. フロントエンドはGoogle Identity Services(JS SDK)でGoogleのIDトークンを取得し、`POST /api/sessions` に送信
2. RailsはIDトークンをサーバー側で検証(`googleauth` gem)し、`User` を作成/特定する
3. **アクセストークン**(JWT、有効期限15分)をレスポンスボディで返却。フロントエンドはこれをメモリ(AuthContext)にのみ保持し、`Authorization: Bearer` ヘッダーで送信する
4. **リフレッシュトークン**(有効期限30日)を発行しDBに保存、`httpOnly, Secure, SameSite=Strict` Cookieとして返す。Cookieのpathは `/api/token/refresh` に限定し、通常のAPI呼び出しには付与されないようにする
5. フロントエンドはアプリ起動時、および401受信時に `POST /api/token/refresh` を呼ぶ(リフレッシュCookieは自動送信される)。Railsは`RefreshToken`をDBで検証(期限切れ/revoked済みでないか)し、新しいアクセストークンを返しつつリフレッシュトークンをローテーション(古いものをrevoked扱いにし新規発行)する
6. `DELETE /api/sessions` — リフレッシュトークンをDB側でrevokeしCookieを削除する

リフレッシュトークン用Cookieの用途を再発行エンドポイント1つに限定しているため、`SameSite=Strict` のみで実用上十分なCSRF耐性を持つ(全APIにCookieが自動付与される通常のセッション方式よりも攻撃面が小さい)。

フロントエンドの `api/client.ts` は、401を受けたら自動的に `/api/token/refresh` を呼んでリトライする処理を持つ。

## MVP機能スコープ

- 予定のCRUD(作成・編集・削除)
- 月表示・週表示・日表示の切り替え
- ドラッグ&ドロップによる予定の日付変更(月表示のみが対象。週/日表示での時間ドラッグは将来拡張)。**繰り返し予定はドラッグ対象外**とする(1回分だけ日付を変えるという「例外編集」に相当し、シリーズ全体を動かすと直感に反するため。単発予定のみドラッグ可能)
- 繰り返し予定(毎日/毎週/毎月等)。編集・削除は常にシリーズ全体に適用し、個別回のみの編集(例外日設定)は将来拡張とする
- 複数カレンダー(色分け・表示切替)は将来拡張とする

## データモデル

**User**: `id, email, google_uid, name, avatar_url`

**Event**: `id, user_id, title, description, start_at, end_at, all_day, recurrence_rule`

繰り返し予定は `ice_cube` gemの `IceCube::Rule` をシリアライズして `recurrence_rule` に保存する。個別の発生回はDBに保存せず、表示範囲ごとにサーバー側で展開する(`occurrences_between`)。

## APIエンドポイント

- `POST /api/sessions` — Google IDトークンでログイン
- `POST /api/token/refresh` — アクセストークン再発行(リフレッシュトークンローテーション)
- `DELETE /api/sessions` — ログアウト(リフレッシュトークンをrevoke)
- `GET /api/me` — ログインユーザー取得
- `GET /api/events?from=&to=` — 期間内の予定一覧(繰り返しは展開済みで返す)
- `POST /api/events` — 予定作成(繰り返しルール指定可)
- `PATCH /api/events/:id` — 予定更新。ドラッグ&ドロップによる日付変更も本エンドポイントで`start_at`/`end_at`を更新する形で扱う
- `DELETE /api/events/:id` — 予定削除(繰り返し予定はシリーズ全体を削除)

## フロントエンド構成

ルーティングライブラリは使用しない(月/週/日の切り替えはローカルstateで管理)。featureごとにディレクトリを分ける。

```
src/
  api/client.ts          # fetch wrapper。Authorizationヘッダー付与、401時の自動refresh&リトライ
  features/auth/         # GoogleLoginButton, AuthContext, useCurrentUser (TanStack Query)
  features/calendar/     # MonthView, WeekView, DayView, ViewSwitcher
  features/events/       # EventFormModal, EventCard(dnd-kitでドラッグ可能), useEvents/useCreateEvent等のhooks
```

- **データ取得/Cache**: TanStack Query
- **スタイリング**: Tailwind CSS
- **ドラッグ&ドロップ**: `@dnd-kit/core`(react-beautiful-dndは開発停止のため不採用)

## エラーハンドリング

- **Rails**: `rescue_from` で `{ error: { message } }` 形式に統一。401(未認証)・422(バリデーションエラー)を適切なステータスコードで返す
- **フロントエンド**: TanStack Queryの `isError` でinlineエラー表示。401を受けたリクエストは `api/client.ts` のインターセプターがrefreshを試行し、refreshも失敗した場合はログイン画面に戻す

## テスト方針

- **バックエンド**: RSpec request specs(sessions・token・events各コントローラの正常系・認証エラー・バリデーションエラー)
- **フロントエンド**: Vitest + React Testing Library を主要ロジック(イベントフォームのバリデーション、繰り返し予定の表示、DnDによる日付更新)に絞って追加する。学習用プロジェクトのため網羅率は追わない

## スコープ外(将来拡張)

- Next.js化
- 複数カレンダー(色分け・表示切替)
- 繰り返し予定の個別回編集(例外日)
- 週/日表示での時間ドラッグ
- 本番運用向けの監視・負荷対策
