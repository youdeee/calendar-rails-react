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

`token_digest` にはDBレベルのunique indexを設定する。

### フロー

1. フロントエンドはGoogle Identity Services(JS SDK)でGoogleのIDトークンを取得し、`POST /api/sessions` に送信
2. RailsはIDトークンをサーバー側で検証(`googleauth` gem)し、`User` を作成/特定する
3. **アクセストークン**(JWT、有効期限15分)をレスポンスボディで返却。フロントエンドはこれをメモリ(AuthContext)にのみ保持し、`Authorization: Bearer` ヘッダーで送信する
4. **リフレッシュトークン**(有効期限30日)を発行しDBに保存、`httpOnly, Secure, SameSite=Strict` Cookieとして返す。Cookieのpathは `/api/token/refresh` に限定し、通常のAPI呼び出しには付与されないようにする
5. フロントエンドはアプリ起動時、および401受信時に `POST /api/token/refresh` を呼ぶ(リフレッシュCookieは自動送信される)。Railsは`RefreshToken`をDBで検証(期限切れ/revoked済みでないか)し、新しいアクセストークンを返しつつリフレッシュトークンをローテーション(古いものをrevoked扱いにし新規発行)する
6. `DELETE /api/sessions` — リフレッシュトークンをDB側でrevokeしCookieを削除する

リフレッシュトークン用Cookieの用途を再発行エンドポイント1つに限定しているため、`SameSite=Strict` のみで実用上十分なCSRF耐性を持つ(全APIにCookieが自動付与される通常のセッション方式よりも攻撃面が小さい)。

フロントエンドの `api/client.ts` は、401を受けたら自動的に `/api/token/refresh` を呼んでリトライする処理を持つ。

### 認証まわりのセキュリティ対策

- **JWTアルゴリズム固定**: 署名はHS256固定とし、デコード時に許可アルゴリズムを明示指定する(`alg: none` 等のアルゴリズム混同攻撃を防ぐ)
- **リフレッシュトークンの再利用検知**: revoked済みのリフレッシュトークンが再度使われた場合はトークン窃取の兆候とみなし、該当ユーザーの全リフレッシュトークンを一括revokeする(強制全端末ログアウト)
- **Google IDトークン検証**: 署名・audience(自アプリのClient ID)・issuerに加えて `email_verified` クレームも確認し、未検証メールでのアカウント作成を防ぐ
- **レート制限**: `POST /api/sessions`・`POST /api/token/refresh` に `rack-attack` 等でブルートフォース/DoS対策を入れる
- **Cookie設定**: `secure` フラグは `Rails.env.production?` で環境分岐する(固定だとローカル開発のhttp環境でCookieが送られない)
- **ログ出力対策**: `config.filter_parameters` に `id_token`・`access_token`・`refresh_token` を追加し、トークン類がRailsログに残らないようにする

## MVP機能スコープ

- 予定のCRUD(作成・編集・削除)
- 月表示・週表示・日表示の切り替え
- ドラッグ&ドロップによる予定の日付変更(月表示のみが対象。週/日表示での時間ドラッグは将来拡張)。**繰り返し予定はドラッグ対象外**とする(1回分だけ日付を変えるという「例外編集」に相当し、シリーズ全体を動かすと直感に反するため。単発予定のみドラッグ可能)
- 繰り返し予定(毎日/毎週/毎月等)。編集・削除は常にシリーズ全体に適用し、個別回のみの編集(例外日設定)は将来拡張とする
- 複数カレンダー(色分け・表示切替)は将来拡張とする

## データモデル

**User**: `id, email, google_uid, name, avatar_url`

- `email`・`google_uid` にはDBレベルのunique indexを設定する(同時リクエストによる重複ユーザー作成を防ぐ)
- `avatar_url` はGoogleが返すURLをそのまま `<img>` タグで表示するのみとし、サーバー側で画像を取得・加工する処理は行わない(将来そうした機能を追加する場合はSSRF対策が別途必要)

**Event**: `id, user_id, title, description, start_at, end_at, all_day, recurrence_rule`

- `title`・`description` には文字数上限のバリデーションを設ける(大量データ投入によるDB肥大化・表示崩れの防止)

繰り返し予定は `ice_cube` gemの `IceCube::Rule` をシリアライズして `recurrence_rule` に保存する。個別の発生回はDBに保存せず、表示範囲ごとにサーバー側で展開する(`occurrences_between`)。

**セキュリティ上の注意**: クライアントからは `frequency`(daily/weekly/monthly)・`interval`・`until` のような**構造化・バリデーション済みパラメータのみ**を受け取り、`IceCube::Rule` はRails側で毎回構築する。クライアントから受け取った生のシリアライズ済みルール文字列をそのまま `YAML.load` で復元することはしない(任意オブジェクト生成につながる既知の脆弱性クラスのため)。DB保存時のシリアライズもJSON形式、または安全な範囲に限定したYAMLロードを用いる。`frequency` は許可された列挙値のみ、`interval` は正の整数のみを受け付け、異常な値による計算負荷や無限ループ相当の挙動を防ぐ。

## APIエンドポイント

- `POST /api/sessions` — Google IDトークンでログイン
- `POST /api/token/refresh` — アクセストークン再発行(リフレッシュトークンローテーション)
- `DELETE /api/sessions` — ログアウト(リフレッシュトークンをrevoke)
- `GET /api/me` — ログインユーザー取得
- `GET /api/events?from=&to=` — 期間内の予定一覧(繰り返しは展開済みで返す)。`from`/`to` は日付フォーマットを検証し、取得可能な期間に上限(例: 最大3ヶ月)を設ける(極端に広い範囲を指定した繰り返し予定の展開によるDoSを防ぐ)
- `POST /api/events` — 予定作成(繰り返しルール指定可)
- `PATCH /api/events/:id` — 予定更新。ドラッグ&ドロップによる日付変更も本エンドポイントで`start_at`/`end_at`を更新する形で扱う
- `DELETE /api/events/:id` — 予定削除(繰り返し予定はシリーズ全体を削除)

`events` 系エンドポイントは全て `current_user.events` 経由でスコープし、他ユーザーの予定IDを指定された場合は404を返す(IDOR対策)。

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

## 防御多層化

- **CORS**: originを許可リストで明示指定し、ワイルドカード(`*`)は使わない
- **CSP(Content-Security-Policy)**: Google Identity Servicesのスクリプトドメインのみ許可し、XSS発生時の被害を限定する。`frame-ancestors 'none'` を設定しクリックジャッキングを防ぐ
- **HTTPS強制**: 本番環境で `force_ssl` を有効にする
- **依存関係の脆弱性チェック**: `bundler-audit`(Ruby gem)・`npm audit`(フロントエンド)を定期的に実行する運用にする

## テスト方針

- **バックエンド**: RSpec request specs(sessions・token・events各コントローラの正常系・認証エラー・バリデーションエラー)
- **フロントエンド**: Vitest + React Testing Library を主要ロジック(イベントフォームのバリデーション、繰り返し予定の表示、DnDによる日付更新)に絞って追加する。学習用プロジェクトのため網羅率は追わない

## スコープ外(将来拡張)

- Next.js化
- 複数カレンダー(色分け・表示切替)
- 繰り返し予定の個別回編集(例外日)
- 週/日表示での時間ドラッグ
- 本番運用向けの監視・負荷対策
