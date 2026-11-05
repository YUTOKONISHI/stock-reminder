<?php

use App\Models\NotificationLog;
use App\Models\Product;
use App\Models\Stock;
use App\Models\User;
use App\Notifications\PurchaseReminder;
use App\Notifications\PurchaseRemindersFailed;
use Carbon\Carbon;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Notification;

use function Pest\Laravel\artisan;
use function Pest\Laravel\assertDatabaseCount;
use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\assertDatabaseMissing;
use function Pest\Laravel\travelTo;

beforeEach(function () {
    travelTo(Carbon::parse('2026-09-23 09:00:00'));
    Notification::fake();
});

/** 指定した予定日のストックを1件作る。商品名は文面の確認に使う。 */
function stockDue(User $user, string $date, string $productName): Stock
{
    return Stock::factory()
        ->for($user)
        ->for(Product::factory()->create(['name' => $productName]))
        ->create(['next_purchase_date' => $date]);
}

/** 2人を対象にし、1人目の履歴の作成だけを失敗させる。 */
function failOneOfTwo(): void
{
    $failing = User::factory()->create();
    stockDue($failing, '2026-09-23', 'ティッシュ');
    stockDue(User::factory()->create(), '2026-09-23', '洗剤');

    NotificationLog::creating(function (NotificationLog $log) use ($failing) {
        if ($log->user_id === $failing->id) {
            throw new RuntimeException('失敗');
        }
    });
}

describe('対象の絞り込み', function () {
    it('予定日が先のストックは通知しない', function () {
        $user = User::factory()->create();
        stockDue($user, '2026-09-24', 'ティッシュ');

        artisan('app:send-purchase-reminders')->assertSuccessful();

        Notification::assertNothingSent();
        assertDatabaseCount('notification_logs', 0);
    });

    it('予定日が今日のストックを通知する', function () {
        $user = User::factory()->create();
        stockDue($user, '2026-09-23', 'ティッシュ');

        artisan('app:send-purchase-reminders')->assertSuccessful();

        Notification::assertSentTo($user, PurchaseReminder::class);
        assertDatabaseCount('notification_logs', 1);
    });

    it('予定日を過ぎたストックも通知する', function () {
        $user = User::factory()->create();
        stockDue($user, '2026-09-20', 'ティッシュ');

        artisan('app:send-purchase-reminders')->assertSuccessful();

        Notification::assertSentTo($user, PurchaseReminder::class);
        assertDatabaseCount('notification_logs', 1);
    });

    it('今日の通知履歴がある利用者には送らない', function () {
        $user = User::factory()->create();
        stockDue($user, '2026-09-23', 'ティッシュ');
        NotificationLog::factory()->for($user)->create(['created_at' => '2026-09-23 00:00:00']);

        artisan('app:send-purchase-reminders')->assertSuccessful();

        Notification::assertNothingSent();
        assertDatabaseCount('notification_logs', 1);
    });

    it('昨日の通知履歴しか無い利用者には送る', function () {
        $user = User::factory()->create();
        stockDue($user, '2026-09-23', 'ティッシュ');
        NotificationLog::factory()->for($user)->create(['created_at' => '2026-09-22 23:59:59']);

        artisan('app:send-purchase-reminders')->assertSuccessful();

        Notification::assertSentTo($user, PurchaseReminder::class);
        assertDatabaseCount('notification_logs', 2);
    });
});

describe('文面', function () {
    it('今日が予定日なら購入予定日の知らせになる', function () {
        $user = User::factory()->create();
        stockDue($user, '2026-09-23', 'ティッシュ');

        artisan('app:send-purchase-reminders')->assertSuccessful();

        assertDatabaseHas('notification_logs', [
            'user_id' => $user->id,
            'title' => '「ティッシュ」の購入予定日です',
            'description' => '今日が購入予定日です。買い忘れにご注意ください。',
        ]);
    });

    it('過ぎたものが混じれば買い忘れの知らせになる', function () {
        $user = User::factory()->create();
        stockDue($user, '2026-09-20', 'ティッシュ');

        artisan('app:send-purchase-reminders')->assertSuccessful();

        assertDatabaseHas('notification_logs', [
            'user_id' => $user->id,
            'title' => '「ティッシュ」を買い忘れていませんか',
            'description' => '購入予定日を過ぎています。買い忘れにご注意ください。',
        ]);
    });

    it('複数件なら「ほかN件」を付ける', function () {
        $user = User::factory()->create();
        stockDue($user, '2026-09-23', 'ティッシュ');
        stockDue($user, '2026-09-23', '醤油');

        artisan('app:send-purchase-reminders')->assertSuccessful();

        assertDatabaseHas('notification_logs', [
            'user_id' => $user->id,
            'title' => '「ティッシュ」ほか1件の購入予定日です',
            'description' => '今日が購入予定日です。ティッシュ、醤油',
        ]);
    });

    it('4件以上なら本文は3件までで「ほかN件」に畳む', function () {
        $user = User::factory()->create();
        stockDue($user, '2026-09-23', 'ティッシュ');
        stockDue($user, '2026-09-23', '醤油');
        stockDue($user, '2026-09-23', '米');
        stockDue($user, '2026-09-23', '洗剤');

        artisan('app:send-purchase-reminders')->assertSuccessful();

        assertDatabaseHas('notification_logs', [
            'user_id' => $user->id,
            'title' => '「ティッシュ」ほか3件の購入予定日です',
            'description' => '今日が購入予定日です。ティッシュ、醤油、米、ほか1件',
        ]);
    });

    it('過ぎたものが複数あれば本文の言い回しが変わる', function () {
        $user = User::factory()->create();
        stockDue($user, '2026-09-20', 'ティッシュ');
        stockDue($user, '2026-09-23', '醤油');

        artisan('app:send-purchase-reminders')->assertSuccessful();

        assertDatabaseHas('notification_logs', [
            'user_id' => $user->id,
            'title' => '「ティッシュ」ほか1件を買い忘れていませんか',
            'description' => '購入予定日を過ぎたものがあります。ティッシュ、醤油',
        ]);
    });
});

describe('ユーザーごとのまとまり', function () {
    it('ユーザーごとに1通ずつ送る', function () {
        $taro = User::factory()->create();
        $hanako = User::factory()->create();
        stockDue($taro, '2026-09-23', 'ティッシュ');
        stockDue($taro, '2026-09-23', '醤油');
        stockDue($hanako, '2026-09-23', '米');

        artisan('app:send-purchase-reminders')->assertSuccessful();

        Notification::assertSentToTimes($taro, PurchaseReminder::class, 1);
        Notification::assertSentToTimes($hanako, PurchaseReminder::class, 1);

        assertDatabaseCount('notification_logs', 2);
        assertDatabaseHas('notification_logs', [
            'user_id' => $hanako->id,
            'title' => '「米」の購入予定日です',
        ]);
    });
});

describe('通知の失敗', function () {
    it('通知が例外を投げても履歴は残す', function () {
        $user = User::factory()->create();
        stockDue($user, '2026-09-23', 'ティッシュ');

        Notification::shouldReceive('send')->andThrow(new RuntimeException('送信できない'));

        artisan('app:send-purchase-reminders')->assertFailed();

        assertDatabaseHas('notification_logs', [
            'user_id' => $user->id,
            'title' => '「ティッシュ」の購入予定日です',
        ]);
    });

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

        artisan('app:send-purchase-reminders')->assertFailed();

        Notification::assertSentTo($next, PurchaseReminder::class);
        assertDatabaseHas('notification_logs', ['user_id' => $next->id]);
        assertDatabaseMissing('notification_logs', ['user_id' => $failing->id]);
    });

    it('失敗した利用者には次の回で送り直す', function () {
        $user = User::factory()->create();
        stockDue($user, '2026-09-23', 'ティッシュ');

        $fail = true;
        NotificationLog::creating(function () use (&$fail) {
            if ($fail) {
                throw new RuntimeException('失敗');
            }
        });

        artisan('app:send-purchase-reminders')->assertFailed();

        $fail = false;
        travelTo(Carbon::parse('2026-09-23 10:00:00'));
        artisan('app:send-purchase-reminders')->assertSuccessful();

        assertDatabaseHas('notification_logs', ['user_id' => $user->id]);
    });
});

describe('管理者への知らせ', function () {
    it('失敗した回は、管理者のアドレスへ失敗した人数を知らせる', function () {
        config(['services.admin.alert_email' => 'admin@example.com']);
        failOneOfTwo();

        artisan('app:send-purchase-reminders')->assertFailed();

        Notification::assertSentOnDemand(
            PurchaseRemindersFailed::class,
            function (PurchaseRemindersFailed $notification, array $channels, AnonymousNotifiable $notifiable) {
                $lines = $notification->toMail($notifiable)->introLines;

                return $notifiable->routes['mail'] === 'admin@example.com'
                    && in_array('対象2人のうち、1人の処理に失敗しました。', $lines, true);
            },
        );
    });

    it('全員に送れた回は、管理者に知らせない', function () {
        config(['services.admin.alert_email' => 'admin@example.com']);
        stockDue(User::factory()->create(), '2026-09-23', 'ティッシュ');

        artisan('app:send-purchase-reminders')->assertSuccessful();

        Notification::assertSentTimes(PurchaseRemindersFailed::class, 0);
    });

    it('管理者のアドレスが空なら、失敗しても知らせない', function () {
        config(['services.admin.alert_email' => null]);
        failOneOfTwo();

        artisan('app:send-purchase-reminders')->assertFailed();

        Notification::assertSentTimes(PurchaseRemindersFailed::class, 0);
    });
});
