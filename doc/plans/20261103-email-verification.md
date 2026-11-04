# 登録時にメールアドレスを確認する

## 目的

`20261101-improvement-backlog.md` の C6（メール確認が無い）に対応する。

今は、登録フォームに入れたアドレスが本人のものかを確かめていない。
そのため次のことが起きる。

- 他人のアドレスで登録できる。仮パスワードや削除完了のメールがその人に届く
- 先に登録されると、アドレスの持ち主はそのアドレスで登録できない（`users.email` は一意）
- 打ち間違えたまま使い始めると、パスワードを忘れたときに仮パスワードが届かない

登録したら確認用のリンクをメールで送り、リンクを開くまではアプリを使えないようにする。

この計画書は、実装者が Laravel の仕組みを学べるように、各手順に「なぜこう書くと動くのか」を添える。

## 決めたこと

- 確認が済むまでは、確認を待つ画面だけを出す。ストック管理もダッシュボードも開けない
- 仮パスワードでパスワードを再設定したら、確認済みにする。仮パスワードを受け取れた時点で、アドレスの持ち主だと分かるからである。他人に先に登録された持ち主も、パスワード忘却の画面からアカウントを取り戻せる
- 今いる利用者は、マイグレーションで確認済みにする。確認を求め直すと、今日まで使えていた人が急に使えなくなる
- 確認が済まないアカウントは消さない。持ち主は上の方法で取り戻せるので、消す仕組みを足すほどの理由が無い
- メールアドレスの変更は設定画面に足さない。打ち間違いは登録の時点で気づける
- リンクの有効期限は Laravel の既定の60分のままにする。期限切れのリンクを開いたら、確認を待つ画面に戻して再送を促す

## 仕組みの全体像

Laravel には、メールアドレスの確認に必要な部品がほとんどそろっている。
Fortify はそこに、確認用のルートとコントローラを足す。
この計画で書くコードの多くは、それらの部品をつなぐ設定である。

登録からアプリを使えるようになるまでは、次の順に進む。

1. 利用者が登録フォームを送る。Fortify の `RegisteredUserController` が `CreateNewUser` を呼んでユーザを作り、`Registered` イベントを発行して、ログインさせる
2. Laravel があらかじめ用意している `SendEmailVerificationNotification` リスナーが、`Registered` イベントを受け取る。ユーザが `MustVerifyEmail` を実装していて未確認なら、`VerifyEmail` 通知を送る
3. 通知のメールには、**署名付き URL** が入っている（後述）
4. 登録後の転送先はダッシュボードだが、`verified` ミドルウェアが未確認のユーザを確認待ちの画面へ送り返す
5. 利用者がメールのリンクを開くと、Fortify の `VerifyEmailController` が `email_verified_at` に今の時刻を入れる
6. 確認が済んだので、最初に開こうとしていた画面へ転送される

### イベントとリスナー

**イベント**は「何かが起きた」という知らせで、**リスナー**はそれを受けて動く処理である。
登録の処理（Fortify）は、確認メールを送る処理（Laravel 本体）を知らない。
`Registered` イベントを発行するだけで、受け取った側がメールを送る。
こうしておくと、登録の処理を書き換えずに「登録したら〇〇する」を足せる。

`SendEmailVerificationNotification` をどこかに登録するコードは、このアプリには無い。
Laravel 11 以降は、`EventServiceProvider::configureEmailVerification()` がフレームワークの起動時に自動で登録する。
読んでみると、`Registered` に対するリスナーが未登録なら足す、という数行である。

### `MustVerifyEmail` という目印

`Illuminate\Contracts\Auth\MustVerifyEmail` は**インターフェース**で、「このモデルはメール確認が要る」という目印として働く。
リスナーも `verified` ミドルウェアも、`$user instanceof MustVerifyEmail` で確認の要否を判断する。
目印が無いモデルは、確認済みとみなされて素通りする。

`User` が継承している `Illuminate\Foundation\Auth\User` は、同じ名前の**トレイト** `Illuminate\Auth\MustVerifyEmail` をすでに取り込んでいる。
`hasVerifiedEmail()`、`markEmailAsVerified()`、`sendEmailVerificationNotification()` の中身はこのトレイトにある。
そのため、`User` には `implements MustVerifyEmail` を書き足すだけでよい。
インターフェースとトレイトが同じ名前なので、`use` 文の名前空間（`Contracts` のほう）を取り違えないようにする。

### 署名付き URL

確認リンクは次の形をしている。

```text
/app/email/verify/{id}/{hash}?expires=1762160400&signature=3f9a...
```

`hash` はメールアドレスの SHA-1 で、`signature` は URL 全体を `APP_KEY` で署名した値である。
`APP_KEY` を知らない人は正しい `signature` を作れないので、URL の一部（`id` や `expires`）を書き換えると署名が合わなくなる。
ルートに付いた `signed` ミドルウェアが署名と期限を検査し、合わなければ `InvalidSignatureException`（403）を投げる。

これに加えて、Fortify の `VerifyEmailRequest::authorize()` が、ログイン中のユーザの ID とメールアドレスが URL の `id`、`hash` と一致するかを確かめる。
別のアカウントでログインしたままリンクを開くと、ここで 403 になる。

署名は `APP_URL` ではなく、リクエストを受けた URL で検査する。
本番は TLS をプロキシで終端するが、`bootstrap/app.php` の `trustProxies(at: '*')` があるので、Laravel は `https` の URL として検査できる。

## 実装の手順

### 1. `User` に目印を付ける

`app/Models/User.php` のコメントアウトされている `use` を戻し、`implements` を足す。

```php
use Illuminate\Contracts\Auth\MustVerifyEmail;

class User extends Authenticatable implements MustVerifyEmail
```

この時点で、登録すると確認メールが送られるようになる（上の手順2）。

### 2. Fortify の確認機能を有効にする

`config/fortify.php` の `features` に足す。

```php
'features' => [
    Features::registration(),
    Features::emailVerification(),
    // twoFactorAuthentication は C5 で扱うので触らない
],
```

これで Fortify が次の3つのルートを登録する。
`prefix` が `app` なので、URL はすべて `/app` で始まる。

| ルート名 | メソッドと URL | 役割 |
|---|---|---|
| `verification.notice` | `GET /app/email/verify` | 確認を待つ画面 |
| `verification.verify` | `GET /app/email/verify/{id}/{hash}` | メールのリンクの行き先 |
| `verification.send` | `POST /app/email/verification-notification` | 確認メールの再送 |

どれも `auth` ミドルウェアの内側にある。
ログインしていない状態でリンクを開くと、ログイン画面を経由してから確認が済む。
`verify` と `send` には毎分6回の制限が付く（`config/fortify.php` の `limiters` に `verification` が無いときの既定値）。

`./vendor/bin/sail artisan route:list --name=verification` で、登録されたルートを確かめられる。

### 3. 確認を待つ画面を Fortify に教える

Fortify は画面を持たず、どの画面を出すかをアプリに尋ねる。
ログイン画面を `Fortify::loginView()` で教えているのと同じように、`app/Providers/FortifyServiceProvider.php` の `boot()` に足す。

```php
Fortify::verifyEmailView(function (Request $request) {
    return Inertia::render('auth/verify-email', [
        'expired' => $request->boolean('expired'),
    ]);
});
```

これを書かずに確認待ちの画面を開くと、Fortify が `VerifyEmailViewResponse` を組み立てられずにエラーになる。
`expired` は手順6で使う。

### 4. アプリの画面に `verified` を掛ける

`routes/web.php` の利用者向けグループのミドルウェアに `verified` を足す。

```php
Route::middleware(['auth', 'verified'])->group(function () {
```

`verified` は Laravel が用意しているミドルウェアの別名で、中身は `EnsureEmailIsVerified` である。
未確認なら `verification.notice` へ転送する。
このとき `Redirect::guest()` を使うので、開こうとしていた URL がセッションに残る。
確認が済んだ後の `redirect()->intended()` が、その URL へ戻す。

設定画面とアカウントの削除もこのグループにある。
未確認のまま退会したい人はいないと考え、分けない。
ログアウトは Fortify のルートで、このグループの外にあるので、確認待ちの画面からも使える。

管理画面は `auth:admin` で守っていて、`Admin` モデルに目印が無いので影響しない。

### 5. 確認メールを日本語にする

`VerifyEmail` 通知の文面は英語で、ファイルとしてアプリに無い。
通知クラスには文面を差し替える口（`toMailUsing`）があるので、`app/Providers/AppServiceProvider.php` の `boot()` から渡す。

```php
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Notifications\Messages\MailMessage;

VerifyEmail::toMailUsing(function (object $notifiable, string $url) {
    $expiresInMinutes = (int) config('auth.verification.expire', 60);

    return (new MailMessage)
        ->subject('メールアドレスの確認')
        ->greeting('ご登録ありがとうございます')
        ->line('下のボタンを押して、メールアドレスの確認を完了してください。')
        ->action('メールアドレスを確認する', $url)
        ->line('このリンクは'.$expiresInMinutes.'分で使えなくなります。')
        ->line('お心当たりがない場合は、このメールを破棄してください。')
        ->salutation('ストック管理システム');
});
```

`$url` は Laravel が作った署名付き URL で、そのまま渡す。
書き方は `TemporaryPasswordIssued` に合わせた。

開発環境のメールは外へ出ず、Mailpit が受け取る。
`http://localhost:8025` で届いたメールとリンクを見られる。

### 6. 期限切れのリンクを確認待ちの画面へ戻す

期限切れのリンクを開くと、`signed` ミドルウェアが `InvalidSignatureException` を投げる。
今のままでは 403 のエラー画面（「このページを表示する権限がありません」）が出て、利用者は何をすればよいか分からない。

`bootstrap/app.php` の `withExceptions` に、この例外のときだけ確認待ちの画面へ戻す処理を足す。

```php
use Illuminate\Routing\Exceptions\InvalidSignatureException;

$exceptions->render(function (InvalidSignatureException $e, Request $request) {
    if ($request->routeIs('verification.verify')) {
        return to_route('verification.notice', ['expired' => 1]);
    }
});
```

`render()` に渡した関数は、引数の型で受け取る例外を選ぶ。
何も返さなければ、Laravel は通常の処理（既存の `respond()` による 403 の画面）に進む。

画面へ伝える手段として、セッションのフラッシュではなくクエリを使う。
このアプリはフラッシュを Inertia の props に載せていないからである（`HandleInertiaRequests::share()`）。

なお、確認済みのユーザが期限切れのリンクを開いた場合は、Fortify の `EmailVerificationPromptController` がダッシュボードへ転送するので、メッセージは出ない。

`id` や `hash` が別のアカウントのもの（「署名付き URL」の項を参照）のときは、`AuthorizationException` なので、403 のエラー画面が出る。
画面の文言（ログイン中のアカウントには権限がない）がそのまま当てはまるので、変えない。

### 7. 仮パスワードで再設定したら確認済みにする

`app/Http/Controllers/PasswordResetController.php` の `resetPassword` で、パスワードを保存する `forceFill` に1行足す。

```php
$user->forceFill([
    'password' => $request->password,
    'remember_token' => Str::random(60),
    'email_verified_at' => $user->email_verified_at ?? now(),
])->save();
```

すでに確認済みなら日時を上書きしない。

`email_verified_at` は `$fillable` に入っていないので、`fill()` や `update()` では書き込めない。
`forceFill()` は `$fillable` を無視して書き込む。
利用者の入力をそのまま渡す場面で使うと危ないが、ここでは値をサーバ側で決めているので問題ない。

このトランザクションは、同じユーザのセッションも消している。
他人に先に登録されたアドレスを持ち主が取り戻すと、先に登録した人はログアウトされる。

### 8. 今いる利用者を確認済みにする

データを書き換えるマイグレーションを作る。

```bash
./vendor/bin/sail artisan make:migration mark_existing_users_as_verified
```

```php
public function up(): void
{
    DB::table('users')
        ->whereNull('email_verified_at')
        ->update(['email_verified_at' => now()]);
}

public function down(): void
{
    //
}
```

`down()` は空にする。
どの行がもともと未確認だったかを残していないので、元に戻せない。

マイグレーションは本番のデプロイでも一度だけ流れる。
Seeder は初期データを入れる道具で、本番では流さないので、この用途には使わない。

モデル（`User::query()`）ではなく `DB::table()` を使うのは、マイグレーションを書いた後でモデルが変わっても、このファイルの動きが変わらないようにするためである。

### 9. 確認を待つ画面を作る

`resources/js/pages/auth/verify-email.tsx` を作る。
見た目は他の認証画面と同じ `AuthCard` を使う。

画面に置くもの。

- 見出し「メールアドレスを確認してください」
- 送り先のアドレス。`usePage().props.auth.user.email` から読む
- `expired` が真なら「リンクの有効期限が切れています。もう一度送信してください。」
- 「確認メールを再送する」ボタン。成功したらトーストで知らせる
- 「確認が済んだら、こちらを押してください」として、ダッシュボードへ進むボタン
- ログアウトのリンク（`@/shared/lib/auth` の `logout`）

ダッシュボードへ進むボタンを置くのは、メールのリンクが別のブラウザで開くことがあるからである。
iOS でホーム画面に追加したアプリは、Safari とログイン状態を共有しない。
メールアプリからリンクを開くと Safari で確認が済むが、ホーム画面のアプリは確認待ちの画面のままになる。
ボタンでダッシュボードを開き直せば、サーバが確認済みと判断して通す。
未確認なら `verified` ミドルウェアがこの画面に戻すだけなので、押されて困ることは無い。

再送は `resources/js/features/auth/api.ts` に関数を足して呼ぶ。
ルートの関数は、ルートを足した後に Wayfinder が `@/routes/verification` に生成する。

```ts
import verificationRoutes from '@/routes/verification';

export function resendVerificationEmail(callbacks: Callbacks) {
  router.post(verificationRoutes.send.url(), {}, callbacks);
}
```

再送が毎分6回を超えると 429 が返り、`registerRequestErrorToasts` の「エラーが発生しました。」が出る。
押し続ける人は少ないので、専用の文言は用意しない。

## テスト

`UserFactory` は既定で `email_verified_at` を埋めるので、既存のテストは `verified` を足しても通る。
未確認のユーザが要るテストでは `User::factory()->unverified()` を使う。

Pest のテストは `docker compose exec -T --user sail laravel.test php artisan test` で流す。

### `tests/Feature/RegistrationTest.php`

先頭の `use` に足すもの。

```php
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Support\Facades\Notification;
```

`describe('register.store', ...)` に足すもの。

```php
it('登録すると確認メールを送り、未確認のまま作る', function () {
    Notification::fake();

    post(route('register.store'), [
        'name' => 'test',
        'email' => 'test@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ])->assertValid();

    $user = User::where('email', 'test@example.com')->firstOrFail();
    expect($user->hasVerifiedEmail())->toBeFalse();
    Notification::assertSentTo($user, VerifyEmail::class);
});
```

`Notification::fake()` は、通知を実際には送らずに記録だけする。
後から `assertSentTo` で「誰に何を送ったか」を確かめられる。

### `tests/Feature/EmailVerificationTest.php`（新規）

```php
<?php

use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Inertia\Testing\AssertableInertia as Assert;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\get;
use function Pest\Laravel\post;

function verificationUrl(User $user, int $minutes = 60): string
{
    return URL::temporarySignedRoute('verification.verify', now()->addMinutes($minutes), [
        'id' => $user->getKey(),
        'hash' => sha1($user->getEmailForVerification()),
    ]);
}

describe('未確認のユーザー', function () {
    it('アプリの画面を開くと確認待ちの画面へ送られる', function () {
        actingAs(User::factory()->unverified()->create());

        get(route('dashboard'))->assertRedirect(route('verification.notice'));
        get(route('stocks.index'))->assertRedirect(route('verification.notice'));
    });

    it('確認待ちの画面を開ける', function () {
        actingAs(User::factory()->unverified()->create());

        get(route('verification.notice'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('auth/verify-email')
                ->where('expired', false));
    });

    it('リンクを開くと確認済みになり、ダッシュボードへ進む', function () {
        $user = User::factory()->unverified()->create();
        actingAs($user);

        get(verificationUrl($user))->assertRedirect(route('dashboard').'?verified=1');

        expect($user->fresh()->hasVerifiedEmail())->toBeTrue();
    });

    it('期限切れのリンクは確認待ちの画面へ戻す', function () {
        $user = User::factory()->unverified()->create();
        actingAs($user);

        get(verificationUrl($user, -1))
            ->assertRedirect(route('verification.notice', ['expired' => 1]));

        expect($user->fresh()->hasVerifiedEmail())->toBeFalse();
    });

    it('別のユーザーのリンクは弾く', function () {
        $other = User::factory()->unverified()->create();
        $user = User::factory()->unverified()->create();
        actingAs($user);

        get(verificationUrl($other))->assertForbidden();

        expect($user->fresh()->hasVerifiedEmail())->toBeFalse();
        expect($other->fresh()->hasVerifiedEmail())->toBeFalse();
    });

    it('再送すると確認メールをもう一度送る', function () {
        Notification::fake();
        $user = User::factory()->unverified()->create();
        actingAs($user);

        post(route('verification.send'))->assertRedirect();

        Notification::assertSentTo($user, VerifyEmail::class);
    });
});

describe('確認済みのユーザー', function () {
    it('確認待ちの画面を開くとダッシュボードへ送られる', function () {
        actingAs(User::factory()->create());

        get(route('verification.notice'))->assertRedirect(route('dashboard'));
    });
});
```

`verificationUrl` は、Laravel が `VerifyEmail` の中で作る URL と同じものをテストの中で作る。
期限に負の分数を渡すと、作った時点で期限切れの URL になる。

### `tests/Feature/PasswordResetControllerTest.php`

`resetPassword` の `describe` に足すもの。
既存のテストで仮パスワードを用意している手順をそのまま使い、ユーザだけ `unverified()` で作る。

```php
it('未確認のユーザーが再設定すると確認済みになる', function () {
    // 既存のテストと同じ手順で、unverified() のユーザーに仮パスワードを発行して再設定する

    expect($user->fresh()->hasVerifiedEmail())->toBeTrue();
});

it('確認済みのユーザーの確認日時は変えない', function () {
    // 既存のテストと同じ手順で、email_verified_at を過去の日時にしたユーザーを再設定する

    expect($user->fresh()->email_verified_at->toDateTimeString())->toBe('2026-01-01 00:00:00');
});
```

### フロントエンド

`resources/js/pages/auth/verify-email.test.tsx` を作り、次を確かめる。

- 送り先のアドレスが出る
- `expired` が真のときだけ期限切れの文言が出る
- 再送ボタンで `resendVerificationEmail` が呼ばれ、成功したらトーストが出る

既存の `error.test.tsx` と同じく、`@inertiajs/react` の `usePage` をモックする。

## 実装後に更新する文書

- `AGENTS.md` の要件（新規登録）
- `doc/design/auth.md` の「アカウント作成」「パスワード忘却と再設定」と、画面の割り当ての表
- `doc/design/screens.md` のルート一覧
- `doc/plans/20261101-improvement-backlog.md` に、C6 に着手したことを追記する

## 残るもの

確認が済まないアカウントは、アドレスを持ったまま残る。
持ち主は仮パスワードで取り戻せるが、そうしない限り、そのアドレスでは新しく登録できない。

マイグレーションを流す前に他人のアドレスで作られていたアカウントも、確認済みになる。
これも持ち主が仮パスワードで取り戻せる。

確認メールの末尾にある「ボタンを押せない場合は〜」の一文は英語のままになる。
Laravel のメールの共通部品が出す文で、仮パスワードのメールも同じ状態である。

## 追記（2026-11-04）：未確認のアカウントを消すことにした

「確認が済まないアカウントは消さない」を改め、登録から7日で消す（Issue #61）。
持ち主が仮パスワードで取り戻せるとしても、その手順に気づいてもらう必要があるためである。
計画は `20261104-prune-unverified-users.md` にある。
