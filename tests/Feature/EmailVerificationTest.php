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
    it('アプリの画面を開くと確認待ちの画面へ遷移', function () {
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
