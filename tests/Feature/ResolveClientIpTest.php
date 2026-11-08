<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use function Pest\Laravel\get;
use function Pest\Laravel\withHeaders;

beforeEach(function () {
    Route::get('/_test/ip', fn (Request $request) => response()->json([
        'ip' => $request->ip(),
        'url' => url('/'),
    ]));
});

it('ヘッダが無ければ接続元のまま', function () {
    get('/_test/ip')->assertJson(['ip' => '127.0.0.1']);
});

it('X-Forwarded-For は読まない', function () {
    withHeaders(['X-Forwarded-For' => '203.0.113.77'])
        ->get('/_test/ip')
        ->assertJson(['ip' => '127.0.0.1']);
});

it('X-Forwarded-Host は URL に使わない', function () {
    withHeaders(['X-Forwarded-Host' => 'evil.example'])
        ->get('/_test/ip')
        ->assertJson(['url' => config('app.url')]);
});

it('Fly-Client-IP があればその値', function () {
    withHeaders([
        'Fly-Client-IP' => '198.51.100.10',
        'X-Forwarded-For' => '203.0.113.77, 198.51.100.10',
    ])
        ->get('/_test/ip')
        ->assertJson(['ip' => '198.51.100.10']);
});

it('Fly-Client-IP が Cloudflare なら CF-Connecting-IP の値', function (string $cloudflareIp, string $clientIp) {
    withHeaders([
        'Fly-Client-IP' => $cloudflareIp,
        'CF-Connecting-IP' => $clientIp,
    ])
        ->get('/_test/ip')
        ->assertJson(['ip' => $clientIp]);
})->with([
    'IPv4' => ['172.64.1.1', '198.51.100.10'],
    'IPv6' => ['2606:4700::1', '2001:db8::10'],
]);

it('Fly-Client-IP が Cloudflare でなければ CF-Connecting-IP を使わない', function () {
    withHeaders([
        'Fly-Client-IP' => '198.51.100.10',
        'CF-Connecting-IP' => '203.0.113.77',
    ])
        ->get('/_test/ip')
        ->assertJson(['ip' => '198.51.100.10']);
});

it('IP アドレスの形でない値は使わない', function () {
    withHeaders(['Fly-Client-IP' => 'not-an-ip'])
        ->get('/_test/ip')
        ->assertJson(['ip' => '127.0.0.1']);

    withHeaders([
        'Fly-Client-IP' => '172.64.1.1',
        'CF-Connecting-IP' => 'not-an-ip',
    ])
        ->get('/_test/ip')
        ->assertJson(['ip' => '172.64.1.1']);
});
