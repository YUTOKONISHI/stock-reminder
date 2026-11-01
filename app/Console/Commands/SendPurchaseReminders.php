<?php

namespace App\Console\Commands;

use App\Enums\NotificationStatus;
use App\Models\NotificationLog;
use App\Models\Stock;
use App\Notifications\PurchaseReminder;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Throwable;

class SendPurchaseReminders extends Command
{
    protected $signature = 'app:send-purchase-reminders';

    protected $description = '当日が購入予定日のストックを持つユーザーに通知を送る';

    public function handle(): int
    {
        $today = Carbon::today();
        $stocks = Stock::with('product', 'user')->whereDate('next_purchase_date', '<=', $today)->orderBy('next_purchase_date')->get()->groupBy('user_id');

        foreach ($stocks as $userId => $userStocks) {
            try {
                $overdue = $userStocks->contains(
                    fn (Stock $stock) => $stock->next_purchase_date->toDateString() < $today->toDateString()
                );
                $user = $userStocks->firstOrFail()->user;
                $names = $userStocks->pluck('product.name');
                $count = $names->count();

                $title = $overdue
                    ? ($count === 1
                        ? "「{$names->first()}」を買い忘れていませんか"
                        : "「{$names->first()}」ほか".($count - 1).'件を買い忘れていませんか')
                    : ($count === 1
                        ? "「{$names->first()}」の購入予定日です"
                        : "「{$names->first()}」ほか".($count - 1).'件の購入予定日です');

                $lead = $overdue
                    ? ($count === 1 ? '購入予定日を過ぎています。' : '購入予定日を過ぎたものがあります。')
                    : '今日が購入予定日です。';

                $description = $count === 1
                    ? $lead.'買い忘れにご注意ください。'
                    : $lead.$names->take(3)->implode('、').($count > 3 ? '、ほか'.($count - 3).'件' : '');

                try {
                    $user->notify(new PurchaseReminder($title, $description));
                } catch (Throwable $exception) {
                    Log::error('購入予定日の通知を積めなかった', [
                        'user_id' => $userId,
                        'exception' => $exception,
                    ]);
                }

                NotificationLog::create([
                    'user_id' => $userId,
                    'title' => $title,
                    'description' => $description,
                    'status' => NotificationStatus::Unread,
                ]);
            } catch (Throwable $exception) {
                Log::error('購入予定日の通知を処理できなかった', [
                    'user_id' => $userId,
                    'exception' => $exception,
                ]);
            }
        }

        return self::SUCCESS;
    }
}
