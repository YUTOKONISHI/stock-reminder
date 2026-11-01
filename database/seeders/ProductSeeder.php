<?php

namespace Database\Seeders;

use App\Models\Admin;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Database\Seeder;

class ProductSeeder extends Seeder
{
    /**
     * 商品マスタを投入する。
     *
     * default_consumption_interval_days は「1人世帯でストック1つが何日もつか」。
     * ストック設定画面ではこの値を世帯人数で割った日数が初期値になる
     * （Product::initialConsumptionIntervalDays を参照）。マスタ側は世帯人数を
     * 知らないので、ここには割る前の値を入れる。
     *
     * @var array<string, array<string, int>>
     */
    private const PRODUCTS = [
        '食品' => [
            '米' => 60,
            'パスタ' => 45,
            'レトルトカレー' => 30,
            'ツナ缶' => 30,
            'インスタントラーメン' => 30,
            'シリアル' => 30,
            '小麦粉' => 90,
        ],
        '日用品' => [
            'トイレットペーパー' => 45,
            'ティッシュ' => 30,
            '洗濯洗剤' => 60,
            '柔軟剤' => 60,
            '食器用洗剤' => 60,
            'シャンプー' => 90,
            'コンディショナー' => 90,
            'ボディソープ' => 60,
            'ハンドソープ' => 60,
            '歯磨き粉' => 60,
            '歯ブラシ' => 30,
            'キッチンペーパー' => 45,
            'ラップ' => 60,
            'ゴミ袋' => 60,
        ],
        '飲料' => [
            'ミネラルウォーター 2L' => 5,
            'お茶 2L' => 5,
            '炭酸水 500ml' => 3,
            '野菜ジュース 1L' => 7,
            'コーヒー豆' => 45,
            '紅茶' => 60,
        ],
        '調味料' => [
            '醤油' => 90,
            '味噌' => 60,
            'サラダ油' => 120,
            '砂糖' => 180,
            '塩' => 365,
            'みりん' => 120,
            '料理酒' => 120,
            '酢' => 180,
            'めんつゆ' => 60,
            'コンソメ' => 120,
            'マヨネーズ' => 60,
            'ケチャップ' => 90,
        ],
    ];

    public function run(): void
    {
        $adminId = Admin::where('name', 'admin')->value('id');

        foreach (self::PRODUCTS as $categoryName => $products) {
            $categoryId = Category::where('name', $categoryName)->value('id');

            foreach ($products as $name => $days) {
                Product::firstOrCreate(
                    ['name' => $name],
                    [
                        'category_id' => $categoryId,
                        'default_consumption_interval_days' => $days,
                        'created_by' => $adminId,
                        'updated_by' => $adminId,
                    ],
                );
            }
        }
    }
}
