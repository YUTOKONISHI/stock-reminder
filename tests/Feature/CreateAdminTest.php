<?php

use App\Models\Admin;
use Illuminate\Support\Facades\Hash;

use function Pest\Laravel\artisan;
use function Pest\Laravel\assertDatabaseCount;

it('名前を省くと admin で作り、パスワードはハッシュにして保存する', function () {
    artisan('app:create-admin')
        ->expectsQuestion('パスワード', 'secret-pass')
        ->expectsQuestion('パスワード（確認）', 'secret-pass')
        ->assertSuccessful();

    $admin = Admin::where('name', 'admin')->firstOrFail();
    expect(Hash::check('secret-pass', $admin->password))->toBeTrue();
});

it('名前を指定して作る', function () {
    artisan('app:create-admin', ['name' => 'owner'])
        ->expectsQuestion('パスワード', 'secret-pass')
        ->expectsQuestion('パスワード（確認）', 'secret-pass')
        ->assertSuccessful();

    expect(Admin::where('name', 'owner')->exists())->toBeTrue();
});

it('確認のパスワードが違えば作らない', function () {
    artisan('app:create-admin')
        ->expectsQuestion('パスワード', 'secret-pass')
        ->expectsQuestion('パスワード（確認）', 'other-pass')
        ->assertFailed();

    assertDatabaseCount('admin', 0);
});

it('同じ名前の管理者がいれば作らない', function () {
    Admin::factory()->create(['name' => 'admin']);

    artisan('app:create-admin')
        ->expectsQuestion('パスワード', 'secret-pass')
        ->expectsQuestion('パスワード（確認）', 'secret-pass')
        ->assertFailed();

    assertDatabaseCount('admin', 1);
});
