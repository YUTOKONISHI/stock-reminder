<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Str;

class PushEndpoint implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || ! self::isAllowedDomain($value)) {
            $fail('無効なプッシュ通知エンドポイントです。');
        }
    }

    public static function isAllowedDomain(string $url): bool
    {
        if (preg_match('/[\x00-\x20\x7f\\\\]/', $url)) {
            return false;
        }

        $p = parse_url($url);
        if (($p['scheme'] ?? '') !== 'https'
            || isset($p['user']) || isset($p['pass'])
            || isset($p['port']) && $p['port'] !== 443) {
            return false;
        }

        $host = Str::lower($p['host'] ?? '');

        if (! preg_match('/^[a-z0-9.-]+$/', $host)) {
            return false;
        }

        return in_array($host,
            config('webpush.exact_match_domains')) || Str::endsWith($host, config('webpush.suffix_match_domains'));
    }
}
