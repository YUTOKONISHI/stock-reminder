<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Fortify\Contracts\UpdatesUserPasswords;
use Laravel\Fortify\Contracts\UpdatesUserProfileInformation;

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
            }
        });

        return back();
    }
}
