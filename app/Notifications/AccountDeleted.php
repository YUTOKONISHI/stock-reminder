<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class AccountDeleted extends Notification
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
            ->subject('アカウントを削除しました')
            ->greeting('アカウントの削除が完了しました')
            ->line('ストックと通知履歴も削除しました。元に戻すことはできません。')
            ->line('お心当たりがない場合は、パスワードが他人に知られた可能性があります。同じパスワードを使っている他のサービスのパスワードを変更してください。')
            ->salutation('ストック管理システム');
    }
}
