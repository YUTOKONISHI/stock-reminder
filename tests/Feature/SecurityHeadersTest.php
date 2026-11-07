<?php

use App\Models\Admin;
use App\Models\User;
use Illuminate\Support\Facades\Vite;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\get;

describe('ヘッダ情報が付与される', function () {
    it('各画面で付与されるヘッダ', function (string $url, ?string $guard, int $status) {
        match ($guard) {
            'web' => actingAs(User::factory()->create()),
            'admin' => actingAs(Admin::factory()->create(), 'admin'),
            null => null,
        };

        get($url)
            ->assertStatus($status)
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
            ->assertHeader('Content-Security-Policy');
    })->with([
        'ダッシュボード' => ['/app/dashboard', 'web', 200],
        '管理画面' => ['/admin/dashboard', 'admin', 200],
        'ログイン画面' => ['/app/login', null, 200],
        'オフライン画面' => ['/app/offline.html', null, 200],
        '存在しないページ' => ['/no-such-page', null, 404],
    ]);
});

describe('CSP', function () {
    beforeEach(function () {
        // public/hot はコンテナと共有されるので、npm run dev の最中は開発サーバの URL が CSP に混ざる。
        Vite::useHotFile(storage_path('framework/testing/hot'));
    });

    it('全文が決めたとおりになる', function () {
        $response = get('/app/login');
        $nonce = Vite::cspNonce();

        $response->assertHeader('Content-Security-Policy', implode('; ', [
            "default-src 'self'",
            "script-src 'self' 'nonce-{$nonce}' https://challenges.cloudflare.com",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data:",
            "font-src 'self'",
            "connect-src 'self'",
            'frame-src https://challenges.cloudflare.com',
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
        ]));
    });

    it('ヘッダと同じ nonce が script タグに付く', function () {
        $response = get('/app/login');
        $nonce = Vite::cspNonce();

        expect($response->getContent())
            ->toMatch('/<script type="module" src="[^"]+" nonce="'.preg_quote($nonce, '/').'"/');
    });

    it('nonce はリクエストのたびに変わる', function () {
        get('/app/login');
        $first = Vite::cspNonce();

        get('/app/login');
        $second = Vite::cspNonce();

        expect($first)->not->toBe($second);
    });
});

describe('HSTS', function () {
    it('本番では付く', function () {
        app()['env'] = 'production';

        get('/app/login')->assertHeader('Strict-Transport-Security', 'max-age=31536000');
    });

    it('本番以外では付かない', function () {
        get('/app/login')->assertHeaderMissing('Strict-Transport-Security');
    });
});
