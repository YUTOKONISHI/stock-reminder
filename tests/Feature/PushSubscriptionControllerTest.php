<?php

use App\Models\User;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\assertDatabaseCount;
use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\assertDatabaseMissing;
use function Pest\Laravel\delete;
use function Pest\Laravel\post;

beforeEach(function () {
    actingAs(User::factory()->create());
});

/**
 * 購読の送信内容を組み立てる。ブラウザの PushSubscription.toJSON() と同じ入れ子にする。
 *
 * @return array<string, mixed>
 */
function subscriptionPayload(string $endpoint = 'https://fcm.googleapis.com/fcm/send/abc123'): array
{
    return [
        'endpoint' => $endpoint,
        'keys' => [
            'p256dh' => 'BpublicKeyForTest',
            'auth' => 'AuthTokenForTest',
        ],
    ];
}

describe('store', function () {
    it('購読を登録する', function () {

        post(route('push-subscriptions.store'), subscriptionPayload())
            ->assertValid()
            ->assertRedirectBack();

        assertDatabaseHas('push_subscriptions', [
            'subscribable_id' => Auth::id(),
            'subscribable_type' => User::class,
            'endpoint' => 'https://fcm.googleapis.com/fcm/send/abc123',
            'public_key' => 'BpublicKeyForTest',
            'auth_token' => 'AuthTokenForTest',
        ]);
    });

    it('同じendpointを送り直しても増えない', function () {
        post(route('push-subscriptions.store'), subscriptionPayload())
            ->assertValid()
            ->assertRedirectBack();

        assertDatabaseCount('push_subscriptions', 1);
    });

    it('入力が欠けていれば弾く', function () {
        post(route('push-subscriptions.store'), [])
            ->assertInvalid(['endpoint', 'keys.p256dh', 'keys.auth'])
            ->assertRedirectBack();
    });

    it('許可していない宛先は弾く', function (string $endpoint) {
        post(route('push-subscriptions.store'), [
            ...subscriptionPayload(),
            'endpoint' => $endpoint,
        ])
            ->assertInvalid(['endpoint']);

        assertDatabaseCount('push_subscriptions', 0);
    })->with([
        'http' => ['http://fcm.googleapis.com/a'],
        '許可外のホスト' => ['https://evil.example/a'],
        '末尾に別ドメイン' => ['https://fcm.googleapis.com.evil.com/a'],
        'ユーザー情報' => ['https://fcm.googleapis.com@evil.com/a'],
        '区切りのない一致' => ['https://evilpush.apple.com/a'],
        '別ポート' => ['https://fcm.googleapis.com:8443/a'],
        '内部IP' => ['https://169.254.169.254/'],
        'エンコードしたホスト' => ['https://127.0.0.1%2f.push.apple.com/'],
    ]);

    it('許可している Push サービスの宛先を登録できる', function (string $endpoint) {
        post(route('push-subscriptions.store'), subscriptionPayload($endpoint))
            ->assertValid();

        assertDatabaseHas('push_subscriptions', ['endpoint' => $endpoint]);
    })->with([
        'Apple' => ['https://web.push.apple.com/a'],
        'Mozilla' => ['https://updates.push.services.mozilla.com/wpush/v2/a'],
        'Windows' => ['https://wns2-par02p.notify.windows.com/w/?token=a'],
    ]);
});

describe('destroy', function () {
    it('購読を削除する', function () {
        post(route('push-subscriptions.store'), subscriptionPayload())
            ->assertValid()
            ->assertRedirectBack();

        delete(route('push-subscriptions.destroy'), [
            'endpoint' => 'https://fcm.googleapis.com/fcm/send/abc123',
        ])
            ->assertValid()
            ->assertRedirectBack();

        assertDatabaseMissing('push_subscriptions', [
            'subscribable_id' => Auth::id(),
            'subscribable_type' => User::class,
            'endpoint' => 'https://fcm.googleapis.com/fcm/send/abc123',
            'public_key' => 'BpublicKeyForTest',
            'auth_token' => 'AuthTokenForTest',
        ]);
    });

    it('他人の購読は消えない', function () {
        $other = User::factory()->create();
        $other->updatePushSubscription('https://fcm.googleapis.com/fcm/send/abc123', 'key', 'token');

        delete(route('push-subscriptions.destroy'), ['endpoint' => 'https://fcm.googleapis.com/fcm/send/abc123'])
            ->assertValid()
            ->assertRedirectBack();

        assertDatabaseHas('push_subscriptions', [
            'subscribable_id' => $other->id,
            'endpoint' => 'https://fcm.googleapis.com/fcm/send/abc123',
        ]);
    });

    it('endpointが無ければ弾く', function () {
        delete(route('push-subscriptions.destroy'), [
            'endpoint' => '',
        ])
            ->assertInvalid()
            ->assertRedirectBack();
    });
});

describe('未ログイン', function () {
    it('操作するとログイン画面へ送られる', function () {
        Auth::guard('web')->logout();

        post(route('push-subscriptions.store'), subscriptionPayload())
            ->assertRedirect(route('login'));

        delete(route('push-subscriptions.destroy'), [
            'endpoint' => 'https://fcm.googleapis.com/fcm/send/abc123',
        ])
            ->assertRedirect(route('login'));

        assertDatabaseCount('push_subscriptions', 0);
    });
});
