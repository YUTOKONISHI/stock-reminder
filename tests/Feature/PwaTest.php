<?php

use App\Models\User;
use Illuminate\Support\Facades\Vite;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\get;

describe('/app', function () {
    it('ダッシュボードへリダイレクトする', function () {
        get('/app')->assertRedirect('/app/dashboard');
    });

    it('ログイン済みならダッシュボードが開く', function () {
        actingAs(User::factory()->create())
            ->followingRedirects()
            ->get('/app')
            ->assertOk();
    });
});

describe('PWA のファイル', function () {
    it('Content-Type を付けて返す', function (string $path, string $contentType) {
        get($path)
            ->assertOk()
            ->assertHeader('Content-Type', $contentType);
    })->with([
        'Service Worker' => ['/app/sw.js', 'text/javascript; charset=UTF-8'],
        'マニフェスト' => ['/app/manifest.webmanifest', 'application/manifest+json'],
        'オフライン画面' => ['/app/offline.html', 'text/html; charset=UTF-8'],
    ]);

    it('ビルドが変わると Service Worker の中身も変わる', function () {
        Vite::shouldReceive('manifestHash')->andReturn('build-a', 'build-b');

        $first = get('/app/sw.js')->getContent();
        $second = get('/app/sw.js')->getContent();

        expect($first)->not->toContain('__SW_VERSION__')
            ->and($first)->not->toBe($second);
    });

    it('セッションの Cookie を発行しない', function () {
        get('/app/manifest.webmanifest')->assertCookieMissing(config('session.cookie'));
    });
});
