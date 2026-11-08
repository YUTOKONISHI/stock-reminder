<?php

use function Pest\Laravel\get;
use function Pest\Laravel\withHeaders;

describe('秘密の値が設定されているとき', function () {
    beforeEach(function () {
        config(['services.cloudflare.origin_auth_secret' => 'test-secret']);
    });

    it('ヘッダが無ければ 403', function () {
        get('/app/login')->assertForbidden();
    });

    it('値が違えば 403', function () {
        withHeaders(['X-Origin-Auth' => 'wrong'])
            ->get('/app/login')
            ->assertForbidden();
    });

    it('値が合えば通る', function () {
        withHeaders(['X-Origin-Auth' => 'test-secret'])
            ->get('/app/login')
            ->assertOk();
    });

    it('ヘルスチェックはヘッダが無くても通る', function () {
        get('/up')->assertOk();
    });

    it('web グループを通らないルートも断る', function () {
        get('/app/sw.js')->assertForbidden();
    });
});

it('秘密の値が無ければ照合しない', function () {
    config(['services.cloudflare.origin_auth_secret' => null]);

    get('/app/login')->assertOk();
});
