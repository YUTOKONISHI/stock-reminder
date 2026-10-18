<?php

namespace Database\Factories;

use App\Models\Product;
use App\Models\Stock;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Stock>
 */
class StockFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'product_id' => Product::factory(),
            'quantity' => 2,
            'consumption_interval_days' => 7,
            'next_purchase_date' => now()->addDays(14)->toDateString(),
        ];
    }
}
