<?php

use App\Models\User;
use App\Notifications\TwoFactorDisabled;
use Illuminate\Support\Facades\Notification;

use function Pest\Laravel\artisan;

describe('app:disable-two-factor', function () {
    it('コマンドで外すと、two_factor_secret、two_factor_recovery_codes、two_factor_confirmed_at が空になり、TwoFactorDisabled が送られる', function () {
        $user = User::factory()->twoFactorEnabled()->create(['email' => 'test@example.com']);
        Notification::fake();
        artisan('app:disable-two-factor', ['email' => 'test@example.com'])->assertSuccessful();

        $user->refresh();
        expect($user->two_factor_secret)->toBeNull();
        expect($user->two_factor_recovery_codes)->toBeNull();
        expect($user->two_factor_confirmed_at)->toBeNull();
        Notification::assertSentTo($user, TwoFactorDisabled::class);
    });

    it('居ないアドレスを渡すと、失敗の終了コードで終わる', function () {
        Notification::fake();
        artisan('app:disable-two-factor', ['email' => 'test@example.com'])
            ->expectsOutput('そのメールアドレスの利用者はいません')
            ->assertFailed();
    });
});
