# 個人情報の変更画面からアカウントを削除できるようにする

## 目的

利用者が自分のアカウントとデータを消す手段が、画面に無い。
個人情報の変更画面に削除ボタンを置き、利用者自身で削除できるようにする。

## 決めたこと

ボタンを押すとダイアログを出し、パスワードを入力して確定する。
確認ダイアログだけだと、ログインしたままの端末を触れる人なら誰でも消せてしまう。

削除は物理削除で、復元はできない。
ストックと通知履歴は、既存の外部キーの CASCADE で一緒に消える。

削除後はログイン画面に送り、完了をトーストで出す。
トップページには `Toaster` が無く、そこへ送るとトーストが出ない。

## フロントエンド（実装済み）

| ファイル | 内容 |
|---|---|
| `resources/js/pages/settings/profile.tsx` | フォームの下に削除ボタンを置く |
| `resources/js/features/auth/components/DeleteAccountDialog.tsx` | パスワードを入力するダイアログ。エラーは `password` キーから読む |
| `resources/js/features/auth/api.ts` | `deleteAccount` が `DELETE` で `{ password }` を送る |
| `resources/js/shared/lib/deviceSubscription.ts` | 端末側の Push 購読を解除する |

端末側の購読は、削除が成功した後に解除する。
残しておくと、同じ端末で別のアカウントを使ったときに、サーバに行が無いのに通知のトグルがONで表示される。

`profile.destroy` ルートの追加で Wayfinder の生成物に `destroy` が入るまで、`tsc` はエラーになる。

## バックエンド（方針）

ルートは認証グループに置く。
パスワードを照合するので、パスワード忘却と同じ毎分6回の制限を掛ける。

```php
Route::delete('/settings/profile', [ProfileController::class, 'destroy'])
    ->middleware('throttle:6,1')->name('profile.destroy');
```

`ProfileController::destroy` は次の順に処理する。

1. `password` を `required`、`string`、`current_password:web` で検証する
2. `$user` を変数に取り、`Auth::guard('web')->logout()` を呼ぶ
3. トランザクションの中で、`push_subscriptions`、`password_reset_tokens`、`sessions`、`users` の順に該当行を消す
4. セッションを `invalidate` し、CSRF トークンを `regenerateToken` で作り直す
5. `to_route('login')` で返す

ログアウトを削除より先に呼ぶのは、`logout()` が `remember_token` を保存するためである。
削除の後に呼ぶと、`save()` がユーザの行を作り直す恐れがある。

`push_subscriptions` はポリモーフィックで外部キーが無く、CASCADE では消えないので明示的に消す。
`password_reset_tokens` はメールアドレス、`sessions` は `user_id` で引く。

### テスト

`tests/Feature/ProfileControllerTest.php` を次のように変える。
テストの `SESSION_DRIVER` は `array` なので、`sessions` の削除は行を直接入れて確かめる。

先頭の `use` に足すもの。

```php
use App\Models\NotificationLog;
use App\Models\Stock;

use function Pest\Laravel\assertDatabaseMissing;
use function Pest\Laravel\assertGuest;
use function Pest\Laravel\delete;
```

`describe('未ログイン', ...)` の前に足すもの。

```php
describe('destroy', function () {
    it('正しいパスワードなら、ユーザーと紐づくレコードを消してログアウトする', function () {
        $user = User::findOrFail(Auth::guard('web')->id());
        $stock = Stock::factory()->for($user)->create();
        $log = NotificationLog::factory()->for($user)->create();
        $user->updatePushSubscription('https://push.example.com/1');
        DB::table('password_reset_tokens')->insert([
            'email' => $user->email,
            'token' => 'token',
            'created_at' => now(),
        ]);
        DB::table('sessions')->insert([
            'id' => 'other-device',
            'user_id' => $user->id,
            'payload' => '',
            'last_activity' => now()->timestamp,
        ]);

        delete(route('profile.destroy'), ['password' => 'password'])
            ->assertValid()
            ->assertRedirect(route('login'));

        assertGuest('web');
        assertDatabaseMissing('users', ['id' => $user->id]);
        assertDatabaseMissing('stocks', ['id' => $stock->id]);
        assertDatabaseMissing('notification_logs', ['id' => $log->id]);
        assertDatabaseMissing('push_subscriptions', ['subscribable_id' => $user->id]);
        assertDatabaseMissing('password_reset_tokens', ['email' => $user->email]);
        assertDatabaseMissing('sessions', ['user_id' => $user->id]);
    });

    it('パスワードが違えば弾き、何も消さない', function () {
        $user = User::findOrFail(Auth::guard('web')->id());
        $stock = Stock::factory()->for($user)->create();

        delete(route('profile.destroy'), ['password' => 'dummy'])
            ->assertInvalid(['password']);

        assertDatabaseHas('users', ['id' => $user->id]);
        assertDatabaseHas('stocks', ['id' => $stock->id]);
        expect(Auth::guard('web')->check())->toBeTrue();
    });

    it('パスワードが空なら弾き、何も消さない', function () {
        $user = User::findOrFail(Auth::guard('web')->id());

        delete(route('profile.destroy'), ['password' => ''])
            ->assertInvalid(['password']);

        assertDatabaseHas('users', ['id' => $user->id]);
    });
});
```

`describe('未ログイン', ...)` の `it` の末尾に足すもの。

```php
delete(route('profile.destroy'), ['password' => 'password'])
    ->assertRedirect(route('login'));
```

## 毎朝の通知コマンド（方針）

`app:send-purchase-reminders` の実行中にユーザが削除されると、残りのユーザにその朝の通知が届かなくなる。
コマンドは先にストックとユーザを読み込むため、ループの途中で `NotificationLog::create()` が `user_id` の外部キー違反で失敗する。
この呼び出しは `try` の外にあるので、例外がコマンド全体を止める。

### 実装

`app/Console/Commands/SendPurchaseReminders.php` の `foreach` を次の形にする。
文面を組み立てる部分は今のコードのままで、1段字下げするだけである。

```php
foreach ($stocks as $userId => $userStocks) {
    try {
        $overdue = $userStocks->contains(
            fn (Stock $stock) => $stock->next_purchase_date->toDateString() < $today->toDateString()
        );
        $user = $userStocks->firstOrFail()->user;
        $names = $userStocks->pluck('product.name');
        $count = $names->count();

        // $title、$lead、$description の組み立ては今のまま

        try {
            $user->notify(new PurchaseReminder($title, $description));
        } catch (Throwable $exception) {
            Log::error('購入予定日の通知を積めなかった', [
                'user_id' => $userId,
                'exception' => $exception,
            ]);
        }

        NotificationLog::create([
            'user_id' => $userId,
            'title' => $title,
            'description' => $description,
            'status' => NotificationStatus::Unread,
        ]);
    } catch (Throwable $exception) {
        Log::error('購入予定日の通知を処理できなかった', [
            'user_id' => $userId,
            'exception' => $exception,
        ]);
    }
}
```

今のコードから変えるのは次の3点である。

- `foreach` のキーで `$userId` を受ける。`groupBy('user_id')` の結果なので、キーがユーザIDになっている
- 1ユーザ分の処理全体を外側の `try` で囲む
- `$user->id` を `$userId` に置き換える。読み込みの間に削除されると `$user` は `null` になり、`catch` の中で `$user->id` を読むと新たに例外が起きる

内側の `try` を残すのは、Push の送信を積めなくても履歴は作る今の動作を変えないためである。

### テスト

`tests/Feature/SendPurchaseRemindersTest.php` を次のように変える。
失敗の再現には、`NotificationLog` の `creating` イベントで例外を投げる。
予定日の古い順に処理するので、失敗させるユーザの予定日を早くしておくと、そのユーザが先に処理される。

先頭の `use` に足すもの。

```php
use App\Models\NotificationLog;

use function Pest\Laravel\assertDatabaseMissing;
```

`describe('通知の失敗', ...)` の中に足すもの。

```php
it('途中のユーザーで失敗しても次のユーザーへ進む', function () {
    $failing = User::factory()->create();
    $next = User::factory()->create();
    stockDue($failing, '2026-09-20', 'ティッシュ');
    stockDue($next, '2026-09-23', '洗剤');

    NotificationLog::creating(function (NotificationLog $log) use ($failing) {
        if ($log->user_id === $failing->id) {
            throw new RuntimeException('失敗');
        }
    });

    artisan('app:send-purchase-reminders')->assertSuccessful();

    Notification::assertSentTo($next, PurchaseReminder::class);
    assertDatabaseHas('notification_logs', ['user_id' => $next->id]);
    assertDatabaseMissing('notification_logs', ['user_id' => $failing->id]);
});
```

## 削除完了メール（方針）

削除の完了を、登録していたメールアドレスへ1通送る。
トーストは数秒で消え、ほかの端末で使っている人には届かない。
メールなら後から見返せて、心当たりのない削除にも本人が気づける。

### 送り方

キューを通さず、リクエストの中で送る。
仮パスワードのメールも同じ送り方である。
キューに積むと、送信に失敗したときに `failed_jobs` へメールアドレスが残る。

`users` の行を消した後なので、`User` モデルには送らず、`Notification::route` でアドレスを直に指定する。
`$user` の属性は削除後も手元に残るので、アドレスを別の変数に取っておく必要はない。

送信はトランザクションのコミット後に行う。
先に送ると、削除が失敗しても「削除しました」のメールが届く。
送信に失敗しても削除は取り消さず、ログに残すだけにする。
ログにはメールアドレスを書かず、ユーザIDだけを書く。

### 実装

`app/Notifications/AccountDeleted.php` を新しく作る。

```php
<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class AccountDeleted extends Notification
{
    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('アカウントを削除しました')
            ->greeting('アカウントの削除が完了しました')
            ->line('ストックと通知履歴も削除しました。元に戻すことはできません。')
            ->line('お心当たりがない場合は、パスワードが他人に知られた可能性があります。同じパスワードを使っている他のサービスのパスワードを変更してください。')
            ->salutation('ストック管理システム');
    }
}
```

`app/Http/Controllers/ProfileController.php` の先頭の `use` に足すもの。

```php
use App\Notifications\AccountDeleted;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Throwable;
```

`destroy` の `regenerateToken()` と `return` の間に足すもの。

```php
try {
    Notification::route('mail', $user->email)->notify(new AccountDeleted);
} catch (Throwable $exception) {
    Log::error('アカウント削除の完了メールを送れなかった', [
        'user_id' => $user->id,
        'exception' => $exception,
    ]);
}
```

### テスト

`tests/Feature/ProfileControllerTest.php` の先頭の `use` に足すもの。

```php
use App\Notifications\AccountDeleted;
use Illuminate\Support\Facades\Notification;
```

`describe('destroy', ...)` の中に足すもの。

```php
it('削除が完了すると登録していたアドレスへメールを送る', function () {
    Notification::fake();
    $email = User::findOrFail(Auth::guard('web')->id())->email;

    delete(route('profile.destroy'), ['password' => 'password'])
        ->assertRedirect(route('login'));

    Notification::assertSentOnDemand(
        AccountDeleted::class,
        fn ($notification, $channels, $notifiable) => $notifiable->routes['mail'] === $email,
    );
});

it('メールを送れなくても削除は完了する', function () {
    $user = User::findOrFail(Auth::guard('web')->id());
    Notification::shouldReceive('route')->andThrow(new RuntimeException('失敗'));

    delete(route('profile.destroy'), ['password' => 'password'])
        ->assertRedirect(route('login'));

    assertDatabaseMissing('users', ['id' => $user->id]);
});

it('パスワードが違えばメールを送らない', function () {
    Notification::fake();

    delete(route('profile.destroy'), ['password' => 'dummy'])
        ->assertInvalid(['password']);

    Notification::assertNothingSent();
});
```

### 実装後に更新する文書

- `AGENTS.md` の要件（アカウントの削除）
- `doc/design/auth.md` の「アカウントの削除」

## 残るもの

リクエストログの `user_id` は消さない。
バックアップに残るデータの扱いは確認していない。
削除の直前にキューへ積まれた `PurchaseReminder` は、実行時に宛先が空になり、何も送らずに終わる。


## 実装後に更新する文書

- `AGENTS.md` の要件（設定）
- `doc/design/screens.md` のルート一覧
- `doc/design/auth.md`
- `doc/design/data-model.md` の削除の制約
- `doc/design/notification.md` の購読の解除と配信の失敗時の動作
