<?php

namespace App\Http\Controllers;

use App\Actions\Fortify\PasswordValidationRules;
use App\Models\User;
use App\Notifications\TemporaryPasswordIssued;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class PasswordResetController extends Controller
{
    use PasswordValidationRules;

    public function sendTemporaryPassword(Request $request): RedirectResponse
    {
        $request->validate([
            'email' => ['required', 'email'],
        ]);

        $email = Str::lower($request->email);

        $user = User::where('email', $email)->first();

        if ($user) {
            $temporaryPassword = $this->generateTemporaryPassword();

            DB::table('password_reset_tokens')->updateOrInsert(
                ['email' => $email],
                ['token' => Hash::make($temporaryPassword), 'created_at' => now()],
            );

            $user->notify(new TemporaryPasswordIssued($temporaryPassword));
        }

        return back()->with('success', '仮パスワードをメールで送信しました');
    }

    public function resetPassword(Request $request): RedirectResponse
    {
        $request->validate([
            'email' => ['required', 'email'],
            'temporary_password' => ['required'],
            'password' => $this->passwordRules(),
        ]);

        $failed = ['temporary_password' => '仮パスワードが正しくありません。もう一度発行してください。'];

        $email = Str::lower($request->email);
        $record = DB::table('password_reset_tokens')->where('email', $email)->first();

        if (! $record || ! Hash::check($request->temporary_password, $record->token)) {
            return back()->withErrors($failed);
        }

        $expiresInMinutes = (int) config('auth.passwords.users.expire');

        if (Carbon::parse($record->created_at)->addMinutes($expiresInMinutes)->isPast()) {
            DB::table('password_reset_tokens')->where('email', $email)->delete();

            return back()->withErrors($failed);
        }

        $user = User::where('email', $email)->first();

        if (! $user) {
            return back()->withErrors($failed);
        }

        DB::transaction(
            function () use ($user, $request, $email) {
                $user->forceFill([
                    'password' => $request->password,
                    'remember_token' => Str::random(60),
                ])->save();

                DB::table('sessions')->where('user_id', $user->id)->delete();
                DB::table('password_reset_tokens')->where('email', $email)->delete();
            }
        );

        return to_route('login')->with('success', 'パスワードを再設定しました');
    }

    private function generateTemporaryPassword(): string
    {
        // 0とO、1とIは書き写しで取り違えるため除外
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

        $password = '';
        for ($i = 0; $i < 8; $i++) {
            $password .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }

        return $password;
    }
}
