# 認証とアカウント

セッション認証を使う。
トークン認証（Sanctum）は使わない。

ガードは2つあり、どちらも `session` ドライバである。

| ガード | 対象 | プロバイダ | モデル |
|---|---|---|---|
| `web` | 一般ユーザー | `users` | `App\Models\User` |
| `admin` | 管理者 | `admins` | `App\Models\Admin` |

セッションは DB に置く（`SESSION_DRIVER=database`、寿命120分）。
一般ユーザーは、ログイン状態の保持を選ぶとセッションが切れてもログインし直せる（後述）。

## 一般ユーザーの認証

Laravel Fortify が担う。
`config/fortify.php` の設定のうち、既定から変えたものは次のとおり。

| 設定 | 値 | 意味 |
|---|---|---|
| `guard` | `web` | |
| `username` | `email` | メールアドレスでログインする |
| `lowercase_usernames` | `true` | 照合前にメールアドレスを小文字化する |
| `prefix` | `app` | Fortify のルートを `/app/` の下に出す |
| `home` | `/app/dashboard` | ログイン後の行き先 |
| `redirects.logout` | `/app/login` | ログアウト後の行き先 |
| `features` | 登録、メール確認、2段階認証 | パスワードリセットは含めない（後述）。2段階認証は `confirm` と `confirmPassword` を有効にしている |

### 認証の流れ

`FortifyServiceProvider` が認証パイプラインを組み替えている。
順に `EnsureLoginIsNotThrottled`、`CanonicalizeUsername`、`RedirectIfTwoFactorAuthenticatable`、`AttemptToAuthenticate`、`PrepareAuthenticatedSession` を通す。
`RedirectIfTwoFactorAuthenticatable` は、2段階認証が有効な利用者をコード入力画面へ送る（後述）。

`AttemptToAuthenticate` は Fortify のものを継承し、失敗時の例外だけを差し替える。
エラーは `email` ではなく `auth_error` キーに載せ、「名前またはパスワードが正しくありません」を返す。
どちらが誤りかを画面に出さない。

回数制限は `login` リミッタで、メールアドレスとIPの組ごとに毎分5回までとする。

### ログイン状態の保持

ログイン画面の「ログイン状態を保持する」（初期値はチェックあり）は、`remember` として送られる。
`remember` が真なら、Laravel はセッションの cookie とは別に保持用の cookie（`remember_web_` で始まる名前）を発行する。
中身は「利用者ID｜`users.remember_token`｜パスワードハッシュの HMAC」で、APP_KEY で暗号化される。
属性はセッションの cookie と同じで、HttpOnly、本番では Secure、SameSite=Lax が付く。

セッションが無いリクエストにこの cookie が届くと、ID とトークンを DB と照らし合わせ、合えばその利用者でログインし直す。
期限は `config/auth.php` の `web` ガードの `remember` で30日とする。
期限は発行した時点から数え、使っても延びない。

`remember_token` は利用者ごとに1つなので、次の操作で作り直すと、すべての端末の保持用の cookie が無効になる。

- ログアウト（Laravel の `logout()` が作り直す）
- 設定画面でのパスワード変更（後述）
- パスワード忘却からの再設定

### 画面の割り当て

Fortify のビューは Inertia のページ部品に差し替える。

| Fortify のビュー | ページ部品 |
|---|---|
| ログイン | `auth/login` |
| 新規登録 | `auth/register` |
| メール確認待ち | `auth/verify-email` |
| 2段階認証のコード入力 | `auth/two-factor-challenge` |
| パスワード確認 | `auth/confirm-password` |

### アカウント作成

`App\Actions\Fortify\CreateNewUser` が担う。

| 入力 | 検証 |
|---|---|
| `name` | 必須、255文字以内 |
| `email` | 必須、メール形式、255文字以内、`users` で一意 |
| `password` | 必須、パスワード規則（後述）、確認入力と一致 |
| `cf-turnstile-response` | 必須、2048文字以内、Turnstile の確認に合格（後述）。ほかの項目がすべて通ってから確かめる |

世帯人数は登録時には受け取らない。
`household_size` は `null` で作られ、設定画面から入れる。

### ボット対策（Turnstile）

登録画面は Cloudflare Turnstile の枠を出し、取れたトークンを `cf-turnstile-response` として送る。
トークンが取れるまで、送信ボタンは押せない。
サーバは `App\Rules\Turnstile` で、トークンを siteverify に送って確かめる。

| 項目 | 内容 |
|---|---|
| キー | サイトキーは `TURNSTILE_SITE_KEY`（`Fortify::registerView` が `turnstileSiteKey` として画面に渡す）、シークレットキーは `TURNSTILE_SECRET_KEY` |
| 合格の条件 | `success` が真、`action` が `register`、`hostname` が `APP_URL` のホスト名と一致 |
| 不合格にする場合 | シークレットキーが無い、siteverify に届かない（5秒で打ち切る）、5xx を返した |
| テスト用のキー | シークレットキーが `1x0000000000000000000000000000000AA` のときは `action` と `hostname` を見ない。この組では `hostname` が常に `example.com` で、`action` も返らないため |

トークンは1回しか通らない。
差し戻されたら、画面は理由にかかわらず枠を作り直し、新しいトークンを取り直す。
決めた経緯は `doc/plans/20261107-turnstile-registration.md` にある。

### メールアドレスの確認

Fortify のメール確認を使う。
`User` が `MustVerifyEmail` を実装しているので、登録すると Laravel の `SendEmailVerificationNotification` が確認メール（`VerifyEmail` 通知）を送る。
文面は `AppServiceProvider` の `VerifyEmail::toMailUsing` で日本語に差し替えている。

メールのリンクは署名付き URL（`/app/email/verify/{id}/{hash}`）で、60分で使えなくなる。
開くとログイン中の利用者の `email_verified_at` に時刻が入り、`/app/dashboard` へ進む。

| 場合 | 結果 |
|---|---|
| 未ログインで開いた | `/app/login` を経てから確認が済む |
| 期限切れ、署名の不一致 | `/app/email/verify?expired=1` へ戻し、再送を促す（`bootstrap/app.php`） |
| 別の利用者でログインしている | 403 のエラー画面 |

`/app/*` の認証が要るルートには `verified` ミドルウェアを掛けている。
未確認の利用者は確認待ちの画面（`auth/verify-email`）へ送られ、そこから確認メールを再送できる。
再送とリンクの確認には、毎分6回までの制限が掛かる（Fortify の既定）。

登録から7日（`User::LIMIT_DAY`）たっても確認が済まないアカウントは、毎日3時（`Asia/Tokyo`）に `model:prune` が消す。
`User` の `prunable()` が対象の条件を返し、1件ずつ「アカウントの削除」と同じ手順で消す（削除完了メールは送らない）。
確認メールには、リンクの有効期限が切れたら再送すればよいことと、7日で登録が取り消されることを書いている。

期限までなら、アドレスの持ち主はパスワード忘却から再設定すれば確認済みにできる（後述）。

2026-11-03 のマイグレーションで、それ以前に登録した利用者は確認済みにした。

### 2段階認証

利用者は設定画面から、認証アプリのコード（TOTP）を使う2段階認証を任意で有効にできる。
`User` に Fortify の `TwoFactorAuthenticatable` を付けている。
`two_factor_secret` と `two_factor_recovery_codes` は `#[Hidden]` に入れ、`auth.user` として画面に渡さない。
決めた経緯は `doc/plans/20261106-two-factor-totp.md` にある。

#### ログインの流れ

`two_factor_confirmed_at` が入っている利用者は、パスワードが合ってもその場ではログインしない。
`RedirectIfTwoFactorAuthenticatable` が利用者IDと保持の選択をセッション（`login.id`、`login.remember`）に置き、コード入力画面（`/app/two-factor-challenge`）へ送る。
そこで認証アプリのコードかリカバリーコードを送り、合えばログインする。
ログイン画面で保持を選んでいれば、保持用の cookie はこの時点で発行される。

`RedirectIfTwoFactorAuthenticatable` は Fortify のものを継承し、パスワードが合わないときの例外だけを差し替える。
`AttemptToAuthenticate` と同じく、`auth_error` に「名前またはパスワードが正しくありません」を返す。

コードの送信は `two-factor` リミッタで、`login.id` ごとに毎分5回までとする。
コードが違うときの文言は、`lang/ja.json` で日本語にしている。

秘密の文字列はあっても確認が済んでいない利用者（設定中）は、パスワードだけでログインできる。

#### 設定画面

設定画面（`/app/settings/two-factor`、`TwoFactorController::show`）には `password.confirm` ミドルウェアを掛けている。
開く前にパスワードを入れ直させ（`auth/confirm-password`）、一度入れれば3時間（`config/auth.php` の `password_timeout`）は聞かない。
Fortify の有効化、確認、無効化、リカバリーコードの作り直しのルートも、`confirmPassword` の設定で同じ確認を求める。

画面は利用者の状態で3通りに描く。

| 状態 | 条件 | 画面に渡す値 |
|---|---|---|
| 無効（`disabled`） | `two_factor_secret` が空 | 状態だけ |
| 設定中（`pending`） | `two_factor_secret` はあるが `two_factor_confirmed_at` が空 | 認証アプリで読み取る画像（`twoFactorQrCodeSvg()` が返す SVG）と、手入力用の秘密の文字列 |
| 有効（`enabled`） | `two_factor_confirmed_at` がある | リカバリーコード |

有効にするまでは2段階に分かれる。
「有効にする」を押すと、Fortify が秘密の文字列と8つのリカバリーコードを作り、設定中になる。
認証アプリに登録して表示されたコードを送り、合えば `two_factor_confirmed_at` に時刻が入って有効になる。
コードが合わないとき、Fortify はエラーを `confirmTwoFactorAuthentication` のエラーバッグに入れるので、画面はこのバッグを指定して送る。

リカバリーコードは1つにつき1回使える。
使ったコードは、Fortify が新しいコードに置き換える。
有効の状態では、リカバリーコードの作り直しと、2段階認証の無効化ができる。
設定中の「やめる」も、無効化と同じルートで秘密の文字列を消す。

#### 無効にしたときのメール

`App\Actions\Fortify\DisableTwoFactorAuthentication` は Fortify の同名のクラスを継承し、`FortifyServiceProvider::register` でコンテナの割り当てを差し替えている。
外す前に `two_factor_confirmed_at` が入っていたときだけ、本人に `TwoFactorDisabled` を送る。
設定中に「やめる」で外したときは送らない。
設定画面の無効化と、後述の管理者のコマンドは、どちらもこのクラスを通る。

#### 認証アプリもリカバリーコードも使えないとき

コード入力画面の「認証アプリもリカバリーコードも使えない場合」から、管理者へ解除を依頼できる。
ログイン前の画面なので、管理者の連絡先は出さない。
依頼は `POST /app/two-factor-challenge/recovery-request`（`TwoFactorRecoveryRequestController`）が受け、次の順に確かめる。

1. セッションの `login.id` で利用者を引けなければ、`/app/login` へ戻す
2. 入力したメールアドレスがその利用者のものでなければ、`email` に「ログインに使ったメールアドレスを入力してください」を返す
3. 1時間以内に送れた依頼があれば、`email` に「依頼は受け付け済みです。1時間ほどおいてからお試しください」を返す

通れば、`ADMIN_ALERT_EMAIL`（`config('services.admin.alert_email')`）へ `TwoFactorRecoveryRequested` を送る。
本文には利用者ID、メールアドレス、依頼の日時、IPアドレスを書く。
続けて本人へ `TwoFactorRecoveryRequestReceived` を送り、心当たりが無ければパスワードを変えるよう伝える。
2通とも送れたときだけ、`RateLimiter` で `two-factor-recovery:{利用者ID}` を3600秒数える。
打ち間違いや送信の失敗まで数えると、困っている人が1時間ほど依頼を出し直せなくなるためである。
送れなかったときはエラーログに残し、`email` に「依頼を送れませんでした。時間をおいてもう一度お試しください」を返す。

管理者は、本人から返事を得てから `php artisan app:disable-two-factor {email}` で2段階認証を外す。
コマンドは上の `DisableTwoFactorAuthentication` を通すので、本人に `TwoFactorDisabled` が届く。
利用者が居なければ失敗の終了コードで終わり、秘密の文字列が無ければ何もせずに終わる。
外したことは `two-factor disabled by admin` としてログに残す。
外した後は、パスワードだけでログインできる。

## 管理者の認証

`App\Http\Controllers\Admin\AuthController` が担う。
Fortify は通さない。

ログインはユーザ名（`admin.name`）とパスワードで、`Auth::guard('admin')->attempt` に渡す。
成功したらセッションIDを再生成し、`/admin/dashboard` に送る。
`redirect()->intended` は使わない。`url.intended` は `web` ガードと `admin` ガードで共有され、`/app/*` の行き先が入っていると一般ユーザーのログイン画面へ戻されるためである。
失敗したら `auth_error` に「名前またはパスワードが正しくありません」を載せて戻す。

回数制限は `admin-login` リミッタで、ユーザ名とIPの組ごとに毎分5回までとする。
値も鍵の作り方も Fortify の `login` リミッタに揃えている。
定義は `AppServiceProvider` にある。

ログアウトはガードのログアウトに加えて、セッションの破棄と CSRF トークンの再生成を行う。

管理者のパスワード変更は同じコントローラの `updateAdminPassword` にある。
現在のパスワードを `current_password:admin` で照合したうえで、新しいパスワードにパスワード規則と確認入力の一致を求める。
ハッシュ化はモデルの `hashed` キャストが行う。

## 未認証時の行き先

`bootstrap/app.php` の `redirectGuestsTo` で、URL の接頭辞によって送り先を分ける。

| リクエスト先 | 転送先 |
|---|---|
| `/admin/*` | `/admin/login` |
| それ以外 | `/app/login` |

## パスワード規則

`AppServiceProvider` が `Password::defaults()` を環境で切り替える。

| 環境 | 規則 |
|---|---|
| 本番 | 8文字以上で、流出済みパスワードでないこと |
| 本番以外 | 8文字以上 |

流出済みかどうかは Have I Been Pwned に問い合わせて確かめる。
画面の入力チェックも8文字以上で、サーバの規則と揃えている。

この既定は `PasswordValidationRules` トレイトを通じて、アカウント作成、パスワード更新、パスワード再設定の3か所で使う。
管理者のパスワード変更も同じ `Password::default()` を使う。トレイトは通さず、コントローラで直に指定する。

## パスワード忘却と再設定

Fortify のパスワードリセットは使わない。
仮パスワードを発行してメールで送る方式を `PasswordResetController` に自前で持つ。

### 仮パスワードの発行

1. メールアドレスを受け取る（必須、メール形式）
2. 該当する利用者が居れば、8文字の仮パスワードを作る
3. そのハッシュを `password_reset_tokens` に、メールアドレスをキーとして書く（既にあれば上書き）
4. `TemporaryPasswordIssued` 通知をメールで送る
5. 利用者の有無にかかわらず、画面には「仮パスワードをメールで送信しました」を返す

登録の有無を応答から読み取られないよう、5では分岐しない。

仮パスワードの文字種は `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` である。
`0` と `O`、`1` と `I` は書き写しで取り違えるため除いている。

### 再設定

1. メールアドレス、仮パスワード、新しいパスワードを受け取る
2. `password_reset_tokens` の行を引き、仮パスワードのハッシュを照合する
3. 発行から60分（`config('auth.passwords.users.expire')`）を過ぎていれば、行を消して失敗とする
4. 新しいパスワードを保存し、`remember_token` を作り直す。未確認の利用者は確認済みにする（仮パスワードを受け取れたので、アドレスの持ち主と分かる）
5. 行を消し、`/app/login` に「パスワードを再設定しました」を添えて送る

行が無い、照合に失敗した、期限切れ、利用者が居ない、のいずれも同じ文言を返す。
「仮パスワードが正しくありません。もう一度発行してください。」

発行と再設定の POST には、どちらも同一IPから毎分6回までの制限を掛けている。

## 個人情報の変更

`ProfileController::update` が、Fortify の2つのアクションを1つのリクエストでまとめて呼ぶ。

| 入力 | 担当 | 検証 |
|---|---|---|
| `name` | `UpdateUserProfileInformation` | 必須、255文字以内 |
| `household_size` | `UpdateUserProfileInformation` | 任意、1以上の整数 |
| `current_password` | `UpdateUserPassword` | 必須（パスワードを変えるときだけ）、現在のパスワードと一致 |
| `password` | `UpdateUserPassword` | パスワード規則、確認入力と一致 |

`password` が空ならパスワードの更新は呼ばない。
プロフィールとパスワードの更新は同じトランザクションに入れており、片方だけが通る状態を作らない。

パスワードを変えると、ほかの端末からはログアウトさせ、変更した端末のログインは残す。

1. `UpdateUserPassword` が、パスワードと一緒に `remember_token` を作り直す。ほかの端末の保持用の cookie はトークンが合わなくなる
2. 同じトランザクションの中で、その利用者の `sessions` の行をすべて消す
3. コミットの後、`web` ガードの `login()` で変更した端末をログインし直す。セッションIDが作り直され、リクエストに保持用の cookie が付いていれば新しいトークンで発行し直す

## アカウントの削除

個人情報の変更画面の削除ボタンからダイアログを開き、パスワードを入力して確定する。
削除は物理削除で、復元はできない。

`ProfileController::destroy` が次の順に処理する。

1. `password` を必須とし、現在のパスワードと照合する。違えばダイアログにエラーを出す
2. `web` ガードからログアウトする
3. `User::prune()` を呼ぶ。トランザクションの中で、`push_subscriptions`、`password_reset_tokens`、`sessions`、`users` の順に該当行を消す
4. セッションを破棄し、CSRF トークンを作り直す
5. 登録していたメールアドレスへ `AccountDeleted` 通知（削除完了メール）を送る
6. `/app/login` へ送る

ログアウトを削除より先に呼ぶのは、`logout()` が `remember_token` を保存するためである。
`users` を消すと、`stocks` と `notification_logs` は外部キーの CASCADE で消える。
同じ利用者のほかの端末のセッションも消えるので、その端末は次のリクエストで `/app/login` へ送られる。

削除が成功すると、画面側で「アカウントを削除しました」のトーストを出し、その端末の Push 購読を解除する（`shared/lib/deviceSubscription.ts`）。

削除完了メールはキューを通さず、コミット後にリクエストの中で送る。
`users` の行はもう無いので、宛先は `Notification::route` でアドレスを直に指定する。
送信で例外が出ても削除は取り消さず、ログに利用者IDと例外を書く。
SMTP の `timeout` は設定していないので、メールサービスが応答しないあいだはレスポンスも返らない。

同じ利用者からの試行には、毎分6回までの制限を掛けている。
