# 非機能の実現方法

## サポートブラウザ

Chrome を対象とする。
iOS 16.4 以降の Safari は、ホーム画面に追加した場合に Push通知を受け取れる。ホーム画面への追加と Push通知は実機で確かめた。

| 環境 | Push通知 |
|---|---|
| Chrome（デスクトップ、Android） | 通る |
| macOS Safari 16 以降 | タブのままで通る見込み（未検証） |
| iOS 16.4 以降の Safari、タブ | 通らない。ホーム画面への追加を案内する（`needs-install`） |
| iOS 16.4 以降の Safari、ホーム画面から | 通る |
| アプリ内ブラウザ（Instagram、LINE など） | 通らない。Service Worker が無く、追加も案内しない |

iOS 16.3 以前のタブと macOS Safari 15 以前も `needs-install` に入り、案内が誤る。
UA でバージョンを読まずに済ませるため、許容している。

レスポンシブ対応は一般ユーザーの画面だけで、`AppShell` に集約する。
画面幅が広いときはヘッダーに、狭いときは下部のタブにナビゲーションを出す。
管理画面は対象外である。

## PWA

対象は一般ユーザーの画面（`/app/*`）に限る。

### スコープ

Service Worker は `resources/pwa/sw.js` に置き、`/app/sw.js` から配信する。
配信元が `/app/` の下にあるため、スコープは `/app/` になる。
管理画面はスコープの外にあり、そもそも制御されない。
「管理画面はPWA化しない」はこの配信元だけで担保しており、`fetch` の中で `/admin` を除く処理は無い。

マニフェストとオフライン画面も同じく `resources/pwa/` に置き、`/app/` の下で配信する。
`public/app/` に置くと、ディレクトリが実在するせいで `/app` へのアクセスが Laravel に届かない。
配信は `routes/pwa.php` の `PwaController` が受け持つ。
`web` ミドルウェアを通さないので、取得のたびにセッションを作らない。

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
`VERSION` は `PwaController` が配信時に埋める。
値は Vite のマニフェストとオフライン画面のハッシュから作るので、手で上げる必要はない。

### マニフェスト

`resources/pwa/manifest.webmanifest`。`/app/manifest.webmanifest` から配信する。
`start_url` は `/app/dashboard`、`scope` は `/app/`、表示は `standalone` とする。
アイコンは `public/icons/` に192、512、マスク可能512の3種を置く。

### インストールの案内

ダッシュボードで、画面の下に浮かせたカード（`InstallCard`）を出す。スマホでは下部タブの上、PCでは右下に置く。

| 環境 | 中身 |
|---|---|
| `beforeinstallprompt` が届いた（Chrome） | ブラウザのダイアログを開くボタン |
| `needs-install` と同じ条件（iOS Safari のタブ） | ホーム画面への追加の手順 |
| それ以外 | 出さない |

`beforeinstallprompt` は `app.tsx` で受け取って保持し、ブラウザ既定のインストール案内は抑える。
「今はしない」か×（手順のカードのみ）で閉じたこと、またはダイアログでキャンセルしたことは `localStorage` に端末単位で記録し、以後は出さない。

## ログ

### リクエストログ

`App\Http\Middleware\LogRequest` を、グローバルミドルウェアとして登録する。
`web` グループではなくグローバルに置くのは、グループの外にあるルートを取りこぼさないためである。

記録は `handle` ではなく `terminate` で行う。
応答を返し終えてから走るので、書き込みが利用者の待ち時間に乗らない。

対象はルートに乗る全リクエストで、GET も含む。
除くのはヘルスチェック（`/up`）と Laravel Boost の開発用エンドポイント（`/_boost/*`）である。
`/build/*` の静的資産は PHP に届かないため、除外の指定は要らない。

出力先は `request` チャンネルである。
`stack` ドライバで、束ねるチャンネルを `LOG_REQUEST_STACK` で決める。
既定は `request_daily` で、`daily` ドライバの `storage/logs/request-YYYY-MM-DD.log` に書く。
保持日数は `LOG_REQUEST_DAYS`（既定14日）で決める。
本番（Fly.io）は `stderr` にする。

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

`password`、`password_confirmation`、`current_password`、`temporary_password`、`token`、`_token`、`email`、 `auth`、 `p256dh`、 `endpoint`、`code`、`recovery_code`

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
日付だけの値（`stocks.next_purchase_date`、`stocks.last_purchased_on`）は `date` で持ち、Eloquent 側で `date:Y-m-d` にキャストして、画面には `YYYY-MM-DD` で渡す。
画面側の日付の比較は、この文字列同士で行う。

`AppServiceProvider` で `Date::use(CarbonImmutable::class)` を設定しており、日時は不変オブジェクトとして扱う。

スケジューラの実行時刻は `timezone('Asia/Tokyo')` を明示する。

## セキュリティ

| 対策 | 実現方法 |
|---|---|
| CSRF | Laravel の `web` ミドルウェアグループが担う。Inertia が `XSRF-TOKEN` クッキーを送り返す |
| XSS | React が描画時にエスケープする。`dangerouslySetInnerHTML` は使わない。入り込んだスクリプトは CSP で動かさない |
| クリックジャッキング | `X-Frame-Options: DENY` と CSP の `frame-ancestors 'none'` で、他のサイトの `iframe` に表示させない |
| パスワードの保管 | モデルの `hashed` キャストでハッシュ化する。`password` と `remember_token` は JSON から隠す |
| 総当たり | 一般ユーザーと管理者のログインはどちらも毎分5回、パスワード忘却、再設定、アカウントの削除は毎分6回に制限する |
| ボットによる登録 | 新規登録に Cloudflare Turnstile を掛ける（`doc/design/auth.md`） |
| 越権 | ストックと通知履歴の操作は、対象の `user_id` を照合して違えば 403 を返す |
| 個人データのキャッシュ | Service Worker で HTML をキャッシュしない |
| 本番での破壊的なDB操作 | `DB::prohibitDestructiveCommands` を本番で有効にする |

`/api/*` へのリクエストは例外を JSON で返す設定にしてあるが、該当するルートは無い。

### 送信元IP

`$request->ip()` が返す送信元IPは、`ResolveClientIp` ミドルウェアが決める。
`bootstrap/app.php` の `$middleware->prepend()` で全リクエストの先頭に置き、接続元（`REMOTE_ADDR`）を次の値に書き換える。

1. `Fly-Client-IP` が無いか、IPアドレスの形でなければ、書き換えない（ローカルとテスト）
2. `Fly-Client-IP` が Cloudflare の範囲（`config('services.cloudflare.proxy_ips')`）に入り、`CF-Connecting-IP` がIPアドレスの形なら、`CF-Connecting-IP`
3. それ以外は `Fly-Client-IP`

`trustProxies` が読むヘッダは `X-Forwarded-Proto` だけにしている。
`X-Forwarded-For` と `X-Forwarded-Host` は送り手が書けるので、送信元IPにも URL の生成にも使わない。
Cloudflare の範囲は公開されている一覧の写しで、一覧が変わったら `config/services.php` を直す。

### Cloudflare を通らないアクセス

本番は Cloudflare のプロキシの後ろにあるが、`stock-reminder.fly.dev` や Fly.io の IP アドレスへ直接つなぐこともできる。
これを `RequireOriginAuth` ミドルウェアで断る。
`ResolveClientIp` の次に、全リクエストに掛けている。

Cloudflare の Transform Rule が、`stock.deployshelf.dev` へのリクエストに `X-Origin-Auth` ヘッダを付ける。
値は `ORIGIN_AUTH_SECRET`（本番は Fly の secrets）と同じで、一致しなければ 403 を返す。
ヘルスチェックの `/up` は照合しない。
`ORIGIN_AUTH_SECRET` が空のとき（ローカルとテスト）も照合しない。

秘密の値を変えるときは、Transform Rule を先に新しい値へ変えると、`fly secrets set` が反映されるまでの間すべてのリクエストが断られる。
変える間は一時的に `fly secrets unset ORIGIN_AUTH_SECRET` で照合を止め、Transform Rule を直してから新しい値を置く。

### Cloudflare の設定

Cloudflare 側の設定はダッシュボードにあり、リポジトリには無い。
変えたらここを直す。

| 設定 | 値 |
|---|---|
| `stock` の A と AAAA | プロキシあり |
| SSL/TLS の暗号化モード | Full (strict) |
| Email Address Obfuscation、Rocket Loader | オフ。HTML を書き換え、CSP や Inertia のページのデータとぶつかるため |
| Web Analytics | 登録しない |
| Transform Rule | `X-Origin-Auth` を付ける（上の節） |

WAF のルールは次の3つである。

| 名前 | 種類 | 条件 | 動作 |
|---|---|---|---|
| `block-scanner-paths` | カスタムルール | パスが `/.env`、`/wp-login.php`、`/xmlrpc.php`、`/wp-admin`、`/phpmyadmin` のどれか、または `/.git` で始まる | Block |
| `admin-japan-only` | カスタムルール | パスが `/admin` で始まり、国が日本以外 | Block |
| `login-rate-limit` | レート制限 | パスが `/app/login` か `/admin/login` で、同じ IP アドレスから10秒間に5回を超える | 10秒間 Block |

`/admin` 以下には Cloudflare Access も掛けている。
許可するのは開発者のメールアドレスだけで、ログインの方法は One-time PIN、セッションは24時間である。
Access のセッションが切れた後に管理画面で操作すると、Inertia の通信が Access のログイン画面へのリダイレクトを受けて失敗する。
ページを再読み込みすれば、Access のログイン画面が出る。

### セキュリティヘッダ

`SetSecurityHeaders` ミドルウェアが、レスポンスに次のヘッダを付ける。
`bootstrap/app.php` の `$middleware->append()` で登録しているので、`web` グループを通らない `routes/pwa.php` のルートと、どのルートにも当たらない 404 にも付く。

| ヘッダ | 値 |
|---|---|
| `Content-Security-Policy` | 下の表 |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Strict-Transport-Security` | `max-age=31536000`。本番だけ |

CSP の値は次のとおり。
フォントはビルド時に取り込んで `public/build` から配っているので、フォントには外部のドメインを許可していない。
外部のドメインは、新規登録の Turnstile が使う `https://challenges.cloudflare.com` だけを `script-src` と `frame-src` に許可している。

| 項目 | 値 |
|---|---|
| `default-src` | `'self'` |
| `script-src` | `'self' 'nonce-…' https://challenges.cloudflare.com` |
| `style-src` | `'self' 'unsafe-inline'` |
| `img-src` | `'self' data:` |
| `font-src` | `'self'` |
| `connect-src` | `'self'` |
| `frame-src` | `https://challenges.cloudflare.com` |
| `object-src` | `'none'` |
| `base-uri` | `'self'` |
| `form-action` | `'self'` |
| `frame-ancestors` | `'none'` |

nonce はリクエストごとに `Vite::useCspNonce()` で作り、`@vite`、`@viteReactRefresh`、`@fonts` が書き出すタグに付く。
コントローラがページを描画する前に作る必要があるので、ミドルウェアは `$next($request)` より前に呼ぶ。

`style-src` には nonce を書かない。
Radix がポップオーバーなどの位置を `style` 属性で指定しており、これを通すには `'unsafe-inline'` が要る。
CSP の仕様では、nonce を書くと `'unsafe-inline'` が無視される。

`npm run dev` の間（`Vite::isRunningHot()` が真のとき）は、`public/hot` に書かれた開発サーバの URL を `script-src`、`style-src`、`font-src`、`img-src`、`connect-src` に足す。
`connect-src` には、HMR の WebSocket 用に `ws://` の URL も足す。

FrankenPHP が `public` から直接返す静的ファイル（ビルド済みの JS と CSS、フォント、アイコン）は PHP を通らないので、ヘッダが付かない。
CSP とクリックジャッキング対策が効くのは HTML のページなので、守りは変わらない。

## エラー時の表示

### エラー画面

`bootstrap/app.php` の `$exceptions->respond()` が、例外から作られたレスポンスのステータスコードを見て、Inertia のページコンポーネント `error` に差し替える。
ステータスコードはそのまま保ち、props の `code` にも渡す。

| ステータスコード | 見出し | 「読み込みなおす」ボタン |
|---|---|---|
| 403 | このページは開くことができません | 無し |
| 404 | ページが見つかりません | 無し |
| 419 | ページの有効期限が切れました | 有り |
| 500 以上 | 問題が発生しました | 有り |

これ以外のステータスコード（入力エラーのリダイレクトなど）は、元のレスポンスのまま返す。
`APP_DEBUG` が有効なときも差し替えず、Laravel の詳細なエラー画面を返す。

画面は `resources/js/pages/error.tsx` が描く。
`AppShell` は使わず、ログインしていなくても同じ画面を出す。
「読み込みなおす」は `window.location.reload()` でページ全体を読み込み直す。
「ダッシュボードへ戻る」の行き先は、パスが `/admin/` で始まれば `/admin/dashboard`、それ以外は `/app/dashboard` である。

### 通信の失敗

`resources/js/shared/lib/registerRequestErrorToasts.ts` が、Inertia のイベントを `router.on` で受けてトーストを出す。
`app.tsx` が起動時に1回呼ぶ。

| イベント | 起きたこと | トースト |
|---|---|---|
| `networkError` | サーバに届かなかった | 通信できませんでした（接続を確認して、もう一度お試しください。） |
| `httpException` | Inertia 形式でないレスポンスが返った | エラーが発生しました。 |

どちらも `preventDefault()` で Inertia の既定の動きを止める。
`httpException` の既定の動きは、レスポンスの HTML をモーダルで出すことである。

画面は遷移せず、入力した内容も残る。
トーストを描く `Toaster` は `AppShell`、`AuthCard`、管理画面のダッシュボードに置いてある。

アプリを開く時点でオフラインなら、Service Worker がオフライン画面（`resources/pwa/offline.html`）を返す。

## バックアップ

`app:backup-database` が `pg_dump` のカスタム形式でダンプを取り、`backup` ディスクの `db/YYYYMMDD-HHMMSS.dump` に送る。
同じ実行の中で、最終更新から30日を過ぎたファイルを消す。
スケジューラが毎日4時（`Asia/Tokyo`）に `onOneServer()` 付きで実行する。

`backup` ディスクは S3 互換のドライバで、本番は Fly.io の Tigris を指す。
接続情報は `AWS_ACCESS_KEY_ID`、`AWS_SECRET_ACCESS_KEY`、`AWS_ENDPOINT_URL_S3`、`AWS_REGION`、`BUCKET_NAME` から読む。

`app:restore-database {file?}` が復元する。
ファイルを省くと一覧を出す。
`pg_restore` を `--clean --if-exists --single-transaction` で実行し、`--database` で復元先を変えられる。

本番では scheduler のマシンで実行する（`fly status -a stock-reminder` でマシンの ID が分かる）。

```bash
# バックアップの一覧
fly ssh console -a stock-reminder --machine <scheduler の ID> -C "php artisan app:restore-database"

# 本番の DB を置き換える（確認が出る）
fly ssh console -a stock-reminder --machine <scheduler の ID> --pty -C "php artisan app:restore-database 20261024-223620.dump"
```

`--database=<名前>` で、先に作っておいた別のデータベースへ戻せる。本番を置き換える前に中身を確かめたいときに使う。

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
| Unit | Pest 4 | `tests/Unit/` | 3 | 12 |
| Feature | Pest 4 | `tests/Feature/` | 17 | 141 |
| フロントエンド | Vitest 5 | 対象ファイルの隣（`resources/js/**/*.test.ts(x)`） | 14 | 131 |

Unit は DB に触れない算出とログの主体判定を見る。
Feature は HTTP の入口から通し、`RefreshDatabase` でマイグレーションを流す。
フロントエンドは jsdom 上で `@testing-library/react` を使い、`@inertiajs/react` と `sonner` を差し替える。

絞り込みと並べ替えはコントローラの担当なので、コンポーネントのテストでは追わない。
決めた経緯と対象の一覧は `doc/plans/20260912-testing-framework.md` にある。

### CI

GitHub Actions のワークフローは2つある。

| ファイル | 内容 |
|---|---|
| `.github/workflows/tests.yml` | `quality` ジョブで Pint、Prettier、ESLint。`ci` ジョブで PHPStan、`tsc`、Vitest、`artisan test`（PHP 8.4 と 8.5 の2通り） |
| `.github/workflows/deploy.yml` | `main` への push で `tests` が通ったら、`flyctl deploy` で Fly.io にデプロイする |

`tests.yml` は postgres のサービスコンテナを立てる。
`.env.example` の `DB_HOST=pgsql` は `compose.yaml` のサービス名で、ランナーからは名前が引けないため、
`Tests` の工程だけ `DB_HOST=127.0.0.1` に向けている。

`deploy.yml` は `workflow_run` で `tests` の完了を待つ。
`tests` が成功し、きっかけが push のときだけ動く。
デプロイには secret の `FLY_API_TOKEN` を使う。`stock-reminder` だけを扱えるデプロイ用のトークンで、有効期限は1年である。
