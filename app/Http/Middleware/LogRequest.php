<?php

namespace App\Http\Middleware;

use App\Support\LogContext;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class LogRequest
{
    /**
     * @var list<string>
     */
    private const FILTERED_KEYS = [
        'password',
        'password_confirmation',
        'current_password',
        'temporary_password',
        'token',
        '_token',
        'email',
    ];

    private const FILTERED_VALUE = '[FILTERED]';

    /**
     * @var list<string>
     */
    private const EXCLUDED_PATHS = ['up', '_boost/*'];

    public function handle(Request $request, Closure $next): Response
    {
        return $next($request);
    }

    public function terminate(Request $request, Response $response): void
    {
        if ($request->is(...self::EXCLUDED_PATHS)) {
            return;
        }

        $status = $response->getStatusCode();

        Log::channel('request')->log($this->level($status), 'request', [
            'method' => $request->method(),
            'path' => '/'.ltrim($request->path(), '/'),
            'status' => $status,
            'duration_ms' => $this->durationMs(),
            ...LogContext::actor(),
            'ip' => $request->ip(),
            'input' => $this->filterInput($request->all()),
        ]);
    }

    private function level(int $status): string
    {
        return match (true) {
            $status >= 500 => 'error',
            $status >= 400 => 'warning',
            default => 'info',
        };
    }

    private function durationMs(): ?float
    {
        if (! defined('LARAVEL_START')) {
            return null;
        }

        return round((microtime(true) - LARAVEL_START) * 1000, 1);
    }

    /**
     * @param  array<array-key, mixed>  $input
     * @return array<array-key, mixed>
     */
    private function filterInput(array $input): array
    {
        foreach ($input as $key => $value) {
            if (is_array($value)) {
                $input[$key] = $this->filterInput($value);
            } else {
                if (in_array($key, self::FILTERED_KEYS, true)) {
                    $input[$key] = self::FILTERED_VALUE;
                }
            }
        }

        return $input;
    }
}
