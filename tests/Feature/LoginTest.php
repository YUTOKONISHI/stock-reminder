<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

use function Pest\Laravel\assertGuest;
use function Pest\Laravel\get;
use function Pest\Laravel\post;

function registeredUser(string $email = 'test@example.com'): User
{
    return User::factory()->create(['email' => $email]);
}

describe('login', function () {
    it('ログイン画面を返す', function () {
        get(route('login'))
            ->assertInertia(fn (Assert $page) => $page->component('auth/login'));
    });
});

describe('login.store', function () {
    it('メールとパスワードが合えばダッシュボードへ進む', function () {
        registeredUser();
        post(route('login.store'), [
            'email' => 'test@example.com',
            'password' => 'password',
        ])
            ->assertValid()
            ->assertRedirect(url('app/dashboard'));
    });

    it('大文字のメールでも入れる', function () {
        registeredUser();
        post(route('login.store'), [
            'email' => 'TEST@example.com',
            'password' => 'password',
        ])
            ->assertValid()
            ->assertRedirect(url('app/dashboard'));
    });

    it('パスワードが違えば auth_error に日本語のメッセージが入る', function () {
        registeredUser();
        post(route('login.store'), [
            'email' => 'test@example.com',
            'password' => 'password2',
        ])
            ->assertInvalid(['auth_error' => '名前またはパスワードが正しくありません']);
    });

    it('登録の無いメールでも同じメッセージを返す', function () {
        post(route('login.store'), [
            'email' => 'test@example.com',
            'password' => 'password',
        ])
            ->assertInvalid(['auth_error' => '名前またはパスワードが正しくありません']);
    });

    it('ログインしてもadmin側の認証には影響しない', function () {
        registeredUser();

        post(route('login.store'), [
            'email' => 'test@example.com',
            'password' => 'password',
        ]);

        assertGuest('admin');

        get(route('admin.dashboard'))->assertRedirect(route('admin.login'));
    });

    it('6回続けて失敗すると弾かれる', function () {
        registeredUser();

        foreach (range(1, 5) as $ignored) {
            post(route('login.store'), [
                'email' => 'test@example.com',
                'password' => 'wrong',
            ])->assertInvalid(['auth_error']);
        }

        post(route('login.store'), [
            'email' => 'test@example.com',
            'password' => 'password',
        ])->assertTooManyRequests();

        assertGuest();
    });
});

describe('logout', function () {
    it('ログアウトするとログイン画面へ戻る', function () {
        registeredUser();
        post(route('login.store'), [
            'email' => 'test@example.com',
            'password' => 'password',
        ]);

        post(route('logout'), [])
            ->assertRedirect(route('login'));

        assertGuest();
    });
});
