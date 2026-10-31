# 認証とアカウント

セッション認証を使う。
トークン認証（Sanctum）は使わない。

ガードは2つあり、どちらも `session` ドライバである。

| ガード | 対象 | プロバイダ | モデル |
|---|---|---|---|
| `web` | 一般ユーザー | `users` | `App\Models\User` |
| `admin` | 管理者 | `admins` | `App\Models\Admin` |

セッションは DB に置く（`SESSION_DRIVER=database`、寿命120分）。

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
| `features` | 登録、2要素認証 | パスワードリセットは含めない（後述） |

### 認証の流れ

`FortifyServiceProvider` が認証パイプラインを組み替えている。
順に `EnsureLoginIsNotThrottled`、`CanonicalizeUsername`、`AttemptToAuthenticate`、`PrepareAuthenticatedSession` を通す。

`AttemptToAuthenticate` は Fortify のものを継承し、失敗時の例外だけを差し替える。
エラーは `email` ではなく `auth_error` キーに載せ、「名前またはパスワードが正しくありません」を返す。
どちらが誤りかを画面に出さない。

回数制限は `login` リミッタで、メールアドレスとIPの組ごとに毎分5回までとする。

### 画面の割り当て

Fortify のビューは Inertia のページ部品に差し替える。

| Fortify のビュー | ページ部品 |
|---|---|
| ログイン | `auth/login` |
| 新規登録 | `auth/register` |

### アカウント作成

`App\Actions\Fortify\CreateNewUser` が担う。

| 入力 | 検証 |
|---|---|
| `name` | 必須、255文字以内 |
| `email` | 必須、メール形式、255文字以内、`users` で一意 |
| `password` | 必須、パスワード規則（後述）、確認入力と一致 |

世帯人数は登録時には受け取らない。
`household_size` は `null` で作られ、設定画面から入れる。

### 2要素認証

機能としては有効で、ルートと `users` の列は用意されている。
画面は作っておらず、利用者が有効化する導線は無い。

## 管理者の認証

`App\Http\Controllers\Admin\AuthController` が担う。
Fortify は通さない。

ログインはユーザ名（`admin.name`）とパスワードで、`Auth::guard('admin')->attempt` に渡す。
成功したらセッションIDを再生成し、`redirect()->intended` で元の行き先か `/admin/dashboard` に送る。
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
4. 新しいパスワードを保存し、`remember_token` を作り直す
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

## アカウントの削除

個人情報の変更画面の削除ボタンからダイアログを開き、パスワードを入力して確定する。
削除は物理削除で、復元はできない。

`ProfileController::destroy` が次の順に処理する。

1. `password` を必須とし、現在のパスワードと照合する。違えばダイアログにエラーを出す
2. `web` ガードからログアウトする
3. トランザクションの中で、`push_subscriptions`、`password_reset_tokens`、`sessions`、`users` の順に該当行を消す
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
