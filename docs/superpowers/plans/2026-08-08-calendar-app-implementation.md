# カレンダーアプリ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Google Calendarライクなカレンダーアプリを、Rails APIモード(バックエンド) + Vite/React/TypeScript(フロントエンド)の分離構成で構築する。

**Architecture:** `backend/`にRails 8 APIモード、`frontend/`にVite+React+TypeScriptを別々に用意する。認証はGoogle IDトークン検証 → JWTアクセストークン(メモリ保持,15分)+ リフレッシュトークン(httpOnly Cookie, DB管理, 30日, ローテーション)。開発時はViteのdev server proxyで`/api/*`をRailsに転送する。

**Tech Stack:** Rails 8 (API mode, SQLite3), RSpec, `jwt` gem, `googleauth` gem, `ice_cube` gem, `rack-attack`, `rack-cors` / Vite, React, TypeScript, TanStack Query, Tailwind CSS, `@dnd-kit/core`, Vitest + React Testing Library

## Global Constraints

- Rails 8、`--api`モードで新規作成。DBはSQLite3(学習用ポートフォリオのためセットアップを軽くする)
- ルーティングライブラリは使わない(月/週/日切り替えはローカルstate)
- データ取得/CacheはTanStack Query、スタイリングはTailwind CSS、DnDは`@dnd-kit/core`
- JWTアクセストークン: HS256固定、有効期限15分、フロントはメモリ保持のみ(localStorage/sessionStorageに保存しない)
- リフレッシュトークン: 有効期限30日、DBに`token_digest`で保存(生トークンは保存しない)、`httpOnly, Secure(本番のみ), SameSite=Strict`Cookie、Cookie pathは`/api/auth`に限定(ログイン/ログアウト/リフレッシュの3エンドポイントを`/api/auth`配下にまとめ、`/api/events`等の通常API呼び出しにはCookieが付与されないようにする。設計書では`/api/sessions`・`/api/token/refresh`という命名だったが、ログアウトがリフレッシュCookieを読む必要があるため両エンドポイントを1つの共通パス配下に置く実装上の調整を行った)、使用のたびローテーション、再利用検知で該当ユーザーの全トークンrevoke
- `User.email`・`User.google_uid`・`RefreshToken.token_digest`にDBレベルのunique index
- `Event.title`・`Event.description`に文字数上限バリデーション
- 繰り返し予定はクライアントから`frequency`(daily/weekly/monthly の列挙値のみ)・`interval`(正の整数のみ)・`until`の構造化パラメータのみを受け取り、Rails側で`IceCube::Rule`を毎回構築する。生のシリアライズ済みルールをクライアントから受け取ったり`YAML.load`で復元したりしない
- `GET /api/events`の`from`/`to`は日付フォーマットを検証し、取得可能期間は最大3ヶ月に制限する
- `events`系エンドポイントは全て`current_user.events`経由でスコープ(IDOR対策)。他ユーザーの予定IDは404
- `POST /api/sessions`・`POST /api/token/refresh`に`rack-attack`でレート制限
- CORSはoriginを許可リストで明示(ワイルドカード禁止)。CSPで`frame-ancestors 'none'`。本番は`force_ssl`
- `config.filter_parameters`に`id_token`・`access_token`・`refresh_token`を追加
- シークレット(JWT署名鍵等)はRails credentials/ENV管理。`master.key`・`.env`系は`.gitignore`対象で絶対にコミットしない
- ControllerはStrong Parametersで許可属性を明示する
- フロントの秘密情報は`VITE_`prefixを使わない(ビルド成果物に埋め込まれ公開されるため)。`title`/`description`表示は`dangerouslySetInnerHTML`を使わずReact標準エスケープに任せる
- ドラッグ&ドロップは月表示のみ・単発予定のみ対象(繰り返し予定はドラッグ不可)
- 繰り返し予定の編集・削除は常にシリーズ全体に適用(個別回編集は対象外)
- テスト: バックエンドはRSpec request specs、フロントエンドはVitest + React Testing Libraryを主要ロジックのみに絞る。FactoryBot等の追加テスト用gemは使わず、`User.create!`等の素のActiveRecordで十分に賄う

---

## Task 1: Rails APIアプリの雛形作成

**Files:**
- Create: `backend/`(rails new一式)
- Modify: `backend/Gemfile`
- Modify: `backend/config/application.rb`

**Interfaces:**
- Produces: `backend/`配下で動くRails APIアプリ、`bundle exec rspec`が実行可能な状態

- [ ] **Step 1: Railsアプリを新規作成する**

```bash
cd /Users/takahashiyuudai/workspace/rails_projects/calendar_rails_vite
rails new backend --api -T
```

- [ ] **Step 2: 必要なgemをGemfileに追加する**

`backend/Gemfile`に以下を追記:

```ruby
gem "rack-cors"
gem "jwt"
gem "googleauth"
gem "ice_cube"
gem "rack-attack"

group :development, :test do
  gem "rspec-rails"
end

group :development do
  gem "bundler-audit", require: false
end
```

- [ ] **Step 3: bundle installする**

```bash
cd backend && bundle install
```

- [ ] **Step 4: RSpecをインストールする**

```bash
cd backend && bundle exec rails generate rspec:install
```

- [ ] **Step 5: フィルタパラメータを設定する**

`backend/config/initializers/filter_parameter_logging.rb`を編集:

```ruby
Rails.application.config.filter_parameters += [
  :passw, :email, :secret, :token, :_key, :crypt, :salt, :certificate, :otp, :ssn,
  :id_token, :access_token, :refresh_token
]
```

- [ ] **Step 6: サーバーが起動しRSpecが実行できることを確認する**

Run: `cd backend && bundle exec rspec`
Expected: `0 examples, 0 failures`

- [ ] **Step 7: Commit**

```bash
cd /Users/takahashiyuudai/workspace/rails_projects/calendar_rails_vite
git add backend
git commit -m "feat(backend): scaffold Rails API app with core gems"
```

---

## Task 2: Userモデル

**Files:**
- Create: `backend/db/migrate/XXXX_create_users.rb`
- Create: `backend/app/models/user.rb`
- Test: `backend/spec/models/user_spec.rb`

**Interfaces:**
- Produces: `User`モデル。カラム`email:string, google_uid:string, name:string, avatar_url:string`。`email`・`google_uid`はDBレベルunique、モデルレベルpresence/uniqueness validation。`User.find_or_create_from_google!(payload)`クラスメソッド(payloadは`{sub:, email:, email_verified:, name:, picture:}`のHash)を提供し、`email_verified`が`false`の場合は`ArgumentError`を発生させる。

- [ ] **Step 1: マイグレーションを作成する**

```bash
cd backend && bundle exec rails generate migration CreateUsers email:string google_uid:string name:string avatar_url:string
```

生成されたマイグレーションファイルを以下の内容に編集する(unique index追加のため):

```ruby
class CreateUsers < ActiveRecord::Migration[7.1]
  def change
    create_table :users do |t|
      t.string :email, null: false
      t.string :google_uid, null: false
      t.string :name, null: false
      t.string :avatar_url

      t.timestamps
    end
    add_index :users, :email, unique: true
    add_index :users, :google_uid, unique: true
  end
end
```

- [ ] **Step 2: マイグレーションを実行する**

```bash
cd backend && bundle exec rails db:migrate
```

- [ ] **Step 3: 失敗するテストを書く**

`backend/spec/models/user_spec.rb`:

```ruby
require "rails_helper"

RSpec.describe User, type: :model do
  it "is valid with email, google_uid, name" do
    user = User.new(email: "a@example.com", google_uid: "google-1", name: "Taro")
    expect(user).to be_valid
  end

  it "requires a unique email" do
    User.create!(email: "dup@example.com", google_uid: "g-1", name: "A")
    dup = User.new(email: "dup@example.com", google_uid: "g-2", name: "B")
    expect(dup).not_to be_valid
  end

  it "requires a unique google_uid" do
    User.create!(email: "u1@example.com", google_uid: "dup-uid", name: "A")
    dup = User.new(email: "u2@example.com", google_uid: "dup-uid", name: "B")
    expect(dup).not_to be_valid
  end

  describe ".find_or_create_from_google!" do
    let(:payload) do
      { "sub" => "google-123", "email" => "new@example.com", "email_verified" => true,
        "name" => "New User", "picture" => "https://example.com/a.png" }
    end

    it "creates a new user from a verified Google payload" do
      user = User.find_or_create_from_google!(payload)
      expect(user).to be_persisted
      expect(user.email).to eq("new@example.com")
      expect(user.google_uid).to eq("google-123")
    end

    it "returns the existing user on subsequent calls" do
      first = User.find_or_create_from_google!(payload)
      second = User.find_or_create_from_google!(payload)
      expect(second.id).to eq(first.id)
    end

    it "raises when email_verified is false" do
      payload["email_verified"] = false
      expect { User.find_or_create_from_google!(payload) }.to raise_error(ArgumentError)
    end
  end
end
```

- [ ] **Step 4: テストが失敗することを確認する**

Run: `cd backend && bundle exec rspec spec/models/user_spec.rb`
Expected: FAIL (`User`にvalidationも`find_or_create_from_google!`もまだ無いため)

- [ ] **Step 5: Userモデルを実装する**

`backend/app/models/user.rb`:

```ruby
class User < ApplicationRecord
  has_many :events, dependent: :destroy
  has_many :refresh_tokens, dependent: :destroy

  validates :email, presence: true, uniqueness: true
  validates :google_uid, presence: true, uniqueness: true
  validates :name, presence: true

  def self.find_or_create_from_google!(payload)
    raise ArgumentError, "email not verified" unless payload["email_verified"]

    find_or_create_by!(google_uid: payload["sub"]) do |user|
      user.email = payload["email"]
      user.name = payload["name"]
      user.avatar_url = payload["picture"]
    end
  end
end
```

- [ ] **Step 6: テストが通ることを確認する**

Run: `cd backend && bundle exec rspec spec/models/user_spec.rb`
Expected: PASS (6 examples, 0 failures)

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/user.rb backend/db/migrate backend/db/schema.rb backend/spec/models/user_spec.rb
git commit -m "feat(backend): add User model with Google account provisioning"
```

---

## Task 3: RefreshTokenモデル(ローテーション・再利用検知)

**Files:**
- Create: `backend/db/migrate/XXXX_create_refresh_tokens.rb`
- Create: `backend/app/models/refresh_token.rb`
- Test: `backend/spec/models/refresh_token_spec.rb`

**Interfaces:**
- Consumes: `User`(Task 2)
- Produces: `RefreshToken.issue!(user)` → `[raw_token, record]`を返す。`RefreshToken.authenticate(raw_token)` → 有効なら`RefreshToken`を、無効/期限切れ/再利用検知なら`nil`を返す。`record.revoke!`でrevoked_atを設定。

- [ ] **Step 1: マイグレーションを作成する**

```bash
cd backend && bundle exec rails generate migration CreateRefreshTokens
```

`backend/db/migrate/XXXX_create_refresh_tokens.rb`を編集:

```ruby
class CreateRefreshTokens < ActiveRecord::Migration[7.1]
  def change
    create_table :refresh_tokens do |t|
      t.references :user, null: false, foreign_key: true
      t.string :token_digest, null: false
      t.datetime :expires_at, null: false
      t.datetime :revoked_at

      t.timestamps
    end
    add_index :refresh_tokens, :token_digest, unique: true
  end
end
```

- [ ] **Step 2: マイグレーションを実行する**

```bash
cd backend && bundle exec rails db:migrate
```

- [ ] **Step 3: 失敗するテストを書く**

`backend/spec/models/refresh_token_spec.rb`:

```ruby
require "rails_helper"

RSpec.describe RefreshToken, type: :model do
  let(:user) { User.create!(email: "a@example.com", google_uid: "g-1", name: "Taro") }

  describe ".issue!" do
    it "returns a raw token and persists only its digest" do
      raw_token, record = RefreshToken.issue!(user)
      expect(raw_token).to be_a(String)
      expect(record.token_digest).to eq(RefreshToken.digest(raw_token))
      expect(record.token_digest).not_to eq(raw_token)
      expect(record.expires_at).to be_within(1.minute).of(30.days.from_now)
    end
  end

  describe ".authenticate" do
    it "returns the record for a valid raw token" do
      raw_token, record = RefreshToken.issue!(user)
      expect(RefreshToken.authenticate(raw_token).id).to eq(record.id)
    end

    it "returns nil for an unknown token" do
      expect(RefreshToken.authenticate("bogus")).to be_nil
    end

    it "returns nil for an expired token" do
      raw_token, record = RefreshToken.issue!(user)
      record.update!(expires_at: 1.day.ago)
      expect(RefreshToken.authenticate(raw_token)).to be_nil
    end

    it "revokes the whole token family when a revoked token is reused" do
      raw_token, record = RefreshToken.issue!(user)
      _other_raw, other_record = RefreshToken.issue!(user)
      record.revoke!

      expect(RefreshToken.authenticate(raw_token)).to be_nil
      expect(other_record.reload.revoked_at).not_to be_nil
    end
  end

  describe "#revoke!" do
    it "sets revoked_at" do
      _raw_token, record = RefreshToken.issue!(user)
      expect { record.revoke! }.to change { record.revoked_at }.from(nil)
    end
  end
end
```

- [ ] **Step 4: テストが失敗することを確認する**

Run: `cd backend && bundle exec rspec spec/models/refresh_token_spec.rb`
Expected: FAIL(`RefreshToken`にメソッドが無いため)

- [ ] **Step 5: RefreshTokenモデルを実装する**

`backend/app/models/refresh_token.rb`:

```ruby
class RefreshToken < ApplicationRecord
  belongs_to :user

  EXPIRY = 30.days

  def self.issue!(user)
    raw_token = SecureRandom.hex(32)
    record = create!(
      user: user,
      token_digest: digest(raw_token),
      expires_at: EXPIRY.from_now
    )
    [raw_token, record]
  end

  def self.digest(raw_token)
    Digest::SHA256.hexdigest(raw_token)
  end

  def self.authenticate(raw_token)
    return nil if raw_token.blank?

    record = find_by(token_digest: digest(raw_token))
    return nil if record.nil?

    if record.revoked_at.present?
      record.user.refresh_tokens.where(revoked_at: nil).update_all(revoked_at: Time.current)
      return nil
    end

    return nil if record.expires_at < Time.current

    record
  end

  def revoke!
    update!(revoked_at: Time.current)
  end
end
```

- [ ] **Step 6: テストが通ることを確認する**

Run: `cd backend && bundle exec rspec spec/models/refresh_token_spec.rb`
Expected: PASS (5 examples, 0 failures)

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/refresh_token.rb backend/db/migrate backend/db/schema.rb backend/spec/models/refresh_token_spec.rb
git commit -m "feat(backend): add RefreshToken model with rotation reuse detection"
```

---

## Task 4: Eventモデル(繰り返し予定の展開を含む)

**Files:**
- Create: `backend/db/migrate/XXXX_create_events.rb`
- Create: `backend/app/models/event.rb`
- Test: `backend/spec/models/event_spec.rb`

**Interfaces:**
- Consumes: `User`(Task 2)
- Produces: `Event`モデル。`event.recurrence_params = { "frequency" => "weekly", "interval" => 1, "until" => "2026-12-31" }`で繰り返しルールを設定(JSON文字列として`recurrence_rule`列に保存)。`event.recurrence_params`で読み出し(Hashまたはnil)。`event.recurring?`でBoolean。`event.occurrences_between(range_start, range_end)`で`Time`の配列を返す(単発予定なら範囲内なら`[start_at]`、範囲外なら`[]`。繰り返し予定なら`ice_cube`で展開)。

- [ ] **Step 1: マイグレーションを作成する**

```bash
cd backend && bundle exec rails generate migration CreateEvents
```

`backend/db/migrate/XXXX_create_events.rb`を編集:

```ruby
class CreateEvents < ActiveRecord::Migration[7.1]
  def change
    create_table :events do |t|
      t.references :user, null: false, foreign_key: true
      t.string :title, null: false
      t.text :description
      t.datetime :start_at, null: false
      t.datetime :end_at, null: false
      t.boolean :all_day, null: false, default: false
      t.text :recurrence_rule

      t.timestamps
    end
    add_index :events, [:user_id, :start_at]
  end
end
```

- [ ] **Step 2: マイグレーションを実行する**

```bash
cd backend && bundle exec rails db:migrate
```

- [ ] **Step 3: 失敗するテストを書く**

`backend/spec/models/event_spec.rb`:

```ruby
require "rails_helper"

RSpec.describe Event, type: :model do
  let(:user) { User.create!(email: "a@example.com", google_uid: "g-1", name: "Taro") }

  def build_event(**attrs)
    user.events.new({ title: "Meeting", start_at: Time.zone.parse("2026-08-10 10:00"),
                       end_at: Time.zone.parse("2026-08-10 11:00") }.merge(attrs))
  end

  it "is valid with title, start_at, end_at" do
    expect(build_event).to be_valid
  end

  it "rejects a title longer than 200 characters" do
    expect(build_event(title: "a" * 201)).not_to be_valid
  end

  it "rejects a description longer than 5000 characters" do
    expect(build_event(description: "a" * 5001)).not_to be_valid
  end

  it "rejects end_at before start_at" do
    event = build_event(end_at: Time.zone.parse("2026-08-10 09:00"))
    expect(event).not_to be_valid
    expect(event.errors[:end_at]).to be_present
  end

  describe "recurrence validation" do
    it "rejects an unknown frequency" do
      event = build_event
      event.recurrence_params = { "frequency" => "yearly", "interval" => 1 }
      expect(event).not_to be_valid
    end

    it "rejects a zero interval" do
      event = build_event
      event.recurrence_params = { "frequency" => "weekly", "interval" => 0 }
      expect(event).not_to be_valid
    end

    it "accepts a valid recurrence" do
      event = build_event
      event.recurrence_params = { "frequency" => "weekly", "interval" => 1, "until" => "2026-12-31" }
      expect(event).to be_valid
    end
  end

  describe "#occurrences_between" do
    it "returns the single occurrence when it falls in range and the event is not recurring" do
      event = build_event
      result = event.occurrences_between(Time.zone.parse("2026-08-01"), Time.zone.parse("2026-08-31"))
      expect(result).to eq([event.start_at])
    end

    it "returns no occurrences when the single event falls outside the range" do
      event = build_event
      result = event.occurrences_between(Time.zone.parse("2026-09-01"), Time.zone.parse("2026-09-30"))
      expect(result).to eq([])
    end

    it "expands a weekly recurring event across the range" do
      event = build_event(start_at: Time.zone.parse("2026-08-03 10:00"), end_at: Time.zone.parse("2026-08-03 11:00"))
      event.recurrence_params = { "frequency" => "weekly", "interval" => 1 }
      event.save!

      result = event.occurrences_between(Time.zone.parse("2026-08-01"), Time.zone.parse("2026-08-31"))
      expect(result.size).to eq(5)
      expect(result.first.to_date).to eq(Date.new(2026, 8, 3))
    end
  end
end
```

- [ ] **Step 4: テストが失敗することを確認する**

Run: `cd backend && bundle exec rspec spec/models/event_spec.rb`
Expected: FAIL(`Event`モデル未実装のため)

- [ ] **Step 5: Eventモデルを実装する**

`backend/app/models/event.rb`:

```ruby
class Event < ApplicationRecord
  belongs_to :user

  TITLE_MAX_LENGTH = 200
  DESCRIPTION_MAX_LENGTH = 5000
  ALLOWED_FREQUENCIES = %w[daily weekly monthly].freeze

  validates :title, presence: true, length: { maximum: TITLE_MAX_LENGTH }
  validates :description, length: { maximum: DESCRIPTION_MAX_LENGTH }
  validates :start_at, presence: true
  validates :end_at, presence: true
  validate :end_at_after_start_at
  validate :recurrence_params_valid

  def recurrence_params=(hash)
    self.recurrence_rule = hash.present? ? hash.to_json : nil
  end

  def recurrence_params
    return nil if recurrence_rule.blank?

    JSON.parse(recurrence_rule)
  end

  def recurring?
    recurrence_rule.present?
  end

  def ice_cube_rule
    params = recurrence_params
    return nil unless params

    rule = case params["frequency"]
           when "daily" then IceCube::Rule.daily(params["interval"])
           when "weekly" then IceCube::Rule.weekly(params["interval"])
           when "monthly" then IceCube::Rule.monthly(params["interval"])
           end
    rule = rule.until(Date.parse(params["until"])) if params["until"].present?
    rule
  end

  def occurrences_between(range_start, range_end)
    unless recurring?
      return (start_at >= range_start && start_at <= range_end) ? [start_at] : []
    end

    schedule = IceCube::Schedule.new(start_at)
    schedule.add_recurrence_rule(ice_cube_rule)
    schedule.occurrences_between(range_start, range_end)
  end

  private

  def end_at_after_start_at
    return if start_at.blank? || end_at.blank?

    errors.add(:end_at, "must be after start_at") if end_at < start_at
  end

  def recurrence_params_valid
    params = recurrence_params
    return if params.nil?

    unless ALLOWED_FREQUENCIES.include?(params["frequency"])
      errors.add(:recurrence_rule, "frequency must be one of #{ALLOWED_FREQUENCIES.join(', ')}")
    end

    interval = params["interval"]
    unless interval.is_a?(Integer) && interval.positive?
      errors.add(:recurrence_rule, "interval must be a positive integer")
    end
  rescue JSON::ParserError
    errors.add(:recurrence_rule, "is not valid JSON")
  end
end
```

- [ ] **Step 6: テストが通ることを確認する**

Run: `cd backend && bundle exec rspec spec/models/event_spec.rb`
Expected: PASS (10 examples, 0 failures)

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/event.rb backend/db/migrate backend/db/schema.rb backend/spec/models/event_spec.rb
git commit -m "feat(backend): add Event model with recurrence expansion via ice_cube"
```

---

## Task 5: Google IDトークン検証サービス

**Files:**
- Create: `backend/app/services/google_id_token_verifier.rb`
- Test: `backend/spec/services/google_id_token_verifier_spec.rb`
- Modify: `backend/config/application.rb` (autoload `app/services`は Rails標準で自動対象)

**Interfaces:**
- Produces: `GoogleIdTokenVerifier.verify(id_token)` → 検証済みpayload(Hash、キーは`"sub"`, `"email"`, `"email_verified"`, `"name"`, `"picture"`)を返す。検証失敗時は`GoogleIdTokenVerifier::InvalidToken`を発生させる。Client IDはENV変数`GOOGLE_CLIENT_ID`から取得する。

- [ ] **Step 1: 失敗するテストを書く**

`backend/spec/services/google_id_token_verifier_spec.rb`:

```ruby
require "rails_helper"

RSpec.describe GoogleIdTokenVerifier do
  describe ".verify" do
    it "returns the verified payload" do
      payload = { "sub" => "google-1", "email" => "a@example.com", "email_verified" => true }
      allow(Google::Auth::IDTokens).to receive(:verify_oidc).and_return(payload)

      expect(described_class.verify("valid-token")).to eq(payload)
    end

    it "wraps verification failures in InvalidToken" do
      allow(Google::Auth::IDTokens).to receive(:verify_oidc)
        .and_raise(Google::Auth::IDTokens::SignatureError, "bad signature")

      expect { described_class.verify("bad-token") }.to raise_error(GoogleIdTokenVerifier::InvalidToken)
    end
  end
end
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd backend && bundle exec rspec spec/services/google_id_token_verifier_spec.rb`
Expected: FAIL(`GoogleIdTokenVerifier`未定義のため)

- [ ] **Step 3: サービスを実装する**

`backend/app/services/google_id_token_verifier.rb`:

```ruby
class GoogleIdTokenVerifier
  class InvalidToken < StandardError; end

  def self.verify(id_token)
    Google::Auth::IDTokens.verify_oidc(id_token, aud: client_id)
  rescue Google::Auth::IDTokens::VerificationError => e
    raise InvalidToken, e.message
  end

  def self.client_id
    ENV.fetch("GOOGLE_CLIENT_ID")
  end
end
```

- [ ] **Step 4: `backend/.env.example`を作成し、必要なENV変数を明記する**

`backend/.env.example`:

```
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
```

開発環境では`backend/.env`(gitignore対象)にコピーして実際の値を設定する。`dotenv-rails`のような追加gemは使わず、`direnv`やシェルのexport、もしくは各自の実行環境の環境変数機能で読み込む。

- [ ] **Step 5: テストが通ることを確認する**

Run: `cd backend && GOOGLE_CLIENT_ID=dummy bundle exec rspec spec/services/google_id_token_verifier_spec.rb`
Expected: PASS (2 examples, 0 failures)

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/google_id_token_verifier.rb backend/spec/services/google_id_token_verifier_spec.rb backend/.env.example
git commit -m "feat(backend): add Google ID token verification service"
```

---

## Task 6: JWTアクセストークンサービス

**Files:**
- Create: `backend/app/services/json_web_token.rb`
- Modify: `backend/spec/rails_helper.rb` (時間操作ヘルパーの追加)
- Test: `backend/spec/services/json_web_token_spec.rb`

**Interfaces:**
- Produces: `JsonWebToken.encode(user_id)` → JWT文字列(HS256, 15分有効)。`JsonWebToken.decode(token)` → payload Hash(`"sub"`にuser_id)。不正/期限切れ/アルゴリズム不一致は`JsonWebToken::InvalidToken`を発生させる。

- [ ] **Step 1: rails_helper.rbに時間操作ヘルパーを追加する**

`backend/spec/rails_helper.rb`の`RSpec.configure do |config|`ブロック内に追記:

```ruby
  config.include ActiveSupport::Testing::TimeHelpers
```

- [ ] **Step 2: 失敗するテストを書く**

`backend/spec/services/json_web_token_spec.rb`:

```ruby
require "rails_helper"

RSpec.describe JsonWebToken do
  describe ".encode / .decode" do
    it "round-trips a user id" do
      token = described_class.encode(42)
      payload = described_class.decode(token)
      expect(payload["sub"]).to eq(42)
    end

    it "raises InvalidToken for a tampered token" do
      token = described_class.encode(42)
      expect { described_class.decode(token + "x") }.to raise_error(described_class::InvalidToken)
    end

    it "raises InvalidToken for an expired token" do
      token = travel_to(20.minutes.ago) { described_class.encode(42) }
      expect { described_class.decode(token) }.to raise_error(described_class::InvalidToken)
    end

    it "rejects tokens signed with alg: none" do
      none_token = JWT.encode({ sub: 42, exp: 1.hour.from_now.to_i }, nil, "none")
      expect { described_class.decode(none_token) }.to raise_error(described_class::InvalidToken)
    end
  end
end
```

- [ ] **Step 3: テストが失敗することを確認する**

Run: `cd backend && bundle exec rspec spec/services/json_web_token_spec.rb`
Expected: FAIL(`JsonWebToken`未定義のため)

- [ ] **Step 4: サービスを実装する**

`backend/app/services/json_web_token.rb`:

```ruby
class JsonWebToken
  ALGORITHM = "HS256"
  ACCESS_TOKEN_EXPIRY = 15.minutes

  class InvalidToken < StandardError; end

  def self.encode(user_id)
    payload = { sub: user_id, exp: ACCESS_TOKEN_EXPIRY.from_now.to_i }
    JWT.encode(payload, secret, ALGORITHM)
  end

  def self.decode(token)
    payload, = JWT.decode(token, secret, true, algorithm: ALGORITHM)
    payload
  rescue JWT::DecodeError => e
    raise InvalidToken, e.message
  end

  def self.secret
    Rails.application.secret_key_base
  end
end
```

- [ ] **Step 5: テストが通ることを確認する**

Run: `cd backend && bundle exec rspec spec/services/json_web_token_spec.rb`
Expected: PASS (4 examples, 0 failures)

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/json_web_token.rb backend/spec/services/json_web_token_spec.rb backend/spec/rails_helper.rb
git commit -m "feat(backend): add JWT access token service with pinned HS256 algorithm"
```

---

## Task 7: ApplicationController(認証・エラーハンドリング基盤)

**Files:**
- Modify: `backend/app/controllers/application_controller.rb`
- Test: `backend/spec/controllers/application_controller_spec.rb`

**Interfaces:**
- Consumes: `JsonWebToken`(Task 6), `User`(Task 2)
- Produces: `authenticate_request!`(before_actionで使うprivateメソッド、未認証なら401)、`current_user`(privateメソッド)、`user_json(user)`(privateヘルパー、`{id:, email:, name:, avatar_url:}`を返す)。`ActiveRecord::RecordNotFound`は404、`ActiveRecord::RecordInvalid`は422、いずれも`{ error: { message: } }`形式で返す。

- [ ] **Step 1: 失敗するテストを書く**

`backend/spec/controllers/application_controller_spec.rb`:

```ruby
require "rails_helper"

RSpec.describe ApplicationController, type: :controller do
  controller do
    def index
      authenticate_request!
      render json: { user_id: current_user.id }
    end
  end

  before do
    routes.draw { get "index" => "anonymous#index" }
  end

  let(:user) { User.create!(email: "a@example.com", google_uid: "g-1", name: "Taro") }

  it "returns the current user when given a valid bearer token" do
    token = JsonWebToken.encode(user.id)
    request.headers["Authorization"] = "Bearer #{token}"

    get :index

    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body)["user_id"]).to eq(user.id)
  end

  it "returns 401 as JSON when no token is given" do
    get :index

    expect(response).to have_http_status(:unauthorized)
    expect(JSON.parse(response.body)["error"]["message"]).to be_present
  end

  it "returns 401 when the token is invalid" do
    request.headers["Authorization"] = "Bearer bogus"

    get :index

    expect(response).to have_http_status(:unauthorized)
  end
end
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd backend && bundle exec rspec spec/controllers/application_controller_spec.rb`
Expected: FAIL(`authenticate_request!`等が未実装のため)

- [ ] **Step 3: ApplicationControllerを実装する**

`backend/app/controllers/application_controller.rb`:

```ruby
class ApplicationController < ActionController::API
  class Unauthorized < StandardError; end

  rescue_from Unauthorized, with: :render_unauthorized
  rescue_from ActiveRecord::RecordNotFound, with: :render_not_found
  rescue_from ActiveRecord::RecordInvalid, with: :render_unprocessable

  private

  def authenticate_request!
    raise Unauthorized unless current_user
  end

  def current_user
    return nil if bearer_token.blank?

    @current_user ||= User.find(JsonWebToken.decode(bearer_token)["sub"])
  rescue JsonWebToken::InvalidToken, ActiveRecord::RecordNotFound
    nil
  end

  def bearer_token
    request.headers["Authorization"]&.split(" ")&.last
  end

  def user_json(user)
    { id: user.id, email: user.email, name: user.name, avatar_url: user.avatar_url }
  end

  def render_unauthorized
    render json: { error: { message: "Unauthorized" } }, status: :unauthorized
  end

  def render_not_found
    render json: { error: { message: "Not Found" } }, status: :not_found
  end

  def render_unprocessable(exception)
    render json: { error: { message: exception.record.errors.full_messages.join(", ") } }, status: :unprocessable_entity
  end
end
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd backend && bundle exec rspec spec/controllers/application_controller_spec.rb`
Expected: PASS (3 examples, 0 failures)

- [ ] **Step 5: Commit**

```bash
git add backend/app/controllers/application_controller.rb backend/spec/controllers/application_controller_spec.rb
git commit -m "feat(backend): add auth + error handling base in ApplicationController"
```

---

## Task 8: ログイン/ログアウト(`/api/auth/login`, `/api/auth/logout`)

**Note:** 設計書では`POST /api/sessions`・`DELETE /api/sessions`という命名だったが、ログアウト処理がリフレッシュトークンCookieを読み取る必要があり、そのCookieのpathをリフレッシュ系エンドポイントに限定する(IDOR/CSRF対策)ためには、ログイン・ログアウト・リフレッシュを同じパス階層(`/api/auth/*`)にまとめる必要がある。そのため実装ではこれらを`/api/auth/login`・`/api/auth/logout`・`/api/auth/refresh`とし、Cookieのpathは`/api/auth`に設定する(設計の意図・セキュリティ特性は変えず、ルーティングのみの調整)。

**Files:**
- Create: `backend/app/controllers/auth_controller.rb`
- Modify: `backend/config/routes.rb`
- Test: `backend/spec/requests/auth_spec.rb`

**Interfaces:**
- Consumes: `GoogleIdTokenVerifier`(Task 5), `User`(Task 2), `RefreshToken`(Task 3), `JsonWebToken`(Task 6), `ApplicationController#user_json`(Task 7)
- Produces: `POST /api/auth/login`(body: `{ id_token: "..." }`) → 201, `{ access_token:, user: }`, `Set-Cookie: refresh_token=...; Path=/api/auth`。`DELETE /api/auth/logout` → 204、Cookie削除。

- [ ] **Step 1: ルーティングを追加する**

`backend/config/routes.rb`:

```ruby
Rails.application.routes.draw do
  namespace :api do
    namespace :auth do
      post "login", to: "/auth#login"
      post "refresh", to: "/auth#refresh"
      delete "logout", to: "/auth#logout"
    end
  end
end
```

- [ ] **Step 2: 失敗するテストを書く**

`backend/spec/requests/auth_spec.rb`:

```ruby
require "rails_helper"

RSpec.describe "Auth", type: :request do
  let(:google_payload) do
    { "sub" => "google-1", "email" => "a@example.com", "email_verified" => true,
      "name" => "Taro", "picture" => "https://example.com/a.png" }
  end

  describe "POST /api/auth/login" do
    it "creates a session for a valid Google id_token" do
      allow(GoogleIdTokenVerifier).to receive(:verify).and_return(google_payload)

      post "/api/auth/login", params: { id_token: "valid" }

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body["access_token"]).to be_present
      expect(body["user"]["email"]).to eq("a@example.com")
      expect(response.cookies["refresh_token"]).to be_present
    end

    it "returns 401 for an invalid Google id_token" do
      allow(GoogleIdTokenVerifier).to receive(:verify).and_raise(GoogleIdTokenVerifier::InvalidToken)

      post "/api/auth/login", params: { id_token: "bad" }

      expect(response).to have_http_status(:unauthorized)
    end

    it "returns 401 when the Google email is not verified" do
      allow(GoogleIdTokenVerifier).to receive(:verify).and_return(google_payload.merge("email_verified" => false))

      post "/api/auth/login", params: { id_token: "valid" }

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "DELETE /api/auth/logout" do
    it "revokes the refresh token and clears the cookie" do
      allow(GoogleIdTokenVerifier).to receive(:verify).and_return(google_payload)
      post "/api/auth/login", params: { id_token: "valid" }
      raw_refresh_token = response.cookies["refresh_token"]

      delete "/api/auth/logout", headers: { "Cookie" => "refresh_token=#{raw_refresh_token}" }

      expect(response).to have_http_status(:no_content)
      expect(RefreshToken.authenticate(raw_refresh_token)).to be_nil
    end

    it "returns 204 even when there is no refresh cookie" do
      delete "/api/auth/logout"

      expect(response).to have_http_status(:no_content)
    end
  end
end
```

- [ ] **Step 3: テストが失敗することを確認する**

Run: `cd backend && bundle exec rspec spec/requests/auth_spec.rb`
Expected: FAIL(`AuthController`未定義のため routing error)

- [ ] **Step 4: AuthControllerを実装する**

`backend/app/controllers/auth_controller.rb`:

```ruby
class AuthController < ApplicationController
  REFRESH_COOKIE_NAME = :refresh_token
  REFRESH_COOKIE_PATH = "/api/auth"

  def login
    payload = GoogleIdTokenVerifier.verify(params.require(:id_token))
    user = User.find_or_create_from_google!(payload)
    issue_tokens_for(user)
  rescue GoogleIdTokenVerifier::InvalidToken, ArgumentError
    render json: { error: { message: "Invalid Google token" } }, status: :unauthorized
  end

  def logout
    if (record = RefreshToken.authenticate(cookies[REFRESH_COOKIE_NAME]))
      record.revoke!
    end
    cookies.delete(REFRESH_COOKIE_NAME, path: REFRESH_COOKIE_PATH)
    head :no_content
  end

  private

  def issue_tokens_for(user)
    access_token = JsonWebToken.encode(user.id)
    raw_refresh_token, = RefreshToken.issue!(user)
    set_refresh_cookie(raw_refresh_token)
    render json: { access_token: access_token, user: user_json(user) }, status: :created
  end

  def set_refresh_cookie(raw_token)
    cookies[REFRESH_COOKIE_NAME] = {
      value: raw_token,
      httponly: true,
      secure: Rails.env.production?,
      same_site: :strict,
      path: REFRESH_COOKIE_PATH,
      expires: RefreshToken::EXPIRY.from_now
    }
  end
end
```

- [ ] **Step 5: テストが通ることを確認する**

Run: `cd backend && bundle exec rspec spec/requests/auth_spec.rb`
Expected: PASS (5 examples, 0 failures)

- [ ] **Step 6: Commit**

```bash
git add backend/app/controllers/auth_controller.rb backend/config/routes.rb backend/spec/requests/auth_spec.rb
git commit -m "feat(backend): add Google login and logout endpoints"
```

---

## Task 9: アクセストークン再発行(`/api/auth/refresh`)

**Files:**
- Modify: `backend/app/controllers/auth_controller.rb`
- Test: `backend/spec/requests/auth_refresh_spec.rb`

**Interfaces:**
- Consumes: `RefreshToken.authenticate`/`#revoke!`(Task 3), `AuthController#issue_tokens_for`(Task 8)
- Produces: `POST /api/auth/refresh` → 有効なリフレッシュCookieがあれば200で新しい`access_token`とローテーションされた`refresh_token`Cookieを返す。無効/なしなら401。

- [ ] **Step 1: 失敗するテストを書く**

`backend/spec/requests/auth_refresh_spec.rb`:

```ruby
require "rails_helper"

RSpec.describe "POST /api/auth/refresh", type: :request do
  let(:google_payload) do
    { "sub" => "google-1", "email" => "a@example.com", "email_verified" => true, "name" => "Taro" }
  end

  before do
    allow(GoogleIdTokenVerifier).to receive(:verify).and_return(google_payload)
    post "/api/auth/login", params: { id_token: "valid" }
  end

  it "issues a new access token and rotates the refresh token" do
    original = response.cookies["refresh_token"]

    post "/api/auth/refresh", headers: { "Cookie" => "refresh_token=#{original}" }

    expect(response).to have_http_status(:ok)
    new_refresh_token = response.cookies["refresh_token"]
    expect(new_refresh_token).to be_present
    expect(new_refresh_token).not_to eq(original)
    expect(RefreshToken.authenticate(original)).to be_nil
    expect(RefreshToken.authenticate(new_refresh_token)).to be_present
  end

  it "returns 401 when there is no refresh cookie" do
    post "/api/auth/refresh"

    expect(response).to have_http_status(:unauthorized)
  end

  it "revokes the whole token family and returns 401 when a rotated-out token is reused" do
    original = response.cookies["refresh_token"]
    post "/api/auth/refresh", headers: { "Cookie" => "refresh_token=#{original}" }
    rotated = response.cookies["refresh_token"]

    post "/api/auth/refresh", headers: { "Cookie" => "refresh_token=#{original}" }

    expect(response).to have_http_status(:unauthorized)
    expect(RefreshToken.authenticate(rotated)).to be_nil
  end
end
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd backend && bundle exec rspec spec/requests/auth_refresh_spec.rb`
Expected: FAIL(`refresh`アクション未実装のためrouting error)

- [ ] **Step 3: `refresh`アクションを追加する**

`backend/app/controllers/auth_controller.rb`に追記(`login`メソッドの直後):

```ruby
  def refresh
    record = RefreshToken.authenticate(cookies[REFRESH_COOKIE_NAME])
    raise Unauthorized unless record

    record.revoke!
    issue_tokens_for(record.user)
  end
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd backend && bundle exec rspec spec/requests/auth_refresh_spec.rb`
Expected: PASS (3 examples, 0 failures)

- [ ] **Step 5: Commit**

```bash
git add backend/app/controllers/auth_controller.rb backend/spec/requests/auth_refresh_spec.rb
git commit -m "feat(backend): add refresh token rotation endpoint"
```

---

## Task 10: ログインユーザー取得(`GET /api/me`)

**Files:**
- Create: `backend/app/controllers/me_controller.rb`
- Modify: `backend/config/routes.rb`
- Test: `backend/spec/requests/me_spec.rb`

**Interfaces:**
- Consumes: `ApplicationController#authenticate_request!`/`#current_user`/`#user_json`(Task 7)
- Produces: `GET /api/me`(要`Authorization: Bearer`) → 200で`user_json(current_user)`。未認証は401。

- [ ] **Step 1: ルーティングを追加する**

`backend/config/routes.rb`の`namespace :api do`ブロック内に追記:

```ruby
    get "me", to: "me#show"
```

- [ ] **Step 2: 失敗するテストを書く**

`backend/spec/requests/me_spec.rb`:

```ruby
require "rails_helper"

RSpec.describe "GET /api/me", type: :request do
  let(:user) { User.create!(email: "a@example.com", google_uid: "g-1", name: "Taro") }

  it "returns the current user for a valid token" do
    token = JsonWebToken.encode(user.id)

    get "/api/me", headers: { "Authorization" => "Bearer #{token}" }

    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body)["email"]).to eq("a@example.com")
  end

  it "returns 401 without a token" do
    get "/api/me"

    expect(response).to have_http_status(:unauthorized)
  end
end
```

- [ ] **Step 3: テストが失敗することを確認する**

Run: `cd backend && bundle exec rspec spec/requests/me_spec.rb`
Expected: FAIL(`MeController`未定義のためrouting error)

- [ ] **Step 4: MeControllerを実装する**

`backend/app/controllers/me_controller.rb`:

```ruby
class MeController < ApplicationController
  before_action :authenticate_request!

  def show
    render json: user_json(current_user)
  end
end
```

- [ ] **Step 5: テストが通ることを確認する**

Run: `cd backend && bundle exec rspec spec/requests/me_spec.rb`
Expected: PASS (2 examples, 0 failures)

- [ ] **Step 6: Commit**

```bash
git add backend/app/controllers/me_controller.rb backend/config/routes.rb backend/spec/requests/me_spec.rb
git commit -m "feat(backend): add GET /api/me endpoint"
```

---

## Task 11: レート制限(rack-attack)

**Files:**
- Create: `backend/config/initializers/rack_attack.rb`
- Test: `backend/spec/requests/rate_limiting_spec.rb`

**Interfaces:**
- Produces: `POST /api/auth/login`は1 IPあたり1分間10回まで、`POST /api/auth/refresh`は1分間30回まで。超過時は429を返す。

- [ ] **Step 1: 失敗するテストを書く**

`backend/spec/requests/rate_limiting_spec.rb`:

```ruby
require "rails_helper"

RSpec.describe "Rate limiting", type: :request do
  before do
    Rack::Attack.cache.store = ActiveSupport::Cache::MemoryStore.new
  end

  it "throttles POST /api/auth/login after 10 requests per minute per IP" do
    allow(GoogleIdTokenVerifier).to receive(:verify).and_raise(GoogleIdTokenVerifier::InvalidToken)

    10.times { post "/api/auth/login", params: { id_token: "x" } }
    post "/api/auth/login", params: { id_token: "x" }

    expect(response).to have_http_status(:too_many_requests)
  end
end
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd backend && bundle exec rspec spec/requests/rate_limiting_spec.rb`
Expected: FAIL(スロットル未設定のため11回目も401のまま)

- [ ] **Step 3: rack-attackの設定を追加する**

`backend/config/initializers/rack_attack.rb`:

```ruby
class Rack::Attack
  throttle("auth/login", limit: 10, period: 1.minute) do |req|
    req.ip if req.path == "/api/auth/login" && req.post?
  end

  throttle("auth/refresh", limit: 30, period: 1.minute) do |req|
    req.ip if req.path == "/api/auth/refresh" && req.post?
  end
end
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd backend && bundle exec rspec spec/requests/rate_limiting_spec.rb`
Expected: PASS (1 example, 0 failures)

- [ ] **Step 5: Commit**

```bash
git add backend/config/initializers/rack_attack.rb backend/spec/requests/rate_limiting_spec.rb
git commit -m "feat(backend): rate limit login and refresh endpoints with rack-attack"
```

---

## Task 12: CORS設定 と 本番HTTPS強制

**Files:**
- Create: `backend/config/initializers/cors.rb`
- Modify: `backend/config/environments/production.rb`
- Test: `backend/spec/requests/cors_spec.rb`

**Interfaces:**
- Produces: `/api/auth/*`はCredentials付きCORSを許可(リフレッシュCookieのため)、それ以外の`/api/*`はCredentials無しでCORSを許可。許可originはENV変数`FRONTEND_ORIGIN`(デフォルト`http://localhost:5173`)。本番は`force_ssl = true`。

- [ ] **Step 1: 失敗するテストを書く**

`backend/spec/requests/cors_spec.rb`:

```ruby
require "rails_helper"

RSpec.describe "CORS", type: :request do
  it "reflects the configured frontend origin" do
    get "/api/me", headers: { "Origin" => "http://localhost:5173", "Authorization" => "Bearer bogus" }

    expect(response.headers["Access-Control-Allow-Origin"]).to eq("http://localhost:5173")
  end

  it "does not allow an arbitrary origin" do
    get "/api/me", headers: { "Origin" => "http://evil.example.com", "Authorization" => "Bearer bogus" }

    expect(response.headers["Access-Control-Allow-Origin"]).to be_nil
  end
end
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd backend && bundle exec rspec spec/requests/cors_spec.rb`
Expected: FAIL(CORS未設定のためヘッダーが付与されない)

- [ ] **Step 3: CORSを設定する**

`backend/config/initializers/cors.rb`:

```ruby
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins ENV.fetch("FRONTEND_ORIGIN", "http://localhost:5173")

    resource "/api/auth/*",
      headers: :any,
      methods: %i[post delete options],
      credentials: true

    resource "/api/*",
      headers: :any,
      methods: %i[get post patch delete options]
  end
end
```

- [ ] **Step 4: 本番のHTTPS強制を追加する**

`backend/config/environments/production.rb`の`Rails.application.configure do`ブロック内に追記:

```ruby
  config.force_ssl = true
```

- [ ] **Step 5: テストが通ることを確認する**

Run: `cd backend && bundle exec rspec spec/requests/cors_spec.rb`
Expected: PASS (2 examples, 0 failures)

- [ ] **Step 6: Commit**

```bash
git add backend/config/initializers/cors.rb backend/config/environments/production.rb backend/spec/requests/cors_spec.rb
git commit -m "feat(backend): configure CORS allowlist and enforce HTTPS in production"
```

---

## Task 13: 予定一覧取得(`GET /api/events`, 期間展開)

**Files:**
- Create: `backend/app/controllers/events_controller.rb`
- Modify: `backend/config/routes.rb`
- Modify: `backend/app/controllers/application_controller.rb`(400エラー用の`rescue_from`追加)
- Test: `backend/spec/requests/events_spec.rb`

**Interfaces:**
- Consumes: `Event#occurrences_between`(Task 4), `ApplicationController#authenticate_request!`/`#current_user`(Task 7)
- Produces: `GET /api/events?from=&to=`(要認証) → 200、期間内に展開された予定の配列(`[{id, title, description, start_at, end_at, all_day, recurring}]`)。他ユーザーの予定は含まれない。`from`/`to`が不正、または範囲が3ヶ月を超える場合は400。

- [ ] **Step 1: ApplicationControllerに400エラーハンドリングを追加する**

`backend/app/controllers/application_controller.rb`の`rescue_from`群に追記:

```ruby
  rescue_from ActionController::BadRequest, with: :render_bad_request
```

`private`セクションにメソッドを追記:

```ruby
  def render_bad_request(exception)
    render json: { error: { message: exception.message } }, status: :bad_request
  end
```

- [ ] **Step 2: ルーティングを追加する**

`backend/config/routes.rb`の`namespace :api do`ブロック内に追記:

```ruby
    resources :events, only: %i[index create update destroy]
```

- [ ] **Step 3: 失敗するテストを書く**

`backend/spec/requests/events_spec.rb`:

```ruby
require "rails_helper"

RSpec.describe "Events", type: :request do
  let(:user) { User.create!(email: "a@example.com", google_uid: "g-1", name: "Taro") }
  let(:other_user) { User.create!(email: "b@example.com", google_uid: "g-2", name: "Jiro") }
  let(:token) { JsonWebToken.encode(user.id) }
  let(:auth_headers) { { "Authorization" => "Bearer #{token}" } }

  describe "GET /api/events" do
    it "requires authentication" do
      get "/api/events", params: { from: "2026-08-01", to: "2026-08-31" }

      expect(response).to have_http_status(:unauthorized)
    end

    it "returns events within the requested range" do
      user.events.create!(title: "In range", start_at: Time.zone.parse("2026-08-10 10:00"),
                           end_at: Time.zone.parse("2026-08-10 11:00"))
      user.events.create!(title: "Out of range", start_at: Time.zone.parse("2026-09-10 10:00"),
                           end_at: Time.zone.parse("2026-09-10 11:00"))

      get "/api/events", params: { from: "2026-08-01", to: "2026-08-31" }, headers: auth_headers

      expect(response).to have_http_status(:ok)
      titles = JSON.parse(response.body).map { |e| e["title"] }
      expect(titles).to eq(["In range"])
    end

    it "excludes other users' events" do
      other_user.events.create!(title: "Not mine", start_at: Time.zone.parse("2026-08-10 10:00"),
                                 end_at: Time.zone.parse("2026-08-10 11:00"))

      get "/api/events", params: { from: "2026-08-01", to: "2026-08-31" }, headers: auth_headers

      expect(JSON.parse(response.body)).to eq([])
    end

    it "expands a recurring event into multiple occurrences" do
      event = user.events.create!(title: "Standup", start_at: Time.zone.parse("2026-08-03 10:00"),
                                   end_at: Time.zone.parse("2026-08-03 10:15"))
      event.recurrence_params = { "frequency" => "weekly", "interval" => 1 }
      event.save!

      get "/api/events", params: { from: "2026-08-01", to: "2026-08-31" }, headers: auth_headers

      body = JSON.parse(response.body)
      expect(body.size).to eq(5)
      expect(body.all? { |e| e["id"] == event.id && e["recurring"] == true }).to be true
    end

    it "returns 400 for an invalid date" do
      get "/api/events", params: { from: "not-a-date", to: "2026-08-31" }, headers: auth_headers

      expect(response).to have_http_status(:bad_request)
    end

    it "returns 400 when the range exceeds 3 months" do
      get "/api/events", params: { from: "2026-01-01", to: "2026-08-31" }, headers: auth_headers

      expect(response).to have_http_status(:bad_request)
    end
  end
end
```

- [ ] **Step 4: テストが失敗することを確認する**

Run: `cd backend && bundle exec rspec spec/requests/events_spec.rb`
Expected: FAIL(`EventsController`未定義のためrouting error)

- [ ] **Step 5: EventsControllerを実装する**

`backend/app/controllers/events_controller.rb`:

```ruby
class EventsController < ApplicationController
  before_action :authenticate_request!

  MAX_RANGE = 3.months

  def index
    from = parse_date!(params[:from])
    to = parse_date!(params[:to])
    raise ActionController::BadRequest, "to must be after from" if to < from
    raise ActionController::BadRequest, "range too large" if to - from > MAX_RANGE

    candidates = current_user.events.where(
      "(recurrence_rule IS NULL AND start_at <= ? AND end_at >= ?) OR (recurrence_rule IS NOT NULL AND start_at <= ?)",
      to, from, to
    )

    occurrences = candidates.flat_map do |event|
      duration = event.end_at - event.start_at
      event.occurrences_between(from, to).map do |occurrence_start|
        serialize_occurrence(event, occurrence_start, duration)
      end
    end

    render json: occurrences
  end

  private

  def parse_date!(value)
    parsed = Time.zone.parse(value.to_s)
    raise ActionController::BadRequest, "invalid date: #{value}" if parsed.nil?

    parsed
  rescue ArgumentError
    raise ActionController::BadRequest, "invalid date: #{value}"
  end

  def serialize_occurrence(event, occurrence_start, duration)
    {
      id: event.id,
      title: event.title,
      description: event.description,
      all_day: event.all_day,
      recurring: event.recurring?,
      recurrence: event.recurrence_params,
      start_at: occurrence_start.iso8601,
      end_at: (occurrence_start + duration).iso8601
    }
  end
end
```

- [ ] **Step 6: テストが通ることを確認する**

Run: `cd backend && bundle exec rspec spec/requests/events_spec.rb`
Expected: PASS (6 examples, 0 failures)

- [ ] **Step 7: Commit**

```bash
git add backend/app/controllers/events_controller.rb backend/app/controllers/application_controller.rb backend/config/routes.rb backend/spec/requests/events_spec.rb
git commit -m "feat(backend): add GET /api/events with range cap and recurrence expansion"
```

---

## Task 14: 予定作成(`POST /api/events`)

**Files:**
- Modify: `backend/app/controllers/events_controller.rb`
- Modify: `backend/spec/requests/events_spec.rb`

**Interfaces:**
- Consumes: `Event#recurrence_params=`(Task 4)、`ApplicationController#current_user`(Task 7)
- Produces: `POST /api/events`(body: `{ event: { title:, description:, start_at:, end_at:, all_day:, recurrence: { frequency:, interval:, until: } } }`, `recurrence`は省略可) → 201で作成した予定のJSON。バリデーション失敗は422。

- [ ] **Step 1: 失敗するテストを追記する**

`backend/spec/requests/events_spec.rb`の末尾(`end`の直前)に追記:

```ruby
  describe "POST /api/events" do
    it "creates a non-recurring event" do
      post "/api/events", params: {
        event: { title: "Lunch", start_at: "2026-08-10T12:00:00+09:00", end_at: "2026-08-10T13:00:00+09:00" }
      }, headers: auth_headers

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body["title"]).to eq("Lunch")
      expect(body["recurring"]).to eq(false)
      expect(user.events.count).to eq(1)
    end

    it "creates a recurring event from structured recurrence params" do
      post "/api/events", params: {
        event: {
          title: "Standup", start_at: "2026-08-03T10:00:00+09:00", end_at: "2026-08-03T10:15:00+09:00",
          recurrence: { frequency: "weekly", interval: "1", until: "2026-12-31" }
        }
      }, headers: auth_headers

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body["recurring"]).to eq(true)
      expect(body["recurrence"]).to eq({ "frequency" => "weekly", "interval" => 1, "until" => "2026-12-31" })
    end

    it "rejects an invalid recurrence frequency with 422" do
      post "/api/events", params: {
        event: {
          title: "Bad", start_at: "2026-08-03T10:00:00+09:00", end_at: "2026-08-03T10:15:00+09:00",
          recurrence: { frequency: "yearly", interval: "1" }
        }
      }, headers: auth_headers

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "rejects a title longer than 200 characters with 422" do
      post "/api/events", params: {
        event: { title: "a" * 201, start_at: "2026-08-10T12:00:00+09:00", end_at: "2026-08-10T13:00:00+09:00" }
      }, headers: auth_headers

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "requires authentication" do
      post "/api/events", params: {
        event: { title: "Lunch", start_at: "2026-08-10T12:00:00+09:00", end_at: "2026-08-10T13:00:00+09:00" }
      }

      expect(response).to have_http_status(:unauthorized)
    end
  end
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd backend && bundle exec rspec spec/requests/events_spec.rb -e "POST /api/events"`
Expected: FAIL(`create`アクション未実装のためrouting error)

- [ ] **Step 3: `create`アクションと共通ヘルパーを追加する**

`backend/app/controllers/events_controller.rb`の`private`より前に追記:

```ruby
  def create
    event = current_user.events.new(event_params)
    apply_recurrence(event)
    event.save!
    render json: serialize_event(event), status: :created
  end
```

`private`セクションに追記:

```ruby
  def event_params
    params.require(:event).permit(:title, :description, :start_at, :end_at, :all_day)
  end

  def recurrence_input
    params.dig(:event, :recurrence)&.permit(:frequency, :interval, :until)
  end

  def apply_recurrence(event)
    return unless params[:event]&.key?(:recurrence)

    input = recurrence_input
    event.recurrence_params = input.present? ? build_recurrence_params(input) : nil
  end

  def build_recurrence_params(input)
    {
      "frequency" => input[:frequency],
      "interval" => input[:interval].to_i,
      "until" => input[:until].presence
    }.compact
  end

  def serialize_event(event)
    {
      id: event.id,
      title: event.title,
      description: event.description,
      start_at: event.start_at.iso8601,
      end_at: event.end_at.iso8601,
      all_day: event.all_day,
      recurring: event.recurring?,
      recurrence: event.recurrence_params
    }
  end
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd backend && bundle exec rspec spec/requests/events_spec.rb`
Expected: PASS (11 examples, 0 failures)

- [ ] **Step 5: Commit**

```bash
git add backend/app/controllers/events_controller.rb backend/spec/requests/events_spec.rb
git commit -m "feat(backend): add POST /api/events with structured recurrence params"
```

---

## Task 15: 予定更新・削除(`PATCH /api/events/:id`, `DELETE /api/events/:id`)

**Files:**
- Modify: `backend/app/controllers/events_controller.rb`
- Modify: `backend/spec/requests/events_spec.rb`

**Interfaces:**
- Consumes: `EventsController`の`event_params`/`apply_recurrence`/`serialize_event`(Task 14)
- Produces: `PATCH /api/events/:id`(部分更新、ドラッグ&ドロップによる`start_at`/`end_at`変更もこれで扱う) → 200。`DELETE /api/events/:id` → 204。いずれも他ユーザーの予定IDを指定すると404(IDOR対策、`current_user.events`経由のスコープにより保証)。

- [ ] **Step 1: 失敗するテストを追記する**

`backend/spec/requests/events_spec.rb`の末尾(最後の`end`の直前)に追記:

```ruby
  describe "PATCH /api/events/:id" do
    it "updates an event's start_at and end_at (drag and drop)" do
      event = user.events.create!(title: "Meeting", start_at: Time.zone.parse("2026-08-10 10:00"),
                                   end_at: Time.zone.parse("2026-08-10 11:00"))

      patch "/api/events/#{event.id}", params: {
        event: { start_at: "2026-08-11T10:00:00+09:00", end_at: "2026-08-11T11:00:00+09:00" }
      }, headers: auth_headers

      expect(response).to have_http_status(:ok)
      expect(event.reload.start_at).to eq(Time.zone.parse("2026-08-11T10:00:00+09:00"))
    end

    it "returns 404 when updating another user's event" do
      event = other_user.events.create!(title: "Not mine", start_at: Time.zone.parse("2026-08-10 10:00"),
                                         end_at: Time.zone.parse("2026-08-10 11:00"))

      patch "/api/events/#{event.id}", params: { event: { title: "Hijacked" } }, headers: auth_headers

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "DELETE /api/events/:id" do
    it "deletes the caller's event" do
      event = user.events.create!(title: "Meeting", start_at: Time.zone.parse("2026-08-10 10:00"),
                                   end_at: Time.zone.parse("2026-08-10 11:00"))

      delete "/api/events/#{event.id}", headers: auth_headers

      expect(response).to have_http_status(:no_content)
      expect(Event.exists?(event.id)).to be false
    end

    it "returns 404 when deleting another user's event" do
      event = other_user.events.create!(title: "Not mine", start_at: Time.zone.parse("2026-08-10 10:00"),
                                         end_at: Time.zone.parse("2026-08-10 11:00"))

      delete "/api/events/#{event.id}", headers: auth_headers

      expect(response).to have_http_status(:not_found)
      expect(Event.exists?(event.id)).to be true
    end
  end
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd backend && bundle exec rspec spec/requests/events_spec.rb`
Expected: FAIL(`update`/`destroy`アクション未実装のためrouting error)

- [ ] **Step 3: `update`/`destroy`アクションを追加する**

`backend/app/controllers/events_controller.rb`の`create`アクションの直後に追記:

```ruby
  def update
    event = current_user.events.find(params[:id])
    event.assign_attributes(event_params)
    apply_recurrence(event)
    event.save!
    render json: serialize_event(event)
  end

  def destroy
    current_user.events.find(params[:id]).destroy!
    head :no_content
  end
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd backend && bundle exec rspec spec/requests/events_spec.rb`
Expected: PASS (15 examples, 0 failures)

- [ ] **Step 5: Commit**

```bash
git add backend/app/controllers/events_controller.rb backend/spec/requests/events_spec.rb
git commit -m "feat(backend): add PATCH and DELETE /api/events/:id scoped to current_user"
```

---

## Task 16: フロントエンド雛形(Vite + React + TS + Tailwind + Vitest)

**Files:**
- Create: `frontend/`(vite scaffold一式)
- Create: `frontend/vite.config.ts`
- Create: `frontend/src/setupTests.ts`
- Create: `frontend/src/App.tsx`(既存テンプレートを置き換え)
- Create: `frontend/src/App.test.tsx`
- Create: `frontend/index.html`(既存テンプレートを編集)
- Create: `frontend/public/_headers`
- Create: `frontend/.env.example`

**Interfaces:**
- Produces: `npm run dev`で`:5173`起動、`/api/*`は`:3000`にproxyされる。`npm run build`が型エラーなく通る。`npm test`でVitestが実行できる。

- [ ] **Step 1: Viteプロジェクトを作成する**

```bash
cd /Users/takahashiyuudai/workspace/rails_projects/calendar_rails_vite
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install
```

- [ ] **Step 2: Tailwind CSS(v4)を導入する**

```bash
npm install tailwindcss @tailwindcss/vite
```

`frontend/src/index.css`の内容を次の1行に置き換える:

```css
@import "tailwindcss";
```

- [ ] **Step 3: TanStack QueryとdndkitとVitest関連をインストールする**

```bash
npm install @tanstack/react-query @dnd-kit/core
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 4: `vite.config.ts`を編集する**

`frontend/vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/setupTests.ts"],
    globals: true,
  },
});
```

- [ ] **Step 5: テストセットアップファイルを作成する**

`frontend/src/setupTests.ts`:

```ts
import "@testing-library/jest-dom";
```

`frontend/package.json`の`"scripts"`に追記:

```json
    "test": "vitest run"
```

- [ ] **Step 6: 失敗するスモークテストを書く**

`frontend/src/App.tsx`を次の内容に置き換える:

```tsx
function App() {
  return <div>Calendar App</div>;
}

export default App;
```

`frontend/src/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import App from "./App";

it("renders the app shell", () => {
  render(<App />);
  expect(screen.getByText("Calendar App")).toBeInTheDocument();
});
```

- [ ] **Step 7: テストが通ることを確認する**

Run: `cd frontend && npm test`
Expected: PASS (1 test)

- [ ] **Step 8: `index.html`にCSPのmetaタグを設定する**

`frontend/index.html`の`<head>`内、`<title>`の下に追記(script-src・connect-src・frame-srcにGoogle Identity Servicesのドメインのみ許可。`frame-ancestors`はmetaタグでは無効なため本番配信側の`_headers`で設定する):

```html
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://accounts.google.com; frame-src https://accounts.google.com; connect-src 'self' https://accounts.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:;" />
```

- [ ] **Step 9: 本番静的ホスティング向けのセキュリティヘッダーファイルを作成する**

`frontend/public/_headers`(Netlify/Cloudflare Pages等の規約。Vercelにデプロイする場合は同等の設定を`vercel.json`の`headers`に別途用意する):

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' https://accounts.google.com; frame-src https://accounts.google.com; connect-src 'self' https://accounts.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
```

- [ ] **Step 10: `.env.example`を作成する**

`frontend/.env.example`:

```
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
```

Google Client IDは公開情報のため`VITE_`prefixで問題ない。秘密情報は今後もこのprefixで持たせないこと。

- [ ] **Step 11: ビルドが通ることを確認する**

Run: `cd frontend && npm run build`
Expected: 型エラーなくビルドが完了する

- [ ] **Step 12: Commit**

```bash
cd /Users/takahashiyuudai/workspace/rails_projects/calendar_rails_vite
git add frontend
git commit -m "feat(frontend): scaffold Vite + React + TS app with Tailwind and Vitest"
```

---

## Task 17: APIクライアント(401時の自動refresh&リトライ)

**Files:**
- Create: `frontend/src/api/client.ts`
- Test: `frontend/src/api/client.test.ts`

**Interfaces:**
- Produces: `setAccessToken(token: string | null)`, `getAccessToken(): string | null`, `apiFetch(path: string, options？: RequestInit): Promise<Response>`(`/api/auth/*`以外はAuthorizationヘッダーを付与し、401なら1回だけ`/api/auth/refresh`を試行してリトライ。`/api/auth/*`は`credentials: "include"`でCookieを送る), `apiRequest<T>(path, options?): Promise<T>`(非2xxで`ApiError`を投げる), `ApiError`(`status: number`を持つ), `setUnauthorizedHandler(handler: (() => void) | null)`(セッション中の401で自動refreshも失敗した際に呼ばれるコールバックを登録する。Task 18でAuthContextがログイン画面への遷移に使う)

- [ ] **Step 1: 失敗するテストを書く**

`frontend/src/api/client.test.ts`:

```ts
import { apiFetch, apiRequest, setAccessToken, setUnauthorizedHandler, ApiError } from "./client";

beforeEach(() => {
  setAccessToken(null);
  vi.restoreAllMocks();
});

it("attaches the Authorization header for non-auth endpoints when a token is set", async () => {
  setAccessToken("token-123");
  const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  await apiFetch("/api/events");

  const [, init] = fetchMock.mock.calls[0];
  expect((init!.headers as Headers).get("Authorization")).toBe("Bearer token-123");
  expect(init!.credentials).toBe("same-origin");
});

it("does not attach Authorization and includes credentials for /api/auth/* endpoints", async () => {
  setAccessToken("token-123");
  const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  await apiFetch("/api/auth/refresh", { method: "POST" });

  const [, init] = fetchMock.mock.calls[0];
  expect((init!.headers as Headers).has("Authorization")).toBe(false);
  expect(init!.credentials).toBe("include");
});

it("refreshes the access token and retries once on 401", async () => {
  setAccessToken("expired-token");
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(new Response("{}", { status: 401 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "new-token" }), { status: 200 }))
    .mockResolvedValueOnce(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  const response = await apiFetch("/api/events");

  expect(response.status).toBe(200);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  const [, retriedInit] = fetchMock.mock.calls[2];
  expect((retriedInit!.headers as Headers).get("Authorization")).toBe("Bearer new-token");
});

it("returns the original 401 without looping when refresh also fails", async () => {
  setAccessToken("expired-token");
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(new Response("{}", { status: 401 }))
    .mockResolvedValueOnce(new Response("{}", { status: 401 }));
  vi.stubGlobal("fetch", fetchMock);

  const response = await apiFetch("/api/events");

  expect(response.status).toBe(401);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

describe("apiRequest", () => {
  it("throws ApiError with the parsed message on failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ error: { message: "Not Found" } }), { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/api/events/999")).rejects.toThrow(ApiError);
  });
});

describe("setUnauthorizedHandler", () => {
  it("calls the registered handler when a mid-session refresh also fails", async () => {
    setAccessToken("expired-token");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(new Response("{}", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const handler = vi.fn();
    setUnauthorizedHandler(handler);

    await apiFetch("/api/events");

    expect(handler).toHaveBeenCalledTimes(1);
    setUnauthorizedHandler(null);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd frontend && npm test -- client`
Expected: FAIL(`./client`モジュールが存在しないため)

- [ ] **Step 3: APIクライアントを実装する**

`frontend/src/api/client.ts`:

```ts
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return body?.error?.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

async function refreshAccessToken(): Promise<boolean> {
  const response = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
  if (!response.ok) {
    setAccessToken(null);
    unauthorizedHandler?.();
    return false;
  }
  const body = await response.json();
  setAccessToken(body.access_token);
  return true;
}

export async function apiFetch(path: string, options: RequestInit = {}, retried = false): Promise<Response> {
  const isAuthEndpoint = path.startsWith("/api/auth/");
  const headers = new Headers(options.headers);
  if (accessToken && !isAuthEndpoint) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: isAuthEndpoint ? "include" : "same-origin",
  });

  if (response.status === 401 && !isAuthEndpoint && !retried) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiFetch(path, options, true);
    }
  }

  return response;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, options);
  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorMessage(response));
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json();
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd frontend && npm test -- client`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api
git commit -m "feat(frontend): add API client with 401 refresh-and-retry"
```

---

## Task 18: 認証状態管理とGoogleログインボタン

**Files:**
- Create: `frontend/src/features/auth/AuthContext.tsx`
- Create: `frontend/src/features/auth/AuthContext.test.tsx`
- Create: `frontend/src/features/auth/GoogleLoginButton.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`
- Modify: `frontend/index.html`(Google Identity Servicesスクリプトタグ追加)

**Interfaces:**
- Consumes: `apiFetch`/`apiRequest`/`setAccessToken`(Task 17)
- Produces: `AuthProvider`(マウント時に`/api/auth/refresh`でセッション復元を試みる)、`useAuth()` → `{ user, status: "loading"|"authenticated"|"unauthenticated", loginWithGoogleIdToken(idToken), logout() }`。`GoogleLoginButton`はGoogle Identity Servicesのボタンを描画し、取得したIDトークンで`loginWithGoogleIdToken`を呼ぶ。

- [ ] **Step 1: `index.html`にGoogle Identity Servicesのスクリプトを追加する**

`frontend/index.html`の`</body>`直前に追記:

```html
    <script src="https://accounts.google.com/gsi/client" async defer></script>
```

- [ ] **Step 2: 失敗するテストを書く**

`frontend/src/features/auth/AuthContext.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "./AuthContext";

function TestConsumer() {
  const { user, status, logout } = useAuth();
  if (status === "loading") return <div>loading</div>;
  if (status === "unauthenticated") return <div>logged out</div>;
  return (
    <div>
      <div>logged in as {user?.email}</div>
      <button onClick={() => void logout()}>Logout</button>
    </div>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

it("restores an existing session on mount", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: "t1", user: { id: 1, email: "a@example.com", name: "A", avatar_url: null } }),
        { status: 200 }
      )
    )
  );

  render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );

  await waitFor(() => screen.getByText("logged in as a@example.com"));
});

it("shows logged out state when there is no valid session", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));

  render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );

  await waitFor(() => screen.getByText("logged out"));
});

it("logs out and clears the user", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: "t1", user: { id: 1, email: "a@example.com", name: "A", avatar_url: null } }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
  );

  render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );

  await waitFor(() => screen.getByText("logged in as a@example.com"));
  await userEvent.click(screen.getByText("Logout"));

  await waitFor(() => screen.getByText("logged out"));
});
```

- [ ] **Step 3: テストが失敗することを確認する**

Run: `cd frontend && npm test -- AuthContext`
Expected: FAIL(`./AuthContext`が存在しないため)

- [ ] **Step 4: AuthContextを実装する**

`frontend/src/features/auth/AuthContext.tsx`:

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch, apiRequest, setAccessToken, setUnauthorizedHandler } from "../../api/client";

export type User = { id: number; email: string; name: string; avatar_url: string | null };
type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  loginWithGoogleIdToken: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    void restoreSession();
    return () => setUnauthorizedHandler(null);
  }, []);

  function clearSession() {
    setAccessToken(null);
    setUser(null);
    setStatus("unauthenticated");
  }

  async function restoreSession() {
    const response = await apiFetch("/api/auth/refresh", { method: "POST" });
    if (!response.ok) {
      setStatus("unauthenticated");
      return;
    }
    const body = await response.json();
    setAccessToken(body.access_token);
    setUser(body.user);
    setStatus("authenticated");
  }

  async function loginWithGoogleIdToken(idToken: string) {
    const body = await apiRequest<{ access_token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ id_token: idToken }),
    });
    setAccessToken(body.access_token);
    setUser(body.user);
    setStatus("authenticated");
  }

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "DELETE" });
    clearSession();
  }

  return (
    <AuthContext.Provider value={{ user, status, loginWithGoogleIdToken, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

- [ ] **Step 5: テストが通ることを確認する**

Run: `cd frontend && npm test -- AuthContext`
Expected: PASS (3 tests)

- [ ] **Step 6: GoogleLoginButtonを実装する**

`frontend/src/features/auth/GoogleLoginButton.tsx`:

```tsx
import { useEffect, useRef } from "react";
import { useAuth } from "./AuthContext";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: { theme: string; size: string }) => void;
        };
      };
    };
  }
}

export function GoogleLoginButton() {
  const { loginWithGoogleIdToken } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.google || !buttonRef.current) return;

    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: (response) => {
        void loginWithGoogleIdToken(response.credential);
      },
    });
    window.google.accounts.id.renderButton(buttonRef.current, { theme: "outline", size: "large" });
  }, [loginWithGoogleIdToken]);

  return <div ref={buttonRef} />;
}
```

- [ ] **Step 7: App.tsxを認証状態に応じた表示に更新する**

`frontend/src/App.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./features/auth/AuthContext";
import { GoogleLoginButton } from "./features/auth/GoogleLoginButton";

const queryClient = new QueryClient();

function AuthGate() {
  const { status, user, logout } = useAuth();

  if (status === "loading") return <div>Loading...</div>;
  if (status === "unauthenticated") return <GoogleLoginButton />;

  return (
    <div>
      <p>Welcome, {user?.name}</p>
      <button onClick={() => void logout()}>Logout</button>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
```

- [ ] **Step 8: App.test.tsxを新しい表示内容に合わせて更新する**

`frontend/src/App.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import App from "./App";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));
});

it("shows a loading state and then resolves to the logged-out view", async () => {
  render(<App />);

  expect(screen.getByText("Loading...")).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByText("Loading...")).not.toBeInTheDocument());
});
```

- [ ] **Step 9: 全テストが通ることを確認する**

Run: `cd frontend && npm test`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add frontend/src frontend/index.html
git commit -m "feat(frontend): add Google login flow and session restoration"
```

---

## Task 19: 予定API・TanStack Queryフック・フォームバリデーション関数

**Files:**
- Create: `frontend/src/features/events/api.ts`
- Create: `frontend/src/features/events/hooks.ts`
- Create: `frontend/src/features/events/validateEventForm.ts`
- Test: `frontend/src/features/events/validateEventForm.test.ts`

**Interfaces:**
- Consumes: `apiRequest`(Task 17)
- Produces: `CalendarEvent`(`recurrence`を含む。一覧・作成・更新すべて同じ形で返す)、`EventInput`、`RecurrenceParams`型。`fetchEvents(from, to)`, `createEvent(input)`, `updateEvent(id, input)`, `deleteEvent(id)`。`useEvents(from, to)`, `useCreateEvent()`, `useUpdateEvent()`, `useDeleteEvent()`(TanStack Query)。`validateEventForm(values: EventFormValues): EventFormErrors`(タイトル必須・200文字以内、開始/終了日時必須・終了は開始より後、繰り返し有効時はintervalが正の整数)。
- **Note**: `api.ts`/`hooks.ts`はTanStack Queryへの薄い配線のみのため、設計書で定めたフロントエンドのテスト対象(フォームバリデーション・繰り返し予定の表示・DnDによる日付更新)には含めない。バリデーション関数のみ単体テストする。

- [ ] **Step 1: 型とAPI関数を実装する**

`frontend/src/features/events/api.ts`:

```ts
import { apiRequest } from "../../api/client";

export type RecurrenceParams = { frequency: "daily" | "weekly" | "monthly"; interval: number; until?: string | null };

export type CalendarEvent = {
  id: number;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  recurring: boolean;
  recurrence: RecurrenceParams | null;
};

export type EventInput = {
  title: string;
  description?: string;
  start_at: string;
  end_at: string;
  all_day?: boolean;
  recurrence?: RecurrenceParams | null;
};

export function fetchEvents(from: Date, to: Date): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  return apiRequest<CalendarEvent[]>(`/api/events?${params.toString()}`);
}

export function createEvent(input: EventInput): Promise<CalendarEvent> {
  return apiRequest<CalendarEvent>("/api/events", { method: "POST", body: JSON.stringify({ event: input }) });
}

export function updateEvent(id: number, input: Partial<EventInput>): Promise<CalendarEvent> {
  return apiRequest<CalendarEvent>(`/api/events/${id}`, { method: "PATCH", body: JSON.stringify({ event: input }) });
}

export function deleteEvent(id: number): Promise<void> {
  return apiRequest<void>(`/api/events/${id}`, { method: "DELETE" });
}
```

- [ ] **Step 2: TanStack Queryフックを実装する**

`frontend/src/features/events/hooks.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createEvent, deleteEvent, fetchEvents, updateEvent, type EventInput } from "./api";

export function useEvents(from: Date, to: Date) {
  return useQuery({
    queryKey: ["events", from.toISOString(), to.toISOString()],
    queryFn: () => fetchEvents(from, to),
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EventInput) => createEvent(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["events"] }),
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<EventInput> }) => updateEvent(id, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["events"] }),
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteEvent(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["events"] }),
  });
}
```

- [ ] **Step 3: 失敗するテストを書く**

`frontend/src/features/events/validateEventForm.test.ts`:

```ts
import { validateEventForm, type EventFormValues } from "./validateEventForm";

const base: EventFormValues = {
  title: "Meeting",
  startAt: "2026-08-10T10:00",
  endAt: "2026-08-10T11:00",
  recurrenceEnabled: false,
  frequency: "weekly",
  interval: "1",
  until: "",
};

it("passes for valid values", () => {
  expect(validateEventForm(base)).toEqual({});
});

it("requires a title", () => {
  expect(validateEventForm({ ...base, title: "" })).toHaveProperty("title");
});

it("rejects a title longer than 200 characters", () => {
  expect(validateEventForm({ ...base, title: "a".repeat(201) })).toHaveProperty("title");
});

it("requires end_at to be after start_at", () => {
  expect(validateEventForm({ ...base, endAt: "2026-08-10T09:00" })).toHaveProperty("endAt");
});

it("requires a positive integer interval when recurrence is enabled", () => {
  expect(validateEventForm({ ...base, recurrenceEnabled: true, interval: "0" })).toHaveProperty("interval");
  expect(validateEventForm({ ...base, recurrenceEnabled: true, interval: "abc" })).toHaveProperty("interval");
});

it("does not validate interval when recurrence is disabled", () => {
  expect(validateEventForm({ ...base, recurrenceEnabled: false, interval: "abc" })).toEqual({});
});
```

- [ ] **Step 4: テストが失敗することを確認する**

Run: `cd frontend && npm test -- validateEventForm`
Expected: FAIL(`./validateEventForm`が存在しないため)

- [ ] **Step 5: バリデーション関数を実装する**

`frontend/src/features/events/validateEventForm.ts`:

```ts
export type EventFormValues = {
  title: string;
  startAt: string;
  endAt: string;
  recurrenceEnabled: boolean;
  frequency: "daily" | "weekly" | "monthly";
  interval: string;
  until: string;
};

export type EventFormErrors = Partial<Record<"title" | "startAt" | "endAt" | "interval", string>>;

export function validateEventForm(values: EventFormValues): EventFormErrors {
  const errors: EventFormErrors = {};

  if (!values.title.trim()) {
    errors.title = "タイトルを入力してください";
  } else if (values.title.length > 200) {
    errors.title = "タイトルは200文字以内で入力してください";
  }

  if (!values.startAt) errors.startAt = "開始日時を入力してください";
  if (!values.endAt) errors.endAt = "終了日時を入力してください";
  if (values.startAt && values.endAt && new Date(values.endAt) < new Date(values.startAt)) {
    errors.endAt = "終了日時は開始日時より後にしてください";
  }

  if (values.recurrenceEnabled) {
    const interval = Number(values.interval);
    if (!Number.isInteger(interval) || interval <= 0) {
      errors.interval = "繰り返し間隔は1以上の整数で入力してください";
    }
  }

  return errors;
}
```

- [ ] **Step 6: テストが通ることを確認する**

Run: `cd frontend && npm test -- validateEventForm`
Expected: PASS (6 tests)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/events
git commit -m "feat(frontend): add event API, TanStack Query hooks, and form validation"
```

---

## Task 20: 予定作成・編集フォーム(EventFormModal)

**Files:**
- Create: `frontend/src/features/events/EventFormModal.tsx`
- Create: `frontend/src/features/events/EventFormModal.test.tsx`

**Interfaces:**
- Consumes: `useCreateEvent`/`useUpdateEvent`(Task 19), `validateEventForm`(Task 19), `CalendarEvent`/`RecurrenceParams`(Task 19)
- Produces: `<EventFormModal event？={CalendarEvent} onClose={() => void} />`。`event`未指定なら新規作成、指定時は編集。バリデーションエラーがあれば送信せず`role="alert"`でエラーメッセージを表示する。

- [ ] **Step 1: 失敗するテストを書く**

`frontend/src/features/events/EventFormModal.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EventFormModal } from "./EventFormModal";

function renderModal(onClose = vi.fn()) {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <EventFormModal onClose={onClose} />
    </QueryClientProvider>
  );
  return { onClose };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

it("shows a validation error and does not submit when the title is blank", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const { onClose } = renderModal();

  await userEvent.click(screen.getByRole("button", { name: "保存" }));

  expect(screen.getByRole("alert")).toHaveTextContent("タイトルを入力してください");
  expect(fetchMock).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
});

it("submits a valid event and closes the modal", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        id: 1, title: "Lunch", start_at: "2026-08-10T12:00:00Z", end_at: "2026-08-10T13:00:00Z",
        all_day: false, recurring: false, recurrence: null,
      }),
      { status: 201 }
    )
  );
  vi.stubGlobal("fetch", fetchMock);
  const { onClose } = renderModal();

  await userEvent.type(screen.getByLabelText("タイトル"), "Lunch");
  fireEvent.change(screen.getByLabelText("開始日時"), { target: { value: "2026-08-10T12:00" } });
  fireEvent.change(screen.getByLabelText("終了日時"), { target: { value: "2026-08-10T13:00" } });
  await userEvent.click(screen.getByRole("button", { name: "保存" }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  expect(onClose).toHaveBeenCalled();
});

it("shows the interval field only when recurrence is enabled", async () => {
  renderModal();

  expect(screen.queryByLabelText("間隔")).not.toBeInTheDocument();
  await userEvent.click(screen.getByLabelText("繰り返す"));
  expect(screen.getByLabelText("間隔")).toBeInTheDocument();
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd frontend && npm test -- EventFormModal`
Expected: FAIL(`./EventFormModal`が存在しないため)

- [ ] **Step 3: EventFormModalを実装する**

`frontend/src/features/events/EventFormModal.tsx`:

```tsx
import { useState, type FormEvent } from "react";
import { useCreateEvent, useUpdateEvent } from "./hooks";
import { validateEventForm, type EventFormValues, type EventFormErrors } from "./validateEventForm";
import type { CalendarEvent, RecurrenceParams } from "./api";

type Props = {
  event?: CalendarEvent;
  onClose: () => void;
};

function toFormValues(event?: CalendarEvent): EventFormValues {
  return {
    title: event?.title ?? "",
    startAt: event ? event.start_at.slice(0, 16) : "",
    endAt: event ? event.end_at.slice(0, 16) : "",
    recurrenceEnabled: Boolean(event?.recurrence),
    frequency: event?.recurrence?.frequency ?? "weekly",
    interval: String(event?.recurrence?.interval ?? 1),
    until: event?.recurrence?.until ?? "",
  };
}

export function EventFormModal({ event, onClose }: Props) {
  const [values, setValues] = useState<EventFormValues>(() => toFormValues(event));
  const [errors, setErrors] = useState<EventFormErrors>({});
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const validationErrors = validateEventForm(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const recurrence: RecurrenceParams | null = values.recurrenceEnabled
      ? { frequency: values.frequency, interval: Number(values.interval), until: values.until || null }
      : null;

    const input = {
      title: values.title,
      start_at: new Date(values.startAt).toISOString(),
      end_at: new Date(values.endAt).toISOString(),
      recurrence,
    };

    if (event) {
      updateEvent.mutate({ id: event.id, input });
    } else {
      createEvent.mutate(input);
    }
    onClose();
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        タイトル
        <input value={values.title} onChange={(e) => setValues({ ...values, title: e.target.value })} />
      </label>
      {errors.title && <p role="alert">{errors.title}</p>}

      <label>
        開始日時
        <input
          type="datetime-local"
          value={values.startAt}
          onChange={(e) => setValues({ ...values, startAt: e.target.value })}
        />
      </label>
      {errors.startAt && <p role="alert">{errors.startAt}</p>}

      <label>
        終了日時
        <input
          type="datetime-local"
          value={values.endAt}
          onChange={(e) => setValues({ ...values, endAt: e.target.value })}
        />
      </label>
      {errors.endAt && <p role="alert">{errors.endAt}</p>}

      <label>
        繰り返す
        <input
          type="checkbox"
          checked={values.recurrenceEnabled}
          onChange={(e) => setValues({ ...values, recurrenceEnabled: e.target.checked })}
        />
      </label>

      {values.recurrenceEnabled && (
        <>
          <label>
            頻度
            <select
              value={values.frequency}
              onChange={(e) => setValues({ ...values, frequency: e.target.value as EventFormValues["frequency"] })}
            >
              <option value="daily">毎日</option>
              <option value="weekly">毎週</option>
              <option value="monthly">毎月</option>
            </select>
          </label>
          <label>
            間隔
            <input value={values.interval} onChange={(e) => setValues({ ...values, interval: e.target.value })} />
          </label>
          {errors.interval && <p role="alert">{errors.interval}</p>}
        </>
      )}

      {(createEvent.isError || updateEvent.isError) && <p role="alert">保存に失敗しました</p>}

      <button type="submit">保存</button>
      <button type="button" onClick={onClose}>
        キャンセル
      </button>
    </form>
  );
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd frontend && npm test -- EventFormModal`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/events
git commit -m "feat(frontend): add EventFormModal for creating and editing events"
```

---

## Task 21: 日付ユーティリティと月表示(MonthView)

**Files:**
- Create: `frontend/src/features/calendar/dateUtils.ts`
- Create: `frontend/src/features/calendar/dateUtils.test.ts`
- Create: `frontend/src/features/calendar/MonthView.tsx`
- Create: `frontend/src/features/calendar/MonthView.test.tsx`

**Interfaces:**
- Consumes: `useEvents`(Task 19)、`CalendarEvent`(Task 19)
- Produces: `getMonthGridDays(date: Date): Date[]`(42日分、日曜始まり)、`isSameDay(a, b): boolean`、`toDateKey(date): string`(`YYYY-MM-DD`、ローカル日付基準)。`<MonthView month={Date} onSelectEvent={(event: CalendarEvent) => void} />`(日ごとに予定を表示し、繰り返し予定には「(繰り返し)」を付与)。

- [ ] **Step 1: 失敗するテストを書く(日付ユーティリティ)**

`frontend/src/features/calendar/dateUtils.test.ts`:

```ts
import { getMonthGridDays, isSameDay, toDateKey } from "./dateUtils";

it("returns 42 days", () => {
  expect(getMonthGridDays(new Date(2026, 7, 15))).toHaveLength(42);
});

it("starts the grid on a Sunday and ends on a Saturday", () => {
  const days = getMonthGridDays(new Date(2026, 7, 15));
  expect(days[0].getDay()).toBe(0);
  expect(days[41].getDay()).toBe(6);
});

it("includes every day of the target month", () => {
  const days = getMonthGridDays(new Date(2026, 7, 15));
  const augustDays = days.filter((d) => d.getMonth() === 7);
  expect(augustDays).toHaveLength(31);
});

describe("isSameDay", () => {
  it("returns true for the same calendar day regardless of time", () => {
    expect(isSameDay(new Date(2026, 7, 10, 9, 0), new Date(2026, 7, 10, 23, 0))).toBe(true);
  });

  it("returns false for different days", () => {
    expect(isSameDay(new Date(2026, 7, 10), new Date(2026, 7, 11))).toBe(false);
  });
});

describe("toDateKey", () => {
  it("formats as YYYY-MM-DD using local date parts", () => {
    expect(toDateKey(new Date(2026, 7, 10))).toBe("2026-08-10");
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd frontend && npm test -- dateUtils`
Expected: FAIL(`./dateUtils`が存在しないため)

- [ ] **Step 3: 日付ユーティリティを実装する**

`frontend/src/features/calendar/dateUtils.ts`:

```ts
export function startOfMonthGrid(date: Date): Date {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = new Date(firstOfMonth);
  start.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());
  return start;
}

export function getMonthGridDays(date: Date): Date[] {
  const start = startOfMonthGrid(date);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
```

- [ ] **Step 4: dateUtilsのテストが通ることを確認する**

Run: `cd frontend && npm test -- dateUtils`
Expected: PASS (6 tests)

- [ ] **Step 5: 失敗するテストを書く(MonthView)**

`frontend/src/features/calendar/MonthView.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MonthView } from "./MonthView";

function renderMonthView() {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <MonthView month={new Date(2026, 7, 1)} onSelectEvent={vi.fn()} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

it("renders events on their day and marks recurring events", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 1, title: "Lunch", description: null, start_at: "2026-08-10T12:00:00+09:00",
            end_at: "2026-08-10T13:00:00+09:00", all_day: false, recurring: false,
          },
          {
            id: 2, title: "Standup", description: null, start_at: "2026-08-03T10:00:00+09:00",
            end_at: "2026-08-03T10:15:00+09:00", all_day: false, recurring: true,
          },
        ]),
        { status: 200 }
      )
    )
  );

  renderMonthView();

  await waitFor(() => screen.getByText("Lunch"));
  expect(screen.getByText("Lunch").closest("button")).not.toHaveTextContent("(繰り返し)");
  expect(screen.getByText("Standup").closest("button")).toHaveTextContent("(繰り返し)");
});
```

- [ ] **Step 6: テストが失敗することを確認する**

Run: `cd frontend && npm test -- MonthView`
Expected: FAIL(`./MonthView`が存在しないため)

- [ ] **Step 7: MonthViewを実装する**

`frontend/src/features/calendar/MonthView.tsx`:

```tsx
import { getMonthGridDays, isSameDay, toDateKey } from "./dateUtils";
import { useEvents } from "../events/hooks";
import type { CalendarEvent } from "../events/api";

type Props = {
  month: Date;
  onSelectEvent: (event: CalendarEvent) => void;
};

export function MonthView({ month, onSelectEvent }: Props) {
  const days = getMonthGridDays(month);
  const { data: events = [], isError } = useEvents(days[0], days[days.length - 1]);

  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = toDateKey(new Date(event.start_at));
    eventsByDay.set(key, [...(eventsByDay.get(key) ?? []), event]);
  }

  return (
    <div>
      {isError && <p role="alert">予定の取得に失敗しました</p>}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = toDateKey(day);
          return (
            <div key={key} className={isSameDay(day, month) ? "bg-blue-50" : ""}>
              <div>{day.getDate()}</div>
              {(eventsByDay.get(key) ?? []).map((event) => (
                <button key={`${event.id}-${event.start_at}`} onClick={() => onSelectEvent(event)}>
                  {event.title}
                  {event.recurring && <span> (繰り返し)</span>}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: テストが通ることを確認する**

Run: `cd frontend && npm test -- MonthView`
Expected: PASS (1 test)

- [ ] **Step 9: Commit**

```bash
git add frontend/src/features/calendar
git commit -m "feat(frontend): add date utilities and MonthView with recurrence indicator"
```

---

## Task 22: 週表示・日表示・切り替えとCalendarPage

**Files:**
- Modify: `frontend/src/features/calendar/dateUtils.ts`(`startOfWeek`/`getWeekDays`追加)
- Modify: `frontend/src/features/calendar/dateUtils.test.ts`
- Create: `frontend/src/features/calendar/WeekView.tsx`
- Create: `frontend/src/features/calendar/DayView.tsx`
- Create: `frontend/src/features/calendar/CalendarPage.tsx`
- Modify: `frontend/src/App.tsx`(`AuthGate`の認証済み表示を`CalendarPage`に差し替え)

**Interfaces:**
- Consumes: `useEvents`(Task 19), `isSameDay`/`toDateKey`(Task 21), `MonthView`(Task 21), `EventFormModal`(Task 20)
- Produces: `startOfWeek(date): Date`、`getWeekDays(date): Date[]`(7日分、日曜始まり)。`<WeekView weekStart={Date} onSelectEvent={...} />`、`<DayView day={Date} onSelectEvent={...} />`(ともに日/週内の予定をリスト表示)。`<CalendarPage />`(月/週/日の切り替えボタン、予定追加ボタン、選択中の予定があれば`EventFormModal`を開く。ルーティングライブラリは使わずローカルstateで表示モードを管理)。

- [ ] **Step 1: 失敗するテストを追記する(週の日付ユーティリティ)**

`frontend/src/features/calendar/dateUtils.test.ts`の末尾に追記:

```ts
import { getWeekDays } from "./dateUtils";

describe("getWeekDays", () => {
  it("returns 7 consecutive days starting on Sunday", () => {
    const days = getWeekDays(new Date(2026, 7, 12));
    expect(days).toHaveLength(7);
    expect(days[0].getDay()).toBe(0);
    expect(days[6].getDay()).toBe(6);
  });
});
```

(既存の`import { getMonthGridDays, isSameDay, toDateKey } from "./dateUtils";`の行に`getWeekDays`をまとめてもよい。)

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd frontend && npm test -- dateUtils`
Expected: FAIL(`getWeekDays`が未定義のため)

- [ ] **Step 3: `startOfWeek`/`getWeekDays`を実装する**

`frontend/src/features/calendar/dateUtils.ts`の末尾に追記:

```ts
export function startOfWeek(date: Date): Date {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  return start;
}

export function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd frontend && npm test -- dateUtils`
Expected: PASS (7 tests)

- [ ] **Step 5: WeekViewを実装する**

`frontend/src/features/calendar/WeekView.tsx`:

```tsx
import { getWeekDays, isSameDay, toDateKey } from "./dateUtils";
import { useEvents } from "../events/hooks";
import type { CalendarEvent } from "../events/api";

type Props = {
  weekStart: Date;
  onSelectEvent: (event: CalendarEvent) => void;
};

export function WeekView({ weekStart, onSelectEvent }: Props) {
  const days = getWeekDays(weekStart);
  const { data: events = [], isError } = useEvents(days[0], days[days.length - 1]);

  return (
    <div className="grid grid-cols-7">
      {isError && <p role="alert">予定の取得に失敗しました</p>}
      {days.map((day) => (
        <div key={toDateKey(day)}>
          <div>{day.toLocaleDateString()}</div>
          {events
            .filter((event) => isSameDay(new Date(event.start_at), day))
            .map((event) => (
              <button key={`${event.id}-${event.start_at}`} onClick={() => onSelectEvent(event)}>
                {event.title}
                {event.recurring && <span> (繰り返し)</span>}
              </button>
            ))}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: DayViewを実装する**

`frontend/src/features/calendar/DayView.tsx`:

```tsx
import { isSameDay } from "./dateUtils";
import { useEvents } from "../events/hooks";
import type { CalendarEvent } from "../events/api";

type Props = {
  day: Date;
  onSelectEvent: (event: CalendarEvent) => void;
};

export function DayView({ day, onSelectEvent }: Props) {
  const { data: events = [], isError } = useEvents(day, day);
  const dayEvents = events.filter((event) => isSameDay(new Date(event.start_at), day));

  return (
    <div>
      {isError && <p role="alert">予定の取得に失敗しました</p>}
      <div>{day.toLocaleDateString()}</div>
      {dayEvents.map((event) => (
        <button key={`${event.id}-${event.start_at}`} onClick={() => onSelectEvent(event)}>
          {event.title}
          {event.recurring && <span> (繰り返し)</span>}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 7: CalendarPageを実装する**

`frontend/src/features/calendar/CalendarPage.tsx`:

```tsx
import { useState } from "react";
import { MonthView } from "./MonthView";
import { WeekView } from "./WeekView";
import { DayView } from "./DayView";
import { EventFormModal } from "../events/EventFormModal";
import type { CalendarEvent } from "../events/api";

type ViewMode = "month" | "week" | "day";

export function CalendarPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate] = useState(new Date());
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>(undefined);
  const [isCreating, setIsCreating] = useState(false);

  const isModalOpen = isCreating || editingEvent !== undefined;

  function closeModal() {
    setIsCreating(false);
    setEditingEvent(undefined);
  }

  return (
    <div>
      <div>
        <button onClick={() => setViewMode("month")}>月</button>
        <button onClick={() => setViewMode("week")}>週</button>
        <button onClick={() => setViewMode("day")}>日</button>
        <button onClick={() => setIsCreating(true)}>予定を追加</button>
      </div>

      {viewMode === "month" && <MonthView month={currentDate} onSelectEvent={setEditingEvent} />}
      {viewMode === "week" && <WeekView weekStart={currentDate} onSelectEvent={setEditingEvent} />}
      {viewMode === "day" && <DayView day={currentDate} onSelectEvent={setEditingEvent} />}

      {isModalOpen && <EventFormModal event={editingEvent} onClose={closeModal} />}
    </div>
  );
}
```

- [ ] **Step 8: App.tsxの認証済み表示をCalendarPageに差し替える**

`frontend/src/App.tsx`の`AuthGate`関数を次の内容に置き換える:

```tsx
import { CalendarPage } from "./features/calendar/CalendarPage";

function AuthGate() {
  const { status, logout } = useAuth();

  if (status === "loading") return <div>Loading...</div>;
  if (status === "unauthenticated") return <GoogleLoginButton />;

  return (
    <div>
      <button onClick={() => void logout()}>Logout</button>
      <CalendarPage />
    </div>
  );
}
```

(`import { CalendarPage } from "./features/calendar/CalendarPage";`をファイル冒頭のimport群に追加する。)

- [ ] **Step 9: フロントエンドの全テストが通ることを確認する**

Run: `cd frontend && npm test`
Expected: PASS(既存の`App.test.tsx`は"Loading..."が消えることのみ検証しているため影響を受けない)

- [ ] **Step 10: ビルドが通ることを確認する**

Run: `cd frontend && npm run build`
Expected: 型エラーなくビルドが完了する

- [ ] **Step 11: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): add week/day views and wire CalendarPage into the app"
```

---

## Task 23: 月表示でのドラッグ&ドロップによる日付変更

**Files:**
- Create: `frontend/src/features/calendar/dragDrop.ts`
- Create: `frontend/src/features/calendar/dragDrop.test.ts`
- Modify: `frontend/src/features/calendar/MonthView.tsx`
- Modify: `frontend/src/setupTests.ts`(dnd-kitが内部で使う`ResizeObserver`のjsdom用ポリフィル追加)

**Interfaces:**
- Consumes: `CalendarEvent`(Task 19)、`useUpdateEvent`(Task 19)、`toDateKey`/`isSameDay`(Task 21)
- Produces: `computeDroppedDates(event: {start_at, end_at}, targetDateKey: string): {start_at: string, end_at: string} | null`(時刻・所要時間を保ったまま日付だけ移動。同じ日にドロップした場合は`null`)。MonthViewは繰り返し予定を除く単発予定のみドラッグ可能にし、ドロップ時に`useUpdateEvent`を呼ぶ。

- [ ] **Step 1: dnd-kitが使う`ResizeObserver`をjsdom用にポリフィルする**

`frontend/src/setupTests.ts`に追記:

```ts
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// @ts-expect-error jsdom does not implement ResizeObserver
global.ResizeObserver = ResizeObserverStub;
```

- [ ] **Step 2: 失敗するテストを書く(純粋関数)**

`frontend/src/features/calendar/dragDrop.test.ts`:

```ts
import { computeDroppedDates } from "./dragDrop";

it("shifts the date to the drop target while preserving time and duration", () => {
  const originalStart = new Date(2026, 7, 10, 12, 0);
  const originalEnd = new Date(2026, 7, 10, 13, 0);
  const event = { start_at: originalStart.toISOString(), end_at: originalEnd.toISOString() };

  const result = computeDroppedDates(event, "2026-08-15");

  expect(result).not.toBeNull();
  const newStart = new Date(result!.start_at);
  expect(newStart.getFullYear()).toBe(2026);
  expect(newStart.getMonth()).toBe(7);
  expect(newStart.getDate()).toBe(15);
  expect(newStart.getHours()).toBe(originalStart.getHours());
  expect(newStart.getMinutes()).toBe(originalStart.getMinutes());

  const durationMs = new Date(result!.end_at).getTime() - newStart.getTime();
  expect(durationMs).toBe(60 * 60 * 1000);
});

it("returns null when dropped on the same day", () => {
  const originalStart = new Date(2026, 7, 10, 12, 0);
  const originalEnd = new Date(2026, 7, 10, 13, 0);
  const event = { start_at: originalStart.toISOString(), end_at: originalEnd.toISOString() };
  const sameDayKey = [
    originalStart.getFullYear(),
    String(originalStart.getMonth() + 1).padStart(2, "0"),
    String(originalStart.getDate()).padStart(2, "0"),
  ].join("-");

  expect(computeDroppedDates(event, sameDayKey)).toBeNull();
});
```

- [ ] **Step 3: テストが失敗することを確認する**

Run: `cd frontend && npm test -- dragDrop`
Expected: FAIL(`./dragDrop`が存在しないため)

- [ ] **Step 4: `computeDroppedDates`を実装する**

`frontend/src/features/calendar/dragDrop.ts`:

```ts
export function computeDroppedDates(
  event: { start_at: string; end_at: string },
  targetDateKey: string
): { start_at: string; end_at: string } | null {
  const start = new Date(event.start_at);
  const end = new Date(event.end_at);
  const [year, month, day] = targetDateKey.split("-").map(Number);

  const newStart = new Date(start);
  newStart.setFullYear(year, month - 1, day);

  if (newStart.getTime() === start.getTime()) return null;

  const durationMs = end.getTime() - start.getTime();
  const newEnd = new Date(newStart.getTime() + durationMs);

  return { start_at: newStart.toISOString(), end_at: newEnd.toISOString() };
}
```

- [ ] **Step 5: テストが通ることを確認する**

Run: `cd frontend && npm test -- dragDrop`
Expected: PASS (2 tests)

- [ ] **Step 6: MonthViewにドラッグ&ドロップを組み込む**

`frontend/src/features/calendar/MonthView.tsx`を次の内容に置き換える:

```tsx
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { getMonthGridDays, isSameDay, toDateKey } from "./dateUtils";
import { computeDroppedDates } from "./dragDrop";
import { useEvents, useUpdateEvent } from "../events/hooks";
import type { CalendarEvent } from "../events/api";

type Props = {
  month: Date;
  onSelectEvent: (event: CalendarEvent) => void;
};

function EventChip({ event, onSelectEvent }: { event: CalendarEvent; onSelectEvent: (e: CalendarEvent) => void }) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `${event.id}:${event.start_at}`,
    disabled: event.recurring,
    data: { event },
  });

  return (
    <button ref={setNodeRef} {...listeners} {...attributes} onClick={() => onSelectEvent(event)}>
      {event.title}
      {event.recurring && <span> (繰り返し)</span>}
    </button>
  );
}

function DayCell({
  day,
  month,
  events,
  onSelectEvent,
}: {
  day: Date;
  month: Date;
  events: CalendarEvent[];
  onSelectEvent: (e: CalendarEvent) => void;
}) {
  const { setNodeRef } = useDroppable({ id: toDateKey(day) });

  return (
    <div ref={setNodeRef} className={isSameDay(day, month) ? "bg-blue-50" : ""}>
      <div>{day.getDate()}</div>
      {events.map((event) => (
        <EventChip key={`${event.id}-${event.start_at}`} event={event} onSelectEvent={onSelectEvent} />
      ))}
    </div>
  );
}

export function MonthView({ month, onSelectEvent }: Props) {
  const days = getMonthGridDays(month);
  const { data: events = [], isError } = useEvents(days[0], days[days.length - 1]);
  const updateEvent = useUpdateEvent();

  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = toDateKey(new Date(event.start_at));
    eventsByDay.set(key, [...(eventsByDay.get(key) ?? []), event]);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over) return;

    const event = active.data.current?.event as CalendarEvent | undefined;
    if (!event || event.recurring) return;

    const updated = computeDroppedDates(event, String(over.id));
    if (!updated) return;

    updateEvent.mutate({ id: event.id, input: updated });
  }

  return (
    <div>
      {isError && <p role="alert">予定の取得に失敗しました</p>}
      <DndContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = toDateKey(day);
            return (
              <DayCell
                key={key}
                day={day}
                month={month}
                events={eventsByDay.get(key) ?? []}
                onSelectEvent={onSelectEvent}
              />
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}
```

- [ ] **Step 7: 既存のMonthViewテストと全テストが通ることを確認する**

Run: `cd frontend && npm test`
Expected: PASS(Task 21で書いた`MonthView.test.tsx`は`EventChip`が同じテキスト・`<button>`構造を保っているため無修正で通る)

- [ ] **Step 8: ビルドが通ることを確認する**

Run: `cd frontend && npm run build`
Expected: 型エラーなくビルドが完了する

- [ ] **Step 9: Commit**

```bash
git add frontend/src/features/calendar frontend/src/setupTests.ts
git commit -m "feat(frontend): add drag-and-drop date change for non-recurring events"
```
