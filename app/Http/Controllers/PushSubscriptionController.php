<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Rules\PushEndpoint;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class PushSubscriptionController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'endpoint' => ['required', 'string', 'max:500', new PushEndpoint],
            'keys.p256dh' => ['required', 'string'],
            'keys.auth' => ['required', 'string'],
        ]);

        /** @var User $user */
        $user = $request->user();

        $user->updatePushSubscription(
            $request->input('endpoint'),
            $request->input('keys.p256dh'),
            $request->input('keys.auth'),
        );

        return back();
    }

    public function destroy(Request $request): RedirectResponse
    {
        $request->validate([
            'endpoint' => ['required', 'string', 'max:500'],
        ]);

        /** @var User $user */
        $user = $request->user();

        $user->deletePushSubscription($request->input('endpoint'));

        return back();
    }
}
