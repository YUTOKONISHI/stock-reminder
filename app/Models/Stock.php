<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Database\Factories\StockFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property int $product_id
 * @property int $quantity
 * @property int $consumption_interval_days
 * @property CarbonImmutable $next_purchase_date
 * @property CarbonImmutable|null $last_purchased_on
 * @property CarbonImmutable $created_at
 * @property CarbonImmutable $updated_at
 * @property-read Product $product
 * @property-read User $user
 *
 * @method static \Database\Factories\StockFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Stock newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Stock newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Stock query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Stock whereConsumptionIntervalDays($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Stock whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Stock whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Stock whereLastPurchasedOn($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Stock whereNextPurchaseDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Stock whereProductId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Stock whereQuantity($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Stock whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Stock whereUserId($value)
 *
 * @mixin \Eloquent
 */
#[Fillable('user_id', 'product_id', 'quantity', 'consumption_interval_days', 'next_purchase_date', 'last_purchased_on')]
class Stock extends Model
{
    /** @use HasFactory<StockFactory> */
    use HasFactory;

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'next_purchase_date' => 'date:Y-m-d',
            'last_purchased_on' => 'date:Y-m-d',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public static function purchaseDateAfter(int $intervalDays, int $quantity): string
    {
        return now()->addDays($intervalDays * $quantity)->toDateString();
    }

    public function calculateNextPurchaseDate(): string
    {
        return self::purchaseDateAfter($this->consumption_interval_days, $this->quantity);
    }
}
