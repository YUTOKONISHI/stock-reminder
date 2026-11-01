<?php

namespace Database\Seeders;

use App\Models\Admin;
use App\Models\Category;
use Illuminate\Database\Seeder;

class CategorySeeder extends Seeder
{
    /**
     * カテゴリマスタを投入する。
     *
     * 名前は resources/js/shared/components/CategoryIcon.tsx のアイコン対応表と揃える。
     * ここに無い名前のカテゴリは、ダッシュボードで既定のアイコンになる。
     */
    public function run(): void
    {
        $adminId = Admin::where('name', 'admin')->value('id');

        $names = ['食品', '日用品', '飲料', '調味料'];

        foreach ($names as $name) {
            Category::firstOrCreate(
                ['name' => $name],
                ['created_by' => $adminId, 'updated_by' => $adminId],
            );
        }
    }
}
