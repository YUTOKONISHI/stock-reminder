<?php

use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Support\Carbon;

use function Pest\Laravel\artisan;
use function Pest\Laravel\assertDatabaseMissing;
use function Pest\Laravel\assertModelExists;
use function Pest\Laravel\assertModelMissing;
use function Pest\Laravel\travelTo;

beforeEach(function () {
    travelTo(Carbon::parse('2026-11-04 00:00:00'));
});

it('7日超過したメール未確認ユーザは削除される', function () {
    $user = User::factory()->unverified()->create();
    travelTo(Carbon::parse('2026-11-11 00:00:00'));
    artisan('model:prune', ['--model' => User::class])->assertSuccessful();

    assertModelMissing($user);
});

it('7日超過しないメール未確認ユーザは削除されない', function () {
    $user = User::factory()->unverified()->create();
    travelTo(Carbon::parse('2026-11-10 23:59:59'));
    artisan('model:prune', ['--model' => User::class])->assertSuccessful();

    assertModelExists($user);
});

it('メール確認済みユーザは削除されない', function () {
    $user = User::factory()->create(['email_verified_at' => Carbon::parse('2026-11-10 00:00:00')]);
    travelTo(Carbon::parse('2026-11-11 00:00:00'));
    artisan('model:prune', ['--model' => User::class])->assertSuccessful();

    assertModelExists($user);
});

it('ユーザ削除時、sessionsとpassword_reset_tokensのレコードは削除される', function () {
    $user = User::factory()->unverified()->create();
    DB::table('password_reset_tokens')->insert([
        'email' => $user->email,
        'token' => 'token',
        'created_at' => now(),
    ]);

    DB::table('sessions')->insert([
        'id' => 'session',
        'user_id' => $user->id,
        'payload' => '',
        'last_activity' => now()->timestamp,
    ]);

    travelTo(Carbon::parse('2026-11-11 00:00:00'));
    artisan('model:prune', ['--model' => User::class])->assertSuccessful();

    assertDatabaseMissing('password_reset_tokens', ['email' => $user->email]);
    assertDatabaseMissing('sessions', ['user_id' => $user->id]);
});

it('確認メールに登録の取り消しを書く', function () {
    $user = User::factory()->unverified()->create();

    $mail = (new VerifyEmail)->toMail($user);

    expect($mail->outroLines)->toContain('登録から7日以内に確認が済まない場合、登録は取り消されます。');
});
