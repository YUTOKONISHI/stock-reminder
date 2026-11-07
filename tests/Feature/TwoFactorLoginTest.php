<?php

use App\Models\User;
use PragmaRX\Google2FA\Google2FA;

use function Pest\Laravel\assertAuthenticatedAs;
use function Pest\Laravel\assertGuest;
use function Pest\Laravel\post;

function twoFactorUser(string $email = 'test@example.com'): User
{
    return User::factory()->twoFactorEnabled()->create(['email' => $email]);
}

describe('two-factor.login', function () {
    it('有効な利用者がパスワードでログインすると、ログインされずにコード入力画面へ送られる', function () {
        twoFactorUser();
        post(route('login.store'), [
            'email' => 'test@example.com',
            'password' => 'password',
        ])
            ->assertValid()
            ->assertRedirect(route('two-factor.login'));

        assertGuest();
    });

    it('正しいコードを送るとログインでき、ダッシュボードへ進む', function () {
        $user = twoFactorUser();
        post(route('login.store'), [
            'email' => 'test@example.com',
            'password' => 'password',
        ]);

        post(route('two-factor.login'), [
            'code' => app(Google2FA::class)->getCurrentOtp(decrypt($user->two_factor_secret)),
        ])
            ->assertValid()
            ->assertRedirect(route('dashboard'));

        assertAuthenticatedAs($user);
    });

    it('違うコードを送ると、code にエラーが入り、ログインされない', function () {
        twoFactorUser();
        post(route('login.store'), [
            'email' => 'test@example.com',
            'password' => 'password',
        ]);
        post(route('two-factor.login'), [
            'code' => 'hogehoge',
        ])
            ->assertInvalid(['code' => '認証コードが正しくありません']);

        assertGuest();
    });

    it('リカバリーコードでログインでき、使ったコードは入れ替わる', function () {
        $user = twoFactorUser();
        post(route('login.store'), [
            'email' => 'test@example.com',
            'password' => 'password',
        ]);

        $old_code = 'aaaaaaaaaa-aaaaaaaaaa';

        post(route('two-factor.login'), [
            'recovery_code' => $old_code,
        ])
            ->assertValid()
            ->assertRedirect(route('dashboard'));

        expect($user->fresh()->recoveryCodes())->not->toContain($old_code);
    });

    it('2段階認証が無効な利用者は、パスワードだけでログインできる', function () {
        User::factory()->create(['email' => 'test@example.com']);

        post(route('login.store'), [
            'email' => 'test@example.com',
            'password' => 'password',
        ])
            ->assertValid()
            ->assertRedirect(route('dashboard'));
    });

    it('設定中（確認前）の利用者は、パスワードだけでログインできる', function () {
        User::factory()->twoFactorEnabled()->create([
            'email' => 'test@example.com',
            'two_factor_confirmed_at' => null,
        ]);

        post(route('login.store'), [
            'email' => 'test@example.com',
            'password' => 'password',
        ])
            ->assertValid()
            ->assertRedirect(route('dashboard'));
    });

    it('パスワードが違うときは、今と同じく auth_error にエラーが入る', function () {
        twoFactorUser();
        post(route('login.store'), [
            'email' => 'test@example.com',
            'password' => 'password2',
        ])
            ->assertInvalid(['auth_error' => '名前またはパスワードが正しくありません']);

        assertGuest();
    });

    it('使ったリカバリーコードは2度目に使えない', function () {
        twoFactorUser();
        post(route('login.store'), [
            'email' => 'test@example.com',
            'password' => 'password',
        ])
          ->assertValid()
          ->assertRedirect(route('dashboard'));

        $old_code = 'aaaaaaaaaa-aaaaaaaaaa';

        post(route('two-factor.login'), [
            'recovery_code' => $old_code,
        ]);

        post(route('logout'), []);

        post(route('login.store'), [
            'email' => 'test@example.com',
            'password' => 'password',
        ]);

        post(route('two-factor.login'), [
            'recovery_code' => $old_code,
        ])
            ->assertInvalid(['recovery_code' => 'リカバリーコードが正しくありません']);
    });

    it('ログイン画面で保持を選んでいれば、コードを通った後に保持用の cookie が発行される', function () {
        $user = twoFactorUser();
        post(route('login.store'), [
            'email' => 'test@example.com',
            'password' => 'password',
            'remember' => true,
        ]);

        $cookie = post(route('two-factor.login'), [
            'code' => app(Google2FA::class)->getCurrentOtp(decrypt($user->two_factor_secret)),
        ])
            ->assertValid()
            ->getCookie(recallerName(), false);

        expect($cookie)->not->toBeNull();
    });
});
