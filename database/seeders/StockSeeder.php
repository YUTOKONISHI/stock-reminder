<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\Stock;
use App\Models\User;
use Illuminate\Database\Seeder;

class StockSeeder extends Seeder
{
    /**
     * テストユーザーのストックを投入する。
     *
     * ダッシュボードの並び順（ストック数1のものを先頭、その中と残りをそれぞれ
     * 次回購入予定日の早い順）を画面で確かめられるよう、ストック数1の商品と、
     * 予定日はより近いがストック数が2以上の商品を混ぜている。
     * ミネラルウォーターが5日後で最も近いが、ストック数3なので後ろに回る。
     *
     * 消費日数は世帯人数2で割ったあとの値を入れる。画面から登録したときと
     * 同じ状態にするため。
     *
     * @var array<int, array{product: string, quantity: int, days: int, after: int}>
     */
    private const STOCKS = [
        ['product' => 'トイレットペーパー', 'quantity' => 1, 'days' => 22, 'after' => 22],
        ['product' => '洗濯洗剤', 'quantity' => 1, 'days' => 30, 'after' => 30],
        ['product' => 'ミネラルウォーター 2L', 'quantity' => 3, 'days' => 2, 'after' => 5],
        ['product' => '米', 'quantity' => 2, 'days' => 30, 'after' => 60],
        ['product' => '醤油', 'quantity' => 2, 'days' => 45, 'after' => 90],
    ];

    public function run(): void
    {
        $userId = User::where('email', 'test@example.com')->value('id');

        foreach (self::STOCKS as $stock) {
            $productId = Product::where('name', $stock['product'])->value('id');

            Stock::firstOrCreate(
                ['user_id' => $userId, 'product_id' => $productId],
                [
                    'quantity' => $stock['quantity'],
                    'consumption_interval_days' => $stock['days'],
                    // 画面から登録したときも StockController::resolveNextPurchaseDate
                    // が日付だけを渡す。
                    'next_purchase_date' => now()->addDays($stock['after'])->toDateString(),
                ],
            );
        }
    }
}
