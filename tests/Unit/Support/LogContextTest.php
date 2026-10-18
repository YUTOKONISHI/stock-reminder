<?php

use App\Models\Admin;
use App\Models\User;
use App\Support\LogContext;

use function Pest\Laravel\actingAs;

it('未認証の場合はnullを返す', function () {
    expect(LogContext::actor())->toBe([
        'user_id' => null,
        'guard' => null,
    ]);
});

it('webでログインしていれば利用者のIDを返す', function () {
    actingAs((new User)->forceFill(['id' => 10]), 'web');
    expect(LogContext::actor())->toBe([
        'user_id' => 10,
        'guard' => 'web',
    ]);
});

it('adminでログインしていれば管理者のIDを返す', function () {
    actingAs((new Admin)->forceFill(['id' => 1]), 'admin');
    expect(LogContext::actor())->toBe([
        'user_id' => 1,
        'guard' => 'admin',
    ]);
});

it('両方でログインしていれば web を先に見る', function () {
    actingAs((new User)->forceFill(['id' => 10]), 'web');
    actingAs((new Admin)->forceFill(['id' => 1]), 'admin');
    expect(LogContext::actor())->toBe([
        'user_id' => 10,
        'guard' => 'web',
    ]);
});
