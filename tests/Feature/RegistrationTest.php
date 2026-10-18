<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

use function Pest\Laravel\assertAuthenticated;
use function Pest\Laravel\assertDatabaseCount;
use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\assertDatabaseMissing;
use function Pest\Laravel\get;
use function Pest\Laravel\post;

describe('register', function () {
    it('登録画面を返す', function () {
        get(route('register'))
            ->assertInertia(fn (Assert $page) => $page->component('auth/register'));
    });
});

describe('register.store', function () {
    it('登録するとユーザーが増え、そのままログインする', function () {
        post(route('register.store'), [
            'name' => 'test',
            'email' => 'test@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])
            ->assertValid()
            ->assertRedirect(route('dashboard'));

        assertDatabaseHas('users', [
            'name' => 'test',
            'email' => 'test@example.com',
        ]);

        assertAuthenticated();
    });

    it('パスワードはハッシュ化して保存する', function () {
        post(route('register.store'), [
            'name' => 'test',
            'email' => 'test@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])
            ->assertValid();

        expect(Hash::check('password', User::findOrFail(Auth::id())->password))->toBeTrue();
    });

    it('入力が欠けていれば弾く', function () {
        post(route('register.store'), [])
            ->assertInvalid(['name', 'email', 'password']);
    });

    it('メールの形式が不正なら弾く', function () {
        post(route('register.store'), [
            'name' => 'test',
            'email' => 'example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])
            ->assertInvalid(['email']);

        assertDatabaseMissing('users', [
            'name' => 'test',
            'email' => 'example.com',
        ]);
    });

    it('登録済みのメールは弾く', function () {
        User::factory()->create(['email' => 'test@example.com']);
        post(route('register.store'), [
            'name' => 'test',
            'email' => 'test@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])
            ->assertInvalid(['email']);

        assertDatabaseCount('users', 1);
    });

    it('パスワードが確認と一致しなければ弾く', function () {
        post(route('register.store'), [
            'name' => 'test',
            'email' => 'test@example.com',
            'password' => 'password',
            'password_confirmation' => 'password2',
        ])
            ->assertInvalid(['password']);

        post(route('register.store'), [
            'name' => 'test',
            'email' => 'test@example.com',
            'password' => 'password2',
            'password_confirmation' => 'password',
        ])
            ->assertInvalid(['password']);

        assertDatabaseMissing('users', [
            'name' => 'test',
            'email' => 'test@example.com',
        ]);
    });

    it('パスワードが短ければ弾く', function () {
        post(route('register.store'), [
            'name' => 'test',
            'email' => 'test@example.com',
            'password' => 'pass',
            'password_confirmation' => 'pass',
        ])
            ->assertInvalid(['password']);

        assertDatabaseMissing('users', [
            'name' => 'test',
            'email' => 'test@example.com',
        ]);
    });
});
