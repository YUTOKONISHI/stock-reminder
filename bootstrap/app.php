<?php

use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LogRequest;
use App\Http\Middleware\SetSecurityHeaders;
use App\Support\LogContext;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Illuminate\Routing\Exceptions\InvalidSignatureException;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function () {
            Route::group([], base_path('routes/pwa.php'));
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->trustProxies(at: '*');

        $middleware->append([LogRequest::class, SetSecurityHeaders::class]);

        $middleware->web(append: [
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);

        $middleware->redirectGuestsTo(
            fn (Request $request) => $request->is('admin/*')
                ? route('admin.login')
                : route('login'),
        );
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (InvalidSignatureException $e, Request $request) {
            if ($request->routeIs('verification.verify')) {
                return to_route('verification.notice', ['expired' => 1]);
            }
        });

        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );

        $exceptions->context(function (): array {
            if (app()->runningInConsole()) {
                return [];
            }

            $request = request();

            return [
                'method' => $request->method(),
                'path' => '/'.ltrim($request->path(), '/'),
                ...LogContext::actor(),
                'ip' => $request->ip(),
            ];
        });

        $exceptions->respond(function (Response $response, Throwable $e, Request $request) {
            $status = $response->getStatusCode();
            $shouldRender = in_array($status, [403, 404, 419], true) || $status >= 500;
            if (config('app.debug') || ! $shouldRender) {
                return $response;
            }

            return Inertia::render('error', ['code' => $status])
                ->toResponse($request)
                ->setStatusCode($status);
        });
    })->create();
