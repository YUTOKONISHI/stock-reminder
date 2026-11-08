<?php

namespace App\Actions\Fortify;

use App\Notifications\TwoFactorDisabled;
use Laravel\Fortify\Actions\DisableTwoFactorAuthentication as BaseDisableTwoFactorAuthentication;

class DisableTwoFactorAuthentication extends BaseDisableTwoFactorAuthentication
{
    public function __invoke($user)
    {
        $wasEnabled = $user->two_factor_confirmed_at !== null;

        parent::__invoke($user);

        if ($wasEnabled) {
            $user->notify(new TwoFactorDisabled);
        }
    }
}
