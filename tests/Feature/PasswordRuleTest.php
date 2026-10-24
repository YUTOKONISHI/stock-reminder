<?php

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

function passwordPasses(string $password): bool
{
    return Validator::make(['password' => $password], ['password' => Password::default()])->passes();
}

it('8文字以上を求め、文字の種類は問わない', function () {
    Http::preventStrayRequests();

    expect(passwordPasses('abcdefg'))->toBeFalse();
    expect(passwordPasses('abcdefgh'))->toBeTrue();
});

describe('本番', function () {
    beforeEach(function () {
        app()['env'] = 'production';
    });

    it('漏洩が確認されたパスワードは通さない', function () {
        // "password" の SHA-1 の後半35文字。Have I Been Pwned の応答と同じ形式。
        Http::fake(['api.pwnedpasswords.com/*' => Http::response("1E4C9B93F3F0682250B6CF8331B7EE68FD8:3\r\n")]);

        expect(passwordPasses('password'))->toBeFalse();
    });

    it('漏洩していなければ8文字で通す', function () {
        Http::fake(['api.pwnedpasswords.com/*' => Http::response('')]);

        expect(passwordPasses('kiwi-pasta'))->toBeTrue();
    });
});
