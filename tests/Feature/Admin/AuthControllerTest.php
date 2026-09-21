<?php

use App\Models\Admin;
use App\Models\User;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\assertAuthenticatedAs;
use function Pest\Laravel\assertGuest;
use function Pest\Laravel\from;
use function Pest\Laravel\get;
use function Pest\Laravel\post;

describe('login', function () {
    it('管理者の資格情報でログインしてマスタ画面へ進む', function () {
        $admin = Admin::factory()->create();

        post(route('admin.login.store'), [
            'name' => $admin->name,
            'password' => 'password',
        ])
            ->assertValid()
            ->assertRedirect(route('admin.dashboard'));

        assertAuthenticatedAs($admin, 'admin');
    });

    it('一般ユーザーの資格情報では入れない', function () {
        $user = User::factory()->create(['name' => 'hoge']);

        post(route('admin.login.store'), [
            'name' => $user->name,
            'password' => 'password',
        ])
            ->assertInvalid(['auth_error' => '名前またはパスワードが正しくありません']);

        assertGuest('admin');
    });

    it('パスワードが違えば弾く', function () {
        $admin = Admin::factory()->create();

        post(route('admin.login.store'), [
            'name' => $admin->name,
            'password' => 'hogehoge',
        ])
            ->assertInvalid(['auth_error' => '名前またはパスワードが正しくありません']);

        assertGuest('admin');
    });

    it('ログイン済みでもweb側の認証には影響しない', function () {
        $admin = Admin::factory()->create();

        post(route('admin.login.store'), [
            'name' => $admin->name,
            'password' => 'password',
        ]);

        assertGuest('web');

        get(route('dashboard'))->assertRedirect(route('login'));
    });
});

describe('logout', function () {
    it('ログアウトするとログイン画面へ戻る', function () {
        actingAs(Admin::factory()->create(), 'admin');

        post(route('admin.logout'))->assertRedirect(route('admin.login'));

        assertGuest('admin');
    });
});

describe('updateAdminPassword', function () {
    it('現在のパスワードが合えば変更する', function () {
        $admin = Admin::factory()->create();
        actingAs($admin, 'admin');

        from(route('admin.dashboard'))
            ->post(route('admin.admin-password'), [
                'current_password' => 'password',
                'password' => 'password2',
                'password_confirmation' => 'password2',
            ])
            ->assertSessionHas('success');

        expect(Hash::check('password2', $admin->refresh()->password))->toBeTrue();
    });

    it('現在のパスワードが違えば弾く', function () {
        $admin = Admin::factory()->create();
        actingAs($admin, 'admin');

        from(route('admin.dashboard'))
            ->post(route('admin.admin-password'), [
                'current_password' => 'passwordx',
                'password' => 'password2',
                'password_confirmation' => 'password2',
            ])
            ->assertInvalid(['current_password' => '現在のパスワードが違います。']);

        expect(Hash::check('password', $admin->refresh()->password))->toBeTrue();
    });
});

describe('未ログイン', function () {
    it('管理画面を開くとログイン画面へ送られる', function () {
        get(route('admin.dashboard'))
            ->assertRedirect(route('admin.login'));

        assertGuest('admin');
    });
});
