<?php

namespace App\Console\Commands;

use App\Actions\Fortify\DisableTwoFactorAuthentication;
use App\Models\User;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

#[Signature('app:disable-two-factor {email}')]
#[Description('端末もリカバリーコードも失った利用者の2段階認証を外す')]
class DisableTwoFactor extends Command
{
    public function handle(DisableTwoFactorAuthentication $disable): int
    {
        /** @var string $email */
        $email = $this->argument('email');
        $user = User::where('email', Str::lower($email))->first();
        if (! $user) {
            $this->error('そのメールアドレスの利用者はいません');

            return self::FAILURE;
        }
        if ($user->two_factor_secret === null) {
            $this->info('2段階認証は有効になっていません');

            return self::SUCCESS;
        }

        $disable($user);

        Log::info('two-factor disabled by admin', ['user_id' => $user->id]);
        $this->info("{$user->email}の2段階認証を外しました");

        return self::SUCCESS;
    }
}
