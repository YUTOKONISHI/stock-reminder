# 画面とルート

## 画面一覧

一般ユーザーの画面は `/app/*` に、管理者の画面は `/admin/*` に置く。
「ページ部品」は `resources/js/pages/` からの相対パスで、`Inertia::render` の第1引数に対応する。

### 一般ユーザー

| 画面 | URL | ページ部品 | 認証 |
|---|---|---|---|
| トップページ | `/app/welcome` | `welcome` | 不要 |
| ログイン | `/app/login` | `auth/login` | 不要 |
| 新規登録 | `/app/register` | `auth/register` | 不要 |
| パスワード忘却 | `/app/forgot-password` | `auth/forgot-password` | 不要 |
| パスワード再設定 | `/app/reset-password` | `auth/reset-password` | 不要 |
| ダッシュボード | `/app/dashboard` | `dashboard` | 要 |
| ストック一覧 | `/app/stocks` | `stocks/index` | 要 |
| ストック新規登録 | `/app/stocks/create` | `stocks/form` | 要 |
| ストック編集 | `/app/stocks/{stock}/edit` | `stocks/form` | 要 |
| Push通知 | `/app/notifications` | `notifications` | 要 |
| 設定メニュー | `/app/settings` | `settings/index` | 要 |
| 個人情報の変更 | `/app/settings/profile` | `settings/profile` | 要 |

ストックの新規登録と編集は同じページ部品を使う。
`stock` プロップが `null` なら新規、値が入っていれば編集として描く。

設定メニューは `Route::inertia` で直に描いており、コントローラを通らない。

### 管理者

| 画面 | URL | ページ部品 | 認証 |
|---|---|---|---|
| 管理者ログイン | `/admin/login` | `admin/login` | 不要 |
| マスタ管理 | `/admin/dashboard` | `admin/dashboard` | 要（`admin` ガード） |

管理者の操作（商品とカテゴリの追加、編集、削除、パスワード変更）はすべてマスタ管理画面の上で完結する。
追加と編集はモーダルで、専用の URL を持たない。

### 画面を持たないルート

Fortify の2要素認証は機能として有効になっており、`/app/two-factor-challenge` と `/app/user/two-factor-*` のルートが登録されている。
対応するページ部品は無く、画面からは使われていない。

## 画面遷移

### 一般ユーザー

```
/  ──▶ /app/welcome
/app ──▶ /app/dashboard（未ログインなら /app/login）
            │
            ├─▶ /app/login ──(成功)──▶ /app/dashboard
            │        │
            │        └─▶ /app/forgot-password ──(仮パスワード送信)──▶ /app/reset-password
            │                                                              │
            │                                                    (再設定)──▶ /app/login
            └─▶ /app/register ──(成功)──▶ /app/dashboard

/app/dashboard ─┬─▶ /app/stocks ─┬─▶ /app/stocks/create
                │                └─▶ /app/stocks/{id}/edit
                ├─▶ /app/notifications
                └─▶ /app/settings ──▶ /app/settings/profile
```

ダッシュボード、通知、設定の行き来は共通レイアウト `AppShell` のナビゲーションが担う。
画面幅が広いときはヘッダーに、狭いときは下部のタブに出る。
ストック一覧への導線はダッシュボードの中にある。

未ログインで認証が要る画面を開くと、`/app/*` は `/app/login` に、`/admin/*` は `/admin/login` に転送する。

### 管理者

```
/admin/login ──(成功)──▶ /admin/dashboard
```

ログアウトすると `/admin/login` に戻る。

## ルート一覧

`routes/web.php` に定義するもの。
ルート名は `route()` ヘルパと Wayfinder の生成物が使う。

### 一般ユーザー

| メソッド | URL | ルート名 | 処理 |
|---|---|---|---|
| GET | `/app` | なし | `/app/dashboard` へリダイレクト |
| GET | `/app/welcome` | `welcome` | トップページ |
| GET | `/app/forgot-password` | `forgot-password` | パスワード忘却画面 |
| POST | `/app/forgot-password` | `forgot-password.store` | 仮パスワードの発行とメール送信 |
| GET | `/app/reset-password` | `reset-password` | パスワード再設定画面 |
| POST | `/app/reset-password` | `reset-password.store` | パスワードの再設定 |
| GET | `/app/dashboard` | `dashboard` | ダッシュボード |
| GET | `/app/stocks` | `stocks.index` | ストック一覧 |
| GET | `/app/stocks/create` | `stocks.create` | ストック新規登録画面 |
| POST | `/app/stocks` | `stocks.store` | ストックの登録 |
| GET | `/app/stocks/{stock}/edit` | `stocks.edit` | ストック編集画面 |
| PUT | `/app/stocks/{stock}` | `stocks.update` | ストックの更新 |
| DELETE | `/app/stocks/{stock}` | `stocks.destroy` | ストックの削除 |
| PATCH | `/app/stocks/{stock}/purchase` | `stocks.purchase` | 購入済みの記録 |
| GET | `/app/notifications` | `notifications.index` | Push通知画面 |
| PATCH | `/app/notifications/{notificationLog}/read` | `notifications.read` | 通知を既読にする |
| PATCH | `/app/notifications/{notificationLog}/unread` | `notifications.unread` | 通知を未読に戻す |
| GET | `/app/settings` | `settings.index` | 設定メニュー |
| GET | `/app/settings/profile` | `profile.edit` | 個人情報の変更画面 |
| PUT | `/app/settings/profile` | `profile.update` | 個人情報の更新 |
| POST | `/app/push-subscriptions` | `push-subscriptions.store` | Push購読の登録 |
| DELETE | `/app/push-subscriptions` | `push-subscriptions.destroy` | Push購読の削除 |

`/app/dashboard` 以降は `auth` ミドルウェアの下にある。

パスワード忘却と再設定の POST には `throttle:6,1`（同一IPから毎分6回まで）を掛けている。

### Fortify が登録するもの

`config/fortify.php` の `prefix` を `app` にしているため、いずれも `/app/` の下に出る。

| メソッド | URL | ルート名 | 処理 |
|---|---|---|---|
| GET | `/app/login` | `login` | ログイン画面 |
| POST | `/app/login` | `login.store` | ログイン |
| POST | `/app/logout` | `logout` | ログアウト |
| GET | `/app/register` | `register` | 新規登録画面 |
| POST | `/app/register` | `register.store` | アカウント作成 |

### 管理者

| メソッド | URL | ルート名 | 処理 |
|---|---|---|---|
| GET | `/admin/login` | `admin.login` | 管理者ログイン画面 |
| POST | `/admin/login` | `admin.login.store` | 管理者ログイン |
| GET | `/admin/dashboard` | `admin.dashboard` | マスタ管理画面 |
| POST | `/admin/logout` | `admin.logout` | ログアウト |
| POST | `/admin/password` | `admin.admin-password` | 管理者パスワードの変更 |
| POST | `/admin/categories` | `admin.categories.store` | カテゴリの追加 |
| PUT | `/admin/categories/{category}` | `admin.categories.update` | カテゴリの更新 |
| DELETE | `/admin/categories/{category}` | `admin.categories.destroy` | カテゴリの削除 |
| POST | `/admin/products` | `admin.products.store` | 商品の追加 |
| PUT | `/admin/products/{product}` | `admin.products.update` | 商品の更新 |
| DELETE | `/admin/products/{product}` | `admin.products.destroy` | 商品の削除 |

`/admin/login` 以外は `auth:admin` ミドルウェアの下にある。

## 全画面で共有する props

`HandleInertiaRequests::share` が、すべての Inertia 応答に次を載せる。

| 名前 | 中身 |
|---|---|
| `name` | アプリケーション名（`config('app.name')`） |
| `auth.user` | ログイン中の `User`。未ログインなら `null` |
| `errors` | バリデーションエラー（Inertia の既定） |

`auth.user` は `$request->user()` すなわち `web` ガードのユーザーであり、管理者は載らない。

## レイアウト

一般ユーザーの認証後の画面は `shared/layouts/AppShell.tsx` で囲む。
`AppShell` はヘッダー、下部ナビゲーション、トースト表示枠を持ち、`title` と現在位置を表す `active` を受け取る。
レスポンシブ対応はここに集約している。

認証まわりの画面（ログイン、新規登録、パスワード忘却、パスワード再設定）は `shared/components/AuthCard.tsx` を使う。

管理画面は `features/admin/components/AdminHeader.tsx` を持つが、レスポンシブ対応の対象外である。
