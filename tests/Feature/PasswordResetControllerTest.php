<?php

use App\Models\User;
use App\Notifications\TemporaryPasswordIssued;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;

use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\assertDatabaseMissing;
use function Pest\Laravel\from;
use function Pest\Laravel\post;
use function Pest\Laravel\travelTo;

beforeEach(function () {
    travelTo(Carbon::parse('2026-09-21 09:00:00'));
    Notification::fake();
});

/** 仮パスワードを発行済みの状態を作り、照合に使う平文を返す。 */
function issueTemporaryPassword(User $user, string $plain = 'ABCD2345'): string
{
    DB::table('password_reset_tokens')->insert([
        'email' => $user->email,
        'token' => Hash::make($plain),
        'created_at' => now(),
    ]);

    return $plain;
}

describe('sendTemporaryPassword', function () {
    it('登録済みのメールには仮パスワードを送り、トークンを保存する', function () {
        $user = User::factory()->create();

        from(route('forgot-password'))
            ->post(route('forgot-password.store'), ['email' => $user->email])
            ->assertRedirect(route('forgot-password'));

        assertDatabaseHas('password_reset_tokens', ['email' => $user->email]);
        Notification::assertSentTo($user, TemporaryPasswordIssued::class);
    });

    it('未登録のメールでも同じ応答を返し、トークンは作らない', function () {
        from(route('forgot-password'))
            ->post(route('forgot-password.store'), ['email' => 'nobody@example.com'])
            ->assertRedirect(route('forgot-password'))
            ->assertSessionHas('success');

        assertDatabaseMissing('password_reset_tokens', ['email' => 'nobody@example.com']);
        Notification::assertNothingSent();
    });

    it('メールの形式が不正なら弾く', function () {
        post(route('forgot-password.store'), ['email' => 'not-an-email'])
            ->assertInvalid(['email']);
    });
});

describe('resetPassword', function () {
    it('仮パスワードが合えば再設定し、トークンを消す', function () {
        $user = User::factory()->create();
        $temporary = issueTemporaryPassword($user);

        post(route('reset-password'), [
            'email' => $user->email,
            'temporary_password' => $temporary,
            'password' => 'NewPassword123!',
            'password_confirmation' => 'NewPassword123!',
        ])
            ->assertRedirect(route('login'))
            ->assertSessionHas('success');

        expect(Hash::check('NewPassword123!', $user->refresh()->password))->toBeTrue();
        assertDatabaseMissing('password_reset_tokens', ['email' => $user->email]);
    });

    it('仮パスワードが違えば弾く', function () {
        $user = User::factory()->create();
        issueTemporaryPassword($user);

        from(route('reset-password'))
            ->post(route('reset-password'), [
                'email' => $user->email,
                'temporary_password' => 'dummy',
                'password' => 'NewPassword123!',
                'password_confirmation' => 'NewPassword123!',
            ])
            ->assertInvalid(['temporary_password']);

        assertDatabaseHas('password_reset_tokens', ['email' => $user->email]);
    });

    it('期限が切れていれば弾き、トークンを消す', function () {
        $user = User::factory()->create();
        $temporary = issueTemporaryPassword($user);

        travelTo(Carbon::parse('2026-09-21 10:01:00'));

        post(route('reset-password'), [
            'email' => $user->email,
            'temporary_password' => $temporary,
            'password' => 'NewPassword123!',
            'password_confirmation' => 'NewPassword123!',
        ])
            ->assertInvalid(['temporary_password']);

        assertDatabaseMissing('password_reset_tokens', ['email' => $user->email]);
    });

    it('発行していないメールでは弾く', function () {
        from(route('reset-password'))
            ->post(route('reset-password.store'), [
                'email' => 'nobody@example.com',
                'temporary_password' => 'ABCD2345',
                'password' => 'NewPassword123!',
                'password_confirmation' => 'NewPassword123!',
            ])
            ->assertInvalid(['temporary_password']);
    });
});
