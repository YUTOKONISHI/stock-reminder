<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PurchaseRemindersFailed extends Notification
{
    public function __construct(private readonly int $failed, private readonly int $total) {}

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
            ->subject('購入予定日の通知に失敗しました')
            ->greeting('購入予定日の通知に失敗した利用者がいます')
            ->line("対象{$this->total}人のうち、{$this->failed}人の処理に失敗しました。")
            ->line('12時までは毎時0分に送り直します。原因はログの「購入予定日の通知を積めなかった」「購入予定日の通知を処理できなかった」で確かめてください。')
            ->salutation('ストック管理システム');
    }
}
