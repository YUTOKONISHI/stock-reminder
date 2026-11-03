<?php

namespace App\Providers;

use Carbon\CarbonImmutable;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Notifications\Messages\MailMessage;
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

        VerifyEmail::toMailUsing(function (object $notifiable, string $url) {
            $expiresInMinutes = (int) config('auth.verification.expire', 60);

            return (new MailMessage)
                ->subject('メールアドレスの確認')
                ->greeting('ご登録ありがとうございます')
                ->line('下のボタンを押して、メールアドレスの確認を完了してください。')
                ->action('メールアドレスを確認する', $url)
                ->line('このリンクは'.$expiresInMinutes.'分で使えなくなります。')
                ->line('お心当たりがない場合は、このメールを破棄してください。')
                ->salutation('ストック管理システム');
        });
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
    }
}
