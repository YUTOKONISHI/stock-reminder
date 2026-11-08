<?php

use App\Models\User;
use App\Notifications\TwoFactorDisabled;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use PragmaRX\Google2FA\Google2FA;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\post;

describe('2段階認証の設定画面', function () {
    it('パスワードを確認していないと、設定画面を開くとパスワード確認画面へ送られる', function () {
        $user = User::factory()->create(['email' => 'test@example.com']);
        actingAs($user)
            ->get(route('two-factor.settings'))
            ->assertRedirect(route('password.confirm'));
    });

    it('3つの状態で、渡す値が切り替わる（設定中だけ QR コード、有効のときだけリカバリーコード）', function (array $attributes, string $status, bool $hasQrCode, ?array $recoveryCodes) {
        $user = User::factory()->twoFactorEnabled()->create($attributes);

        actingAs($user)->withSession(['auth.password_confirmed_at' => time()])
            ->get(route('two-factor.settings'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('settings/two-factor')
                ->where('status', $status)
                ->whereType('qrCodeSvg', $hasQrCode ? 'string' : 'null')
                ->whereType('secretKey', $hasQrCode ? 'string' : 'null')
                ->where('recoveryCodes', $recoveryCodes));
    })->with([
        '無効' => [['two_factor_secret' => null, 'two_factor_recovery_codes' => null, 'two_factor_confirmed_at' => null], 'disabled', false, null],
        '設定中' => [['two_factor_confirmed_at' => null], 'pending', true, null],
        '有効' => [[], 'enabled', false, ['aaaaaaaaaa-aaaaaaaaaa', 'bbbbbbbbbb-bbbbbbbbbb']],
    ]);

    it('有効にしてからコードを確かめると、two_factor_confirmed_at が入る', function () {
        $user = User::factory()->create(['email' => 'test@example.com']);
        actingAs($user)->withSession(['auth.password_confirmed_at' => time()])
            ->post(route('two-factor.enable'));

        $secret = decrypt($user->fresh()->two_factor_secret);

        post(route('two-factor.confirm'), [
            'code' => app(Google2FA::class)->getCurrentOtp($secret),
        ]);

        expect($user->fresh()->two_factor_confirmed_at)->not->toBeNull();
    });

    it('有効な状態から無効にすると、TwoFactorDisabled が送られる', function () {
        Notification::fake();
        $user = User::factory()->twoFactorEnabled()->create();

        actingAs($user)->withSession(['auth.password_confirmed_at' => time()])
            ->delete(route('two-factor.disable'));

        Notification::assertSentTo($user, TwoFactorDisabled::class);
    });

    it('設定中に「やめる」を押しても、TwoFactorDisabled は送られない', function () {
        Notification::fake();
        $user = User::factory()->twoFactorEnabled()->create(['two_factor_confirmed_at' => null]);

        actingAs($user)->withSession(['auth.password_confirmed_at' => time()])
            ->delete(route('two-factor.disable'));

        expect($user->fresh()->two_factor_secret)->toBeNull();
        Notification::assertNothingSent();
    });

    it('auth.user に two_factor_secret と two_factor_recovery_codes が載らない', function () {
        $user = User::factory()->twoFactorEnabled()->create();

        actingAs($user)
            ->get(route('dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                ->has('auth.user')
                ->missing('auth.user.two_factor_secret')
                ->missing('auth.user.two_factor_recovery_codes'));
    });
});
