<?php

use App\Models\Product;
use App\Models\Stock;
use App\Models\User;
use App\Notifications\PurchaseReminder;
use Carbon\Carbon;
use Illuminate\Support\Facades\Notification;

use function Pest\Laravel\artisan;
use function Pest\Laravel\assertDatabaseCount;
use function Pest\Laravel\assertDatabaseHas;
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

        artisan('app:send-purchase-reminders')->assertSuccessful();

        assertDatabaseHas('notification_logs', [
            'user_id' => $user->id,
            'title' => '「ティッシュ」の購入予定日です',
        ]);
    });
});
