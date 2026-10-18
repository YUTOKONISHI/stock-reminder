# 非機能の実現方法

## サポートブラウザ

Chrome を対象とする。

レスポンシブ対応は一般ユーザーの画面だけで、`AppShell` に集約する。
画面幅が広いときはヘッダーに、狭いときは下部のタブにナビゲーションを出す。
管理画面は対象外である。

## PWA

対象は一般ユーザーの画面（`/app/*`）に限る。

### スコープ

Service Worker は `public/app/sw.js` に置く。
`/app/sw.js` から配信されるため、スコープは `/app/` になる。
管理画面はスコープの外にあり、そもそも制御されない。
「管理画面はPWA化しない」はこの配置だけで担保しており、`fetch` の中で `/admin` を除く処理は無い。

一般ユーザーの画面を `/app` の外に出すと、その画面がスコープから外れる。
ルートを足すときは `routes/web.php` の `app` グループの中に入れる。

### 登録

`resources/js/app.tsx` が、本番ビルドで、かつ現在のパスが `/app/` から始まるときだけ登録する。
開発中は登録しない。

### キャッシュ

| 対象 | 扱い |
|---|---|
| 画面遷移（`navigate`） | ネットワークに取りに行く。失敗したらオフライン画面（`/app/offline.html`）を返す |
| `/build/assets/` 以下 | キャッシュを先に見て、無ければ取得して入れる |
| それ以外 | 素通し |

HTML はキャッシュしない。
Inertia が `data-page` 属性にログイン中の利用者の props を埋め込むため、キャッシュがそのまま個人データの流出になる。
キャッシュはオリジン単位で共有され、ログアウトしても消えない。

オフラインではオフライン用の画面を出すだけで、データの閲覧はできない。

キャッシュ名には `VERSION` を含める。
`activate` で、その版に属さないキャッシュをすべて消す。
配布のたびに `VERSION` を上げる。

### マニフェスト

`public/app/manifest.webmanifest`。
`start_url` は `/app/dashboard`、`scope` は `/app/`、表示は `standalone` とする。
アイコンは `public/icons/` に192、512、マスク可能512の3種を置く。

## ログ

### リクエストログ

`App\Http\Middleware\LogRequest` を、グローバルミドルウェアとして登録する。
`web` グループではなくグローバルに置くのは、グループの外にあるルートを取りこぼさないためである。

記録は `handle` ではなく `terminate` で行う。
応答を返し終えてから走るので、書き込みが利用者の待ち時間に乗らない。

対象はルートに乗る全リクエストで、GET も含む。
除くのはヘルスチェック（`/up`）と Laravel Boost の開発用エンドポイント（`/_boost/*`）である。
`/build/*` の静的資産は PHP に届かないため、除外の指定は要らない。

出力先は `request` チャンネルで、`daily` ドライバの `storage/logs/request-YYYY-MM-DD.log` に書く。
保持日数は `LOG_REQUEST_DAYS`（既定14日）で決める。

| 項目 | 中身 |
|---|---|
| `method` | HTTPメソッド |
| `path` | 先頭に `/` を付けたパス |
| `status` | 応答のステータスコード |
| `duration_ms` | `LARAVEL_START` からの経過ミリ秒。定数が無ければ `null` |
| `user_id` / `guard` | 下記 |
| `ip` | 送信元IP |
| `input` | リクエストの入力。下記の鍵は伏せる |

ログのレベルはステータスで振り分ける。

| ステータス | レベル |
|---|---|
| 500以上 | `error` |
| 400以上 | `warning` |
| それ以外 | `info` |

### 主体の特定

`App\Support\LogContext::actor()` が `web`、`admin` の順にガードを見て、最初に一致したガードの名前とIDを返す。
どちらでもログインしていなければ、どちらも `null` を返す。

`Auth::id()` を使わない。
既定ガードの `web` しか見ないため、管理画面のリクエストが匿名として残る。

同じ判定を例外の文脈でも使う。

### 入力の伏せ字

次の鍵の値を `[FILTERED]` に置き換える。
入れ子になった配列も再帰的にたどる。

`password`、`password_confirmation`、`current_password`、`temporary_password`、`token`、`_token`、`email`

鍵の一覧は `LogRequest::FILTERED_KEYS` の1箇所にある。

仮パスワードの発行はメールアドレスしか受け取らないので、生成した仮パスワードは入力には現れない。
ファイルの送信は現状どの画面にも無い。

### エラーログ

例外は Laravel の既定どおり `laravel.log` に積む。
記録の経路には手を入れず、`bootstrap/app.php` の `$exceptions->context()` で文脈だけを足す。

足すのは `method`、`path`、`user_id`、`guard`、`ip` である。

`context()` はコンソールの実行でも呼ばれる。
スケジューラから出た例外に `path` を書くと `/` になって誤解を招くので、`runningInConsole()` のときは何も足さない。

ログの閲覧画面は無い。
外部のログ基盤への転送もしていない。

## タイムゾーン

アプリケーションもDB接続も `Asia/Tokyo` に揃える。

| 設定 | 値 |
|---|---|
| `APP_TIMEZONE` | `Asia/Tokyo` |
| `DB_TIMEZONE`（`config/database.php` の `pgsql.timezone`） | `Asia/Tokyo` |

日時列はすべて `timestamptz` で持つ。
日付として扱う `stocks.next_purchase_date` は、Eloquent 側で `date:Y-m-d` にキャストして、画面には `YYYY-MM-DD` で渡す。
画面側の日付の比較は、この文字列同士で行う。

`AppServiceProvider` で `Date::use(CarbonImmutable::class)` を設定しており、日時は不変オブジェクトとして扱う。

スケジューラの実行時刻は `timezone('Asia/Tokyo')` を明示する。

## セキュリティ

| 対策 | 実現方法 |
|---|---|
| CSRF | Laravel の `web` ミドルウェアグループが担う。Inertia が `XSRF-TOKEN` クッキーを送り返す |
| XSS | React が描画時にエスケープする。`dangerouslySetInnerHTML` は使わない |
| パスワードの保管 | モデルの `hashed` キャストでハッシュ化する。`password` と `remember_token` は JSON から隠す |
| 総当たり | 一般ユーザーと管理者のログインはどちらも毎分5回、パスワード忘却と再設定は毎分6回に制限する |
| 越権 | ストックと通知履歴の操作は、対象の `user_id` を照合して違えば 403 を返す |
| 個人データのキャッシュ | Service Worker で HTML をキャッシュしない |
| 本番での破壊的なDB操作 | `DB::prohibitDestructiveCommands` を本番で有効にする |

`/api/*` へのリクエストは例外を JSON で返す設定にしてあるが、該当するルートは無い。

## ページ送り

一覧はいずれもサーバ側で切る。

| 一覧 | 1ページの件数 |
|---|---|
| ストック一覧 | 20 |
| 通知履歴 | 20 |
| 管理画面の商品一覧 | 50 |

ダッシュボードのストックはページ送りしない。
カレンダーが全件の予定日を必要とするためである。

画面側は `shared/components/Pagination.tsx` が描く。

## 開発と検証

Laravel Sail（Docker）で動かす。
コマンドは `./vendor/bin/sail ...` に揃える。

`composer ci:check` が次を順に実行する。

1. `npm run lint:check`（ESLint）
2. `npm run format:check`（Prettier）
3. `npm run types:check`（`tsc --noEmit`）
4. `npm run test`（Vitest）
5. `composer test`（Pint、PHPStan、`artisan test`）

PHPStan は level 7 で、`app/`、`bootstrap/app.php`、`config/`、`database/`、`routes/` を見る。
`tests/` は見ない。

### 自動テスト

| 層 | 道具 | 置き場 | ファイル | 件数 |
|---|---|---|---|---|
| Unit | Pest 4 | `tests/Unit/` | 3 | 7 |
| Feature | Pest 4 | `tests/Feature/` | 13 | 112 |
| フロントエンド | Vitest 5 | 対象ファイルの隣（`resources/js/**/*.test.ts(x)`） | 10 | 95 |

Unit は DB に触れない算出とログの主体判定を見る。
Feature は HTTP の入口から通し、`RefreshDatabase` でマイグレーションを流す。
フロントエンドは jsdom 上で `@testing-library/react` を使い、`@inertiajs/react` と `sonner` を差し替える。

絞り込みと並べ替えはコントローラの担当なので、コンポーネントのテストでは追わない。
決めた経緯と対象の一覧は `doc/plans/20260912-testing-framework.md` にある。

### CI

GitHub Actions のワークフローは2つある。

| ファイル | 内容 |
|---|---|
| `.github/workflows/lint.yml` | Pint、Prettier、ESLint |
| `.github/workflows/tests.yml` | PHPStan、`tsc`、Vitest、`artisan test`。PHP 8.4 と 8.5 の2通り |

`tests.yml` は postgres のサービスコンテナを立てる。
`.env.example` の `DB_HOST=pgsql` は `compose.yaml` のサービス名で、ランナーからは名前が引けないため、
`Tests` の工程だけ `DB_HOST=127.0.0.1` に向けている。
