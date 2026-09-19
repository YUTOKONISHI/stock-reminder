<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Database\Factories\ProductFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $category_id
 * @property string $name
 * @property int $default_consumption_interval_days
 * @property int $created_by
 * @property int $updated_by
 * @property CarbonImmutable $created_at
 * @property CarbonImmutable $updated_at
 * @property-read Category $category
 * @property-read Collection<int, Stock> $stocks
 * @property-read int|null $stocks_count
 *
 * @method static \Database\Factories\ProductFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Product newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Product newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Product query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Product whereCategoryId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Product whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Product whereCreatedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Product whereDefaultConsumptionIntervalDays($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Product whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Product whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Product whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Product whereUpdatedBy($value)
 *
 * @mixin \Eloquent
 */
#[Fillable('category_id', 'name', 'default_consumption_interval_days', 'created_by', 'updated_by')]
class Product extends Model
{
    /** @use HasFactory<ProductFactory> */
    use HasFactory;

    /** @return BelongsTo<Category, $this> */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /** @return HasMany<Stock, $this> */
    public function stocks(): HasMany
    {
        return $this->hasMany(Stock::class);
    }

    /**
     * ストック設定画面に出す消費日数の初期値を返す。
     *
     * 消費日数はストック数1つあたりが何日もつかを表す。世帯人数が増えれば
     * 1つを使い切る日数は短くなるので、マスタの値を世帯人数で除算する。
     * 下限を1にする。
     * 世帯人数が未設定のときは割らない。
     */
    public function initialConsumptionIntervalDays(?int $householdSize): int
    {
        if ($householdSize === null || $householdSize <= 1) {
            return $this->default_consumption_interval_days;
        }

        return max(1, intdiv($this->default_consumption_interval_days, $householdSize));
    }
}
