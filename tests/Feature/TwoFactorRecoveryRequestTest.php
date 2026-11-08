<?php

use App\Models\User;
use App\Notifications\TwoFactorRecoveryRequested;
use App\Notifications\TwoFactorRecoveryRequestReceived;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Notification;

use function Pest\Laravel\post;

describe('解除の依頼', function () {
    it('パスワードを通った後に正しいメールアドレスで送ると、管理者と本人へそれぞれ通知が送られる', function () {
        $user = User::factory()->twoFactorEnabled()->create(['email' => 'test@example.com']);
        config(['services.admin.alert_email' => 'admin@example.com']);
        Notification::fake();
        post(route('login.store'), [
            'email' => 'test@example.com',
            'password' => 'password',
        ])
            ->assertValid()
            ->assertRedirect(route('two-factor.login'));

        post(route('two-factor-challenge.recovery'), [
            'email' => 'test@example.com',
        ])
            ->assertValid();

        Notification::assertSentOnDemand(
            TwoFactorRecoveryRequested::class,
            fn ($notification, array $channels, AnonymousNotifiable $notifiable) => $notifiable->routes['mail'] === 'admin@example.com',
        );
        Notification::assertSentTo($user, TwoFactorRecoveryRequestReceived::class);
    });

    it('メールアドレスが一致しないと、エラーが入り、通知は送られない', function () {
        User::factory()->twoFactorEnabled()->create(['email' => 'test@example.com']);
        Notification::fake();
        post(route('login.store'), [
            'email' => 'test@example.com',
            'password' => 'password',
        ])
            ->assertValid()
            ->assertRedirect(route('two-factor.login'));
        post(route('two-factor-challenge.recovery'), [
            'email' => 'test2@example.com',
        ])
            ->assertInvalid(['email' => 'ログインに使ったメールアドレスを入力してください']);

        Notification::assertNothingSent();
    });

    it('セッションに login.id が無いと、ログイン画面へ戻され、通知は送られない', function () {
        User::factory()->twoFactorEnabled()->create(['email' => 'test@example.com']);
        Notification::fake();

        post(route('two-factor-challenge.recovery'), ['email' => 'test@example.com'])
            ->assertRedirect(route('login'));

        Notification::assertNothingSent();
    });

    it('1時間以内に2回目を送ると、回数制限で弾かれる', function () {
        User::factory()->twoFactorEnabled()->create(['email' => 'test@example.com']);
        config(['services.admin.alert_email' => 'admin@example.com']);
        Notification::fake();
        post(route('login.store'), [
            'email' => 'test@example.com',
            'password' => 'password',
        ])
            ->assertValid()
            ->assertRedirect(route('two-factor.login'));

        post(route('two-factor-challenge.recovery'), [
            'email' => 'test@example.com',
        ])
            ->assertValid();

        post(route('two-factor-challenge.recovery'), ['email' => 'test@example.com'])
            ->assertInvalid(['email' => '依頼は受け付け済みです。1時間ほどおいてからお試しください']);

        Notification::assertSentOnDemandTimes(TwoFactorRecoveryRequested::class, 1);
    });
});
