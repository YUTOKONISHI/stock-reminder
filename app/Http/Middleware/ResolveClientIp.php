<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\IpUtils;
use Symfony\Component\HttpFoundation\Response;

class ResolveClientIp
{
    public function handle(Request $request, Closure $next): Response
    {
        $ip = $this->resolve($request);
        if ($ip !== null) {
            $request->server->set('REMOTE_ADDR', $ip);
        }

        return $next($request);
    }

    private function resolve(Request $request): ?string
    {
        // Fly Proxy が付ける、Fly Proxy から見た接続元。Fly の外（ローカルやテスト）では付かない。
        $peer = $this->validIp($request->headers->get('Fly-Client-IP'));
        if ($peer === null) {
            return null;
        }

        /** @var list<string> $cloudflareIps */
        $cloudflareIps = config('services.cloudflare.proxy_ips');
        if (! IpUtils::checkIp($peer, $cloudflareIps)) {
            return $peer;
        }

        return $this->validIp($request->headers->get('CF-Connecting-IP')) ?? $peer;
    }

    private function validIp(?string $value): ?string
    {
        return filter_var($value, FILTER_VALIDATE_IP) !== false ? $value : null;
    }
}
