<?php

namespace App\Providers;

use Carbon\CarbonImmutable;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        $this->configureRateLimiting();
    }

    /**
     * 管理者ログインの回数制限。Fortify の login リミッタと値も鍵の作り方も揃える。
     */
    protected function configureRateLimiting(): void
    {
        RateLimiter::for('admin-login', function (Request $request) {
            $throttleKey = Str::transliterate(Str::lower((string) $request->input('name')).'|'.$request->ip());

            return Limit::perMinute(5)->by($throttleKey);
        });
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        // 漏洩の確認は Have I Been Pwned に問い合わせるので、本番だけで行う。
        Password::defaults(fn (): Password => app()->isProduction()
            ? Password::min(8)->uncompromised()
            : Password::min(8),
        );

        // 変更前の規則（doc/plans/20261025-password-rule.md）。
        // Password::defaults(fn (): ?Password => app()->isProduction()
        //     ? Password::min(12)
        //         ->mixedCase()
        //         ->letters()
        //         ->numbers()
        //         ->symbols()
        //         ->uncompromised()
        //     : null,
        // );
    }
}
