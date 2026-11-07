<?php

use App\Models\User;
use App\Rules\Turnstile;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

use function Pest\Laravel\assertAuthenticated;
use function Pest\Laravel\assertDatabaseCount;
use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\assertDatabaseMissing;
use function Pest\Laravel\assertGuest;
use function Pest\Laravel\get;
use function Pest\Laravel\post;

/**
 * Http::fake は先に登録した応答を優先するので、beforeEach で登録した closure が返す値を差し替える。
 *
 * @param  array<string, mixed>|Closure  $response  配列は 200 の JSON として返し、Closure はリクエストのたびに呼ぶ
 */
function fakeSiteverify(array|Closure $response): void
{
    test()->siteverify = $response;
}

/**
 * @return array<string, string>
 */
function registrationInput(): array
{
    return [
        'name' => 'test',
        'email' => 'test@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
        'cf-turnstile-response' => 'token',
    ];
}

beforeEach(function () {
    config(['services.turnstile.secret_key' => 'secret']);
    Http::preventStrayRequests();
    fakeSiteverify(['success' => true, 'action' => 'register', 'hostname' => 'localhost']);
    Http::fake([Turnstile::SITEVERIFY_URL => fn () => $this->siteverify instanceof Closure
        ? ($this->siteverify)()
        : Http::response($this->siteverify)]);
});

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
            'cf-turnstile-response' => 'token',
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
            'cf-turnstile-response' => 'token',
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
            'cf-turnstile-response' => 'token',
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
            'cf-turnstile-response' => 'token',
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
            'cf-turnstile-response' => 'token',
        ])
            ->assertInvalid(['password']);

        post(route('register.store'), [
            'name' => 'test',
            'email' => 'test@example.com',
            'password' => 'password2',
            'password_confirmation' => 'password',
            'cf-turnstile-response' => 'token',
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
            'cf-turnstile-response' => 'token',
        ])
            ->assertInvalid(['password']);

        assertDatabaseMissing('users', [
            'name' => 'test',
            'email' => 'test@example.com',
        ]);
    });

    it('登録すると確認メールを送り、未確認のまま作る', function () {
        Notification::fake();

        post(route('register.store'), [
            'name' => 'test',
            'email' => 'test@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
            'cf-turnstile-response' => 'token',
        ])->assertValid();

        $user = User::where('email', 'test@example.com')->firstOrFail();
        expect($user->hasVerifiedEmail())->toBeFalse();
        Notification::assertSentTo($user, VerifyEmail::class);
    });
});

describe('register.store の Turnstile', function () {
    it('サイトキーを登録画面に渡す', function () {
        config(['services.turnstile.site_key' => 'site-key']);

        get(route('register'))
            ->assertInertia(fn (Assert $page) => $page->where('turnstileSiteKey', 'site-key'));
    });

    it('シークレットキーとトークンと送り手の IP を siteverify に送る', function () {
        post(route('register.store'), registrationInput())->assertValid();

        Http::assertSent(fn (Request $request) => $request->url() === Turnstile::SITEVERIFY_URL
            && $request['secret'] === 'secret'
            && $request['response'] === 'token'
            && $request['remoteip'] === '127.0.0.1');
    });

    it('トークンが無ければ登録しない', function () {
        $input = registrationInput();
        unset($input['cf-turnstile-response']);

        post(route('register.store'), $input)->assertInvalid(['cf-turnstile-response']);

        assertDatabaseCount('users', 0);
        Http::assertNothingSent();
    });

    it('不合格なら登録せず、確認メールも送らない', function () {
        Notification::fake();
        fakeSiteverify(['success' => false, 'error-codes' => ['invalid-input-response']]);

        post(route('register.store'), registrationInput())
            ->assertInvalid(['cf-turnstile-response' => '確認に失敗しました。もう一度お試しください。']);

        assertDatabaseCount('users', 0);
        assertGuest();
        Notification::assertNothingSent();
    });

    it('action が register でなければ登録しない', function () {
        fakeSiteverify(['success' => true, 'action' => 'login', 'hostname' => 'localhost']);

        post(route('register.store'), registrationInput())->assertInvalid(['cf-turnstile-response']);

        assertDatabaseCount('users', 0);
    });

    it('hostname が APP_URL と違えば登録しない', function () {
        fakeSiteverify(['success' => true, 'action' => 'register', 'hostname' => 'example.com']);

        post(route('register.store'), registrationInput())->assertInvalid(['cf-turnstile-response']);

        assertDatabaseCount('users', 0);
    });

    it('テスト用のシークレットキーなら action と hostname を見ない', function () {
        config(['services.turnstile.secret_key' => Turnstile::TESTING_SECRET]);
        fakeSiteverify(['success' => true, 'hostname' => 'example.com']);

        post(route('register.store'), registrationInput())->assertValid();

        assertDatabaseCount('users', 1);
    });

    it('siteverify が 5xx を返したら登録しない', function () {
        fakeSiteverify(fn () => Http::response(null, 503));

        post(route('register.store'), registrationInput())->assertInvalid(['cf-turnstile-response']);

        assertDatabaseCount('users', 0);
    });

    it('siteverify に届かなければ登録しない', function () {
        fakeSiteverify(fn () => throw new ConnectionException('timeout'));

        post(route('register.store'), registrationInput())->assertInvalid(['cf-turnstile-response']);

        assertDatabaseCount('users', 0);
    });

    it('シークレットキーが無ければ問い合わせずに登録しない', function () {
        config(['services.turnstile.secret_key' => null]);

        post(route('register.store'), registrationInput())->assertInvalid(['cf-turnstile-response']);

        assertDatabaseCount('users', 0);
        Http::assertNothingSent();
    });

    it('入力に誤りがあれば siteverify に問い合わせない', function () {
        post(route('register.store'), [...registrationInput(), 'password_confirmation' => 'different'])
            ->assertInvalid(['password']);

        Http::assertNothingSent();
    });
});
