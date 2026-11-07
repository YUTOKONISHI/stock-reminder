<?php

use App\Models\User;
use function Pest\Laravel\actingAs;
use Inertia\Testing\AssertableInertia as Assert;


function registeredUser(string $email = 'test@example.com'): User
{
  return User::factory()->create(['email' => $email]);
}

describe('2段階認証の設定画面', function () {
  it('パスワードを確認していないと、設定画面を開くとパスワード確認画面へ送られる', function() {
    $user = registeredUser();
    actingAs($user)->withSession(['auth.password_confirmed_at' => null])
      ->get(route('two-factor.settings'))
      ->assertRedirect(route('password.confirm'));
  });

  it('3つの状態で、渡す値が切り替わる（設定中だけ QR コード、有効のときだけリカバリーコード）', function (){
    $user = registeredUser();
    actingAs($user)->withSession(['auth.password_confirmed_at' => time()])
      ->get(route('two-factor.settings'))
      ->assertInertia(fn(Assert $page) => $page->component('settings/two-factor'))
      ->has('status', 'disabled')
      ->has('qrCodeSvg', null)
      ->has('secretKey', null)
      ->has('recoveryCodes', null);
  });
});