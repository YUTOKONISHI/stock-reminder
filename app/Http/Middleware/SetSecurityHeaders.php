<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class SetSecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $nonce = Vite::useCspNonce();
        $response = $next($request);
        $response->headers->set('X-Frame-Options', 'DENY');
        $csp = [
            'default-src' => ["'self'"],
            'script-src' => ["'self'", "'nonce-{$nonce}'"],
            'style-src' => ["'self'", "'unsafe-inline'"],
            'img-src' => ["'self'", 'data:'],
            'font-src' => ["'self'"],
            'connect-src' => ["'self'"],
            'object-src' => ["'none'"],
            'base-uri' => ["'self'"],
            'form-action' => ["'self'"],
            'frame-ancestors' => ["'none'"],
        ];
        if (Vite::isRunningHot()) {
            $hotUrl = trim((string) file_get_contents(Vite::hotFile()));
            $csp['script-src'][] = $hotUrl;
            $csp['style-src'][] = $hotUrl;
            $csp['font-src'][] = $hotUrl;
            $csp['img-src'][] = $hotUrl;
            $csp['connect-src'][] = $hotUrl;
            $csp['connect-src'][] = Str::replaceStart('http', 'ws', $hotUrl);
        }
        $response->headers->set('Content-Security-Policy', $this->joinCsp($csp));
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        if (app()->isProduction()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000');
        }

        return $response;
    }

    /**
     * @param  array<string, list<string>>  $csp
     */
    private function joinCsp(array $csp): string
    {
        return collect($csp)
            ->map(fn (array $sources, string $directive) => $directive.' '.implode(' ', $sources))
            ->implode('; ');
    }
}
