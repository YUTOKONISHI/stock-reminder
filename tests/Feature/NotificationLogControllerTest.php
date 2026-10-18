<?php

use App\Enums\NotificationStatus;
use App\Models\NotificationLog;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

use function Pest\Laravel\actingAs;

describe('index', function () {
    it('未読のみ返す', function () {
        $user = User::factory()->create();
        $notificationLog = collect([
            '通知1' => ['status' => NotificationStatus::Unread],
            '通知2' => ['status' => NotificationStatus::Read],
        ])->map(fn (array $attributes) => NotificationLog::factory()->for($user)->create($attributes));

        NotificationLog::factory()->create(['status' => NotificationStatus::Unread]);

        actingAs($user)
            ->get(route('notifications.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('notifications')
                ->has('notifications.data', 1)
                ->where('notifications.data.0.id', $notificationLog['通知1']->id));
    });
});

describe('markAsRead', function () {
    it('既読にする', function () {
        $user = User::factory()->create();
        $notificationLog = NotificationLog::factory()->for($user)->create([
            'status' => NotificationStatus::Unread,
        ]);

        actingAs($user)
            ->from(route('notifications.index'))
            ->patch(route('notifications.read', $notificationLog))
            ->assertRedirect(route('notifications.index'));

        expect($notificationLog->refresh()->status)->toBe(NotificationStatus::Read);
    });
});

describe('markAsUnread', function () {
    it('未読にする', function () {
        $user = User::factory()->create();
        $notificationLog = NotificationLog::factory()->for($user)->create([
            'status' => NotificationStatus::Read,
        ]);

        actingAs($user)
            ->from(route('notifications.index'))
            ->patch(route('notifications.unread', $notificationLog))
            ->assertRedirect(route('notifications.index'));

        expect($notificationLog->refresh()->status)->toBe(NotificationStatus::Unread);
    });
});

describe('他人の通知', function () {
    it('操作すると403', function (string $route) {
        $user = User::factory()->create();
        $notificationLog = NotificationLog::factory()->create();

        actingAs($user)
            ->patch(route($route, $notificationLog))
            ->assertForbidden();
    })->with([
        '既読にする' => ['notifications.read'],
        '未読に戻す' => ['notifications.unread'],
    ]);
});
