<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireOriginAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var string|null $secret */
        $secret = config('services.cloudflare.origin_auth_secret');

        // ヘルスチェックは Fly.io から直接届き、Cloudflare を通らない。
        if (filled($secret) && ! $request->is('up')) {
            $given = $request->headers->get('X-Origin-Auth');
            abort_unless(is_string($given) && hash_equals($secret, $given), 403);
        }

        return $next($request);
    }
}
