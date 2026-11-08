<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TwoFactorController extends Controller
{
    public function show(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();
        $status = match (true) {
            $user->two_factor_secret === null => 'disabled',
            $user->two_factor_confirmed_at === null => 'pending',
            default => 'enabled',
        };
        $isPending = $status === 'pending';

        return Inertia::render('settings/two-factor', [
            'status' => $status,
            'qrCodeSvg' => $isPending ? $user->twoFactorQrCodeSvg() : null,
            'secretKey' => $isPending ? decrypt($user->two_factor_secret) : null,
            'recoveryCodes' => $status === 'enabled' ? $user->recoveryCodes() : null,
        ]);
    }
}
