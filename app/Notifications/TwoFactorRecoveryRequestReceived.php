<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TwoFactorRecoveryRequestReceived extends Notification
{
    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('2段階認証の解除依頼を受け付けました')
            ->line('解除の依頼を受け付けました。管理者からこのアドレスに確認のメールを送ります。')
            ->line('お心当たりがない場合は、パスワードが他人に知られた可能性があります。パスワードを変更してください。')
            ->salutation('ストック管理システム');
    }
}
