<?php

use App\Models\NotificationLog;
use App\Models\Stock;
use App\Models\User;
use App\Notifications\AccountDeleted;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\assertDatabaseMissing;
use function Pest\Laravel\assertGuest;
use function Pest\Laravel\delete;
use function Pest\Laravel\get;
use function Pest\Laravel\put;
use function Pest\Laravel\withCookie;

function passwordChangeInput(): array
{
    return [
        'name' => '太郎',
        'household_size' => 1,
        'current_password' => 'password',
        'password' => 'test1234',
        'password_confirmation' => 'test1234',
    ];
}

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

    it('世帯人数は20人を超えることはできない', function () {
        $input = [
            'name' => '太郎',
            'household_size' => 21,
        ];
        put(route('profile.update'), $input)
            ->assertInvalid(['household_size' => '世帯人数は20以下の値にしてください。'])
            ->assertRedirectBack();
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

    it('パスワードを変えると remember_token を作り直す', function () {
        $user = User::findOrFail(Auth::guard('web')->id());
        $before = $user->remember_token;

        put(route('profile.update'), passwordChangeInput())
            ->assertValid();

        expect($user->fresh()->remember_token)->not->toBe($before);
    });

    it('保持用のcookieがあれば、新しいトークンで発行し直す', function () {
        $user = User::findOrFail(Auth::guard('web')->id());

        $cookie = withCookie(recallerName(), 'old')
            ->put(route('profile.update'), passwordChangeInput())
            ->assertValid()
            ->getCookie(recallerName());

        expect($cookie)->not->toBeNull()
            ->and(explode('|', $cookie->getValue())[1])->toBe($user->fresh()->remember_token);
    });

    it('名前だけを変えたときは remember_token を変えない', function () {
        $user = User::findOrFail(Auth::guard('web')->id());
        $before = $user->remember_token;

        put(route('profile.update'), ['name' => '太郎', 'household_size' => 1])->assertValid();

        expect($user->fresh()->remember_token)->toBe($before);
    });

    it('保持用の cookie が無ければ、発行しない', function () {
        put(route('profile.update'), passwordChangeInput())
            ->assertValid()
            ->assertCookieMissing(recallerName());
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

    it('パスワードを変更すると他の端末のセッションを消し、今のセッションはIDを変えて残す', function () {
        config(['session.driver' => 'database']);
        app('session')->forgetDrivers();
        app()->forgetInstance('session.store');
        Auth::forgetGuards();

        $user = User::factory()->create();
        $other = User::factory()->create();
        $ownId = str_repeat('a', 40);

        foreach ([$ownId => $user->id, str_repeat('b', 40) => $user->id, str_repeat('c', 40) => $other->id] as $id => $userId) {
            DB::table('sessions')->insert([
                'id' => $id,
                'user_id' => $userId,
                'payload' => '',
                'last_activity' => now()->timestamp,
            ]);
        }

        actingAs($user)
            ->withCookie(config('session.cookie'), $ownId)
            ->put(route('profile.update'), [
                'name' => '太郎',
                'household_size' => 1,
                'current_password' => 'password',
                'password' => 'test1234',
                'password_confirmation' => 'test1234',
            ])
            ->assertValid();

        $ownSessions = DB::table('sessions')->where('user_id', $user->id)->pluck('id');

        expect($ownSessions)->toHaveCount(1)
            ->and($ownSessions)->not->toContain($ownId)
            ->and(DB::table('sessions')->where('user_id', $other->id)->count())->toBe(1);
    });
});

describe('destroy', function () {
    it('正しいパスワードなら、ユーザーと紐づくレコードを消してログアウトする', function () {
        $user = User::findOrFail(Auth::guard('web')->id());
        $stock = Stock::factory()->for($user)->create();
        $log = NotificationLog::factory()->for($user)->create();
        $user->updatePushSubscription('https://push.example.com/1');
        DB::table('password_reset_tokens')->insert([
            'email' => $user->email,
            'token' => 'token',
            'created_at' => now(),
        ]);
        DB::table('sessions')->insert([
            'id' => 'other-device',
            'user_id' => $user->id,
            'payload' => '',
            'last_activity' => now()->timestamp,
        ]);

        delete(route('profile.destroy'), ['password' => 'password'])
            ->assertValid()
            ->assertRedirect(route('login'));

        assertGuest('web');
        assertDatabaseMissing('users', ['id' => $user->id]);
        assertDatabaseMissing('stocks', ['id' => $stock->id]);
        assertDatabaseMissing('notification_logs', ['id' => $log->id]);
        assertDatabaseMissing('push_subscriptions', ['subscribable_id' => $user->id]);
        assertDatabaseMissing('password_reset_tokens', ['email' => $user->email]);
        assertDatabaseMissing('sessions', ['user_id' => $user->id]);
    });

    it('パスワードが違えば弾き、何も消さない', function () {
        $user = User::findOrFail(Auth::guard('web')->id());
        $stock = Stock::factory()->for($user)->create();

        delete(route('profile.destroy'), ['password' => 'dummy'])
            ->assertInvalid(['password']);

        assertDatabaseHas('users', ['id' => $user->id]);
        assertDatabaseHas('stocks', ['id' => $stock->id]);
        expect(Auth::guard('web')->check())->toBeTrue();
    });

    it('パスワードが空なら弾き、何も消さない', function () {
        $user = User::findOrFail(Auth::guard('web')->id());

        delete(route('profile.destroy'), ['password' => ''])
            ->assertInvalid(['password']);

        assertDatabaseHas('users', ['id' => $user->id]);
    });

    it('削除が完了すると登録していたアドレスへメールを送る', function () {
        Notification::fake();
        $email = User::findOrFail(Auth::guard('web')->id())->email;

        delete(route('profile.destroy'), ['password' => 'password'])
            ->assertRedirect(route('login'));

        Notification::assertSentOnDemand(
            AccountDeleted::class,
            fn ($notification, $channels, $notifiable) => $notifiable->routes['mail'] === $email,
        );
    });

    it('メールを送れなくても削除は完了する', function () {
        $user = User::findOrFail(Auth::guard('web')->id());
        Notification::shouldReceive('route')->andThrow(new RuntimeException('失敗'));

        delete(route('profile.destroy'), ['password' => 'password'])
            ->assertRedirect(route('login'));

        assertDatabaseMissing('users', ['id' => $user->id]);
    });

    it('パスワードが違えばメールを送らない', function () {
        Notification::fake();

        delete(route('profile.destroy'), ['password' => 'dummy'])
            ->assertInvalid(['password']);

        Notification::assertNothingSent();
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

        delete(route('profile.destroy'), ['password' => 'password'])
            ->assertRedirect(route('login'));
    });
});
