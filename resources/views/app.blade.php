<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" @class(['dark' => ($appearance ?? 'system') == 'dark'])>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">

        <link rel="icon" href="/favicon.ico" sizes="any">
        <link rel="icon" href="/favicon.svg" type="image/svg+xml">
        <link rel="apple-touch-icon" href="/apple-touch-icon.png">

        {{-- 管理画面には manifest を出さない。scope が /app/ なので管理画面では
             どのみち採用されず、DevTools にスコープ違反のエラーが出るだけのため。
             管理画面をPWAから外しているのは public/app/sw.js のスコープであって、この分岐ではない。 --}}
        @unless (request()->is('admin', 'admin/*'))
            <link rel="manifest" href="/app/manifest.webmanifest">
            {{-- app.css の --color-primary-600 と同値。片方を変えたら manifest の theme_color も直すこと。 --}}
            <meta name="theme-color" content="#5A7550">
        @endunless

        @fonts

        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        <x-inertia::head>
            <title>{{ config('app.name', 'Laravel') }}</title>
        </x-inertia::head>
    </head>
    <body class="font-sans antialiased">
        <x-inertia::app />
    </body>
</html>
