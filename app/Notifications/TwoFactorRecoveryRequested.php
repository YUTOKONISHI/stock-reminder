<?php

namespace App\Notifications;

use App\Models\User;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TwoFactorRecoveryRequested extends Notification
{
    public function __construct(private User $user, private string $ip) {}

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
            ->subject('2段階認証の解除依頼がありました')
            ->line('利用者ID: '.$this->user->id)
            ->line('メールアドレス: '.$this->user->email)
            ->line('依頼の日時: '.now()->format('Y-m-d H:i'))
            ->line('IPアドレス: '.$this->ip)
            ->salutation('ストック管理システム');
    }
}
