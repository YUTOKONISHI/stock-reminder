<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\get;
use function Pest\Laravel\put;

beforeEach(function () {
    actingAs(User::factory()->create());
});

describe('index', function () {
    it('設定画面を返す', function () {
        get(route('profile.edit'))
            ->assertInertia(
                fn (Assert $page) => $page
                    ->component('settings/profile')
            );
    });
});

describe('update', function () {
    it('名前と世帯人数を更新する', function () {
        $input = [
            'name' => '太郎',
            'household_size' => 1,
        ];
        put(route('profile.update'), $input)
            ->assertValid()
            ->assertRedirectBack();

        assertDatabaseHas('users', [
            'id' => Auth::guard('web')->id(),
            'name' => '太郎',
            'household_size' => 1,
        ]);
    });

    it('世帯人数は空にできる', function () {
        $input = [
            'name' => '太郎',
            'household_size' => null,
        ];

        put(route('profile.update'), $input)
            ->assertValid()
            ->assertRedirectBack();

        assertDatabaseHas('users', [
            'id' => Auth::guard('web')->id(),
            'name' => '太郎',
            'household_size' => null,
        ]);
    });

    it('名前が空なら弾く', function () {
        $user = User::findOrFail(Auth::guard('web')->id());
        $input = [
            'name' => '',
            'household_size' => 1,
        ];
        put(route('profile.update'), $input)
            ->assertInvalid()
            ->assertRedirectBack();

        assertDatabaseHas('users', [
            'id' => $user->id,
            'name' => $user->name,
            'household_size' => $user->household_size,
        ]);
    });

    it('パスワードが空欄なら変更しない', function () {
        $user = User::findOrFail(Auth::guard('web')->id());
        $input = [
            'name' => '太郎',
            'household_size' => 1,
            'password' => '',
        ];
        put(route('profile.update'), $input)
            ->assertValid()
            ->assertRedirectBack();

        assertDatabaseHas('users', [
            'id' => $user->id,
            'name' => '太郎',
            'household_size' => 1,
            'password' => $user->password,
        ]);
    });

    it('現在のパスワードが合えば変更する', function () {
        $user = User::findOrFail(Auth::guard('web')->id());
        $input = [
            'name' => '太郎',
            'household_size' => 1,
            'current_password' => 'password',
            'password' => 'test1234',
            'password_confirmation' => 'test1234',
        ];

        put(route('profile.update'), $input)
            ->assertValid()
            ->assertRedirectBack();

        assertDatabaseHas('users', [
            'id' => $user->id,
            'name' => '太郎',
            'household_size' => 1,
        ]);

        expect(Hash::check('test1234', User::findOrFail($user->id)->password))->toBeTrue();
    });

    it('現在のパスワードが違えば弾き、名前も変わらない', function () {
        $user = User::findOrFail(Auth::guard('web')->id());
        $input = [
            'name' => '太郎',
            'household_size' => 1,
            'current_password' => 'dummy',
            'password' => 'test1234',
            'password_confirmation' => 'test1234',
        ];
        put(route('profile.update'), $input)
            ->assertInvalid()
            ->assertRedirectBack();

        assertDatabaseHas('users', [
            'id' => $user->id,
            'name' => $user->name,
            'household_size' => $user->household_size,
        ]);

        expect(Hash::check('password', User::findOrFail($user->id)->password))->toBeTrue();
    });
});

describe('未ログイン', function () {
    it('操作するとログイン画面へ送られる', function () {
        Auth::guard('web')->logout();

        get(route('profile.edit'))
            ->assertRedirect(route('login'));

        $input = [
            'name' => '太郎',
            'household_size' => 1,
        ];
        put(route('profile.update'), $input)
            ->assertRedirect(route('login'));
    });
});
