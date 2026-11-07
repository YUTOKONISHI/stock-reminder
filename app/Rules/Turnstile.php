<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

class Turnstile implements ValidationRule
{
    public const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

    // Cloudflare のテスト用シークレットキー。応答の hostname は常に example.com で、action も返らない。
    public const TESTING_SECRET = '1x0000000000000000000000000000000AA';

    public function __construct(private readonly string $action) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || ! $this->verify($value)) {
            $fail('確認に失敗しました。もう一度お試しください。');
        }
    }

    private function verify(string $token): bool
    {
        $secret = config('services.turnstile.secret_key');
        if (! is_string($secret) || $secret === '') {
            return false;
        }

        try {
            $response = Http::asForm()->timeout(5)->post(self::SITEVERIFY_URL, [
                'secret' => $secret,
                'response' => $token,
                'remoteip' => request()->ip(),
            ]);
        } catch (ConnectionException) {
            return false;
        }

        if (! $response->successful() || $response->json('success') !== true) {
            return false;
        }

        if ($secret === self::TESTING_SECRET) {
            return true;
        }

        return $response->json('action') === $this->action
            && $response->json('hostname') === parse_url((string) config('app.url'), PHP_URL_HOST);
    }
}
