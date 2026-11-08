<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Notifications\AccountDeleted;
use Illuminate\Auth\SessionGuard;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Validator;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Fortify\Contracts\UpdatesUserPasswords;
use Laravel\Fortify\Contracts\UpdatesUserProfileInformation;
use Throwable;

class ProfileController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('settings/profile');
    }

    public function update(
        Request $request,
        UpdatesUserProfileInformation $updatesProfileInformation,
        UpdatesUserPasswords $updatesPasswords,
    ): RedirectResponse {
        $user = $request->user();
        $input = $request->only(['name', 'household_size', 'current_password', 'password', 'password_confirmation']);

        $changesPassword = $request->filled('password');

        DB::transaction(function () use (
            $user,
            $input,
            $changesPassword,
            $updatesProfileInformation,
            $updatesPasswords,
        ) {
            $updatesProfileInformation->update($user, $input);

            if ($changesPassword) {
                $updatesPasswords->update($user, $input);

                DB::table('sessions')->where('user_id', $user->id)->delete();
            }
        });

        if ($changesPassword) {
            /** @var SessionGuard $guard */
            $guard = Auth::guard('web');
            $guard->login($user, $request->hasCookie($guard->getRecallerName()));
        }

        return back();
    }

    public function destroy(Request $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();
        $input = $request->only(['password']);

        Validator::make($input, [
            'password' => ['required', 'string', 'current_password:web'],
        ], [
            'password.current_password' => '現在のパスワードが違います。',
        ])->validate();

        Auth::guard('web')->logout();

        $user->prune();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        try {
            Notification::route('mail', $user->email)->notify(new AccountDeleted);
        } catch (Throwable $exception) {
            Log::error('アカウント削除の完了メールを送れなかった', [
                'user_id' => $user->id,
                'exception' => $exception,
            ]);
        }

        return redirect()->route('login');
    }
}
