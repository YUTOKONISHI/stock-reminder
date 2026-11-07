<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TwoFactorDisabled extends Notification
{
    public function __construct()
    {
        //
    }

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
            ->subject('2段階認証を無効にしました')
            ->line('ログインのときに、認証アプリのコードを聞かれなくなりました。')
            ->line('お心当たりがない場合は、パスワードが他人に知られた可能性があります。パスワードを変更してください。')
            ->salutation('ストック管理システム');
    }
}
