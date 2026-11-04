<?php

use App\Enums\NotificationStatus;
use App\Models\NotificationLog;
use App\Models\User;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Carbon;

use function Pest\Laravel\artisan;
use function Pest\Laravel\assertModelExists;
use function Pest\Laravel\assertModelMissing;
use function Pest\Laravel\travelTo;

beforeEach(function () {
    travelTo(Carbon::parse('2026-11-05 00:00:00'));
});

it('作成から90日たった通知は既読かどうかに関係なく消える', function (NotificationStatus $status) {
    $log = NotificationLog::factory()->create(['status' => $status]);
    travelTo(Carbon::parse('2027-02-03 00:00:00'));
    artisan('model:prune', ['--model' => NotificationLog::class])->assertSuccessful();

    assertModelMissing($log);
})->with([
    '未読' => [NotificationStatus::Unread],
    '既読' => [NotificationStatus::Read],
]);

it('作成から90日たっていない通知は残る', function () {
    $log = NotificationLog::factory()->create();
    travelTo(Carbon::parse('2027-02-02 23:59:59'));
    artisan('model:prune', ['--model' => NotificationLog::class])->assertSuccessful();

    assertModelExists($log);
});

it('毎日3時の刈り込みにユーザーと通知の両方が入る', function () {
    $event = collect(app(Schedule::class)->events())
        ->first(fn ($event) => str_contains($event->command, 'model:prune'));

    expect($event->command)
        ->toContain('--model='.escapeshellarg(User::class))
        ->toContain('--model='.escapeshellarg(NotificationLog::class));
});
