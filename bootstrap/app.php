<?php

use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LogRequest;
use App\Support\LogContext;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

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

        $middleware->append(LogRequest::class);

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
    })->create();
