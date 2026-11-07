<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Notifications\TwoFactorRecoveryRequested;
use App\Notifications\TwoFactorRecoveryRequestReceived;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Throwable;

class TwoFactorRecoveryRequestController extends Controller
{
    public function recoveryRequest(Request $request): RedirectResponse
    {
        $request->validate(['email' => ['required', 'email']]);

        $user = User::find((int) $request->session()->get('login.id'));

        if (! $user) {
            return redirect()->route('login');
        }

        if (Str::lower($request->email) !== $user->email) {
            return back()->withErrors(['email' => 'ログインに使ったメールアドレスを入力してください']);
        }

        $key = 'two-factor-recovery:'.$user->id;

        if (RateLimiter::tooManyAttempts($key, 1)) {
            return back()->withErrors(['email' => '依頼は受け付け済みです。1時間ほどおいてからお試しください']);
        }

        $to_email = config('services.admin.alert_email');
        $ip = (string) $request->ip();

        try {
            Notification::route('mail', $to_email)->notify(new TwoFactorRecoveryRequested($user, $ip));
            $user->notify(new TwoFactorRecoveryRequestReceived);
            RateLimiter::hit($key, 3600);

            return back();
        } catch (Throwable $exception) {
            Log::error('2段階認証の解除依頼を送れなかった', ['user_id' => $user->id, 'exception' => $exception]);

            return back()->withErrors(['email' => '依頼を送れませんでした。時間をおいてもう一度お試しください']);
        }
    }
}
