<?php

use App\Models\Product;
use App\Models\Stock;
use App\Models\User;
use Carbon\Carbon;
use Inertia\Testing\AssertableInertia as Assert;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\assertDatabaseMissing;
use function Pest\Laravel\travelTo;

beforeEach(function () {
    travelTo(Carbon::parse('2026-09-21'));
});

describe('他人のストック', function () {
    it('操作すると403', function (string $method, string $route, array $data = []) {
        $stock = Stock::factory()->create();

        actingAs(User::factory()->create())
            ->$method(route($route, $stock), $data)
            ->assertForbidden();
    })->with([
        '編集画面' => ['get', 'stocks.edit'],
        '更新' => ['put', 'stocks.update', ['quantity' => 1, 'consumption_interval_days' => 7]],
        '削除' => ['delete', 'stocks.destroy'],
        '購入' => ['patch', 'stocks.purchase', ['quantity' => 1]],
    ]);
});

describe('index', function () {
    it('自分のストックだけを一覧に出す', function () {
        $stock = Stock::factory()->create();
        Stock::factory()->create();

        actingAs($stock->user)
            ->get(route('stocks.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('stocks/index')
                ->has('stocks.data', 1)
                ->where('stocks.data.0.id', $stock->id));
    });
});

describe('create', function () {
    it('自分が登録済みの商品だけ候補から外す', function () {
        $stock = Stock::factory()->create();
        $other = Stock::factory()->create();

        actingAs($stock->user)
            ->get(route('stocks.create'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('stocks/form')
                ->has('products', 1)
                ->where('products.0.id', $other->product_id));
    });
});

describe('store', function () {
    it('同じ商品は重ねて登録できない', function () {
        $stock = Stock::factory()->create();

        actingAs($stock->user)
            ->post(route('stocks.store'), [
                'product_id' => $stock->product_id,
                'quantity' => 1,
                'consumption_interval_days' => 1,
                'next_purchase_date' => now()->addDays(1)->format('Y-m-d'),
            ])
            ->assertInvalid(['product_id' => 'この商品は既に登録されています']);
    });

    it('登録するとストックが増え、一覧に戻る', function () {
        $user = User::factory()->create();
        $product = Product::factory()->create();

        actingAs($user)
            ->post(route('stocks.store'), [
                'product_id' => $product->id,
                'quantity' => 2,
                'consumption_interval_days' => 7,
            ])
            ->assertRedirect(route('stocks.index'));

        assertDatabaseHas('stocks', [
            'user_id' => $user->id,
            'product_id' => $product->id,
            'quantity' => 2,
            'next_purchase_date' => '2026-10-05',
        ]);
    });
});

describe('update', function () {
    it('ストック数NG', function () {
        $stock = Stock::factory()->create();

        actingAs($stock->user)
            ->put(route('stocks.update', $stock), [
                'quantity' => 0,
                'consumption_interval_days' => 1,
                'next_purchase_date' => now()->addDays(7)->format('Y-m-d'),
            ])
            ->assertInvalid(['quantity' => 'ストック数は1以上の値にしてください。']);
    });

    it('消費日数NG', function () {
        $stock = Stock::factory()->create();

        actingAs($stock->user)
            ->put(route('stocks.update', $stock), [
                'quantity' => 1,
                'consumption_interval_days' => 0,
                'next_purchase_date' => now()->addDays(7)->format('Y-m-d'),
            ])
            ->assertInvalid(['consumption_interval_days' => '消費日数は1以上の値にしてください。']);
    });

    it('予定日が空欄なら消費日数とストック数から算出する', function () {
        $stock = Stock::factory()->create();

        actingAs($stock->user)
            ->put(route('stocks.update', $stock), [
                'quantity' => 2,
                'consumption_interval_days' => 7,
            ])
            ->assertRedirect(route('stocks.index'));

        expect($stock->refresh())
            ->next_purchase_date->format('Y-m-d')->toBe('2026-10-05');
    });

    it('予定日を入れればその日付で保存する', function () {
        $stock = Stock::factory()->create();

        actingAs($stock->user)
            ->put(route('stocks.update', $stock), [
                'quantity' => 2,
                'consumption_interval_days' => 7,
                'next_purchase_date' => '2026-12-01',
            ])
            ->assertRedirect(route('stocks.index'));

        expect($stock->refresh()->next_purchase_date->format('Y-m-d'))->toBe('2026-12-01');
    });

    it('購入日の記録を消す', function () {
        $stock = Stock::factory()->create(['last_purchased_on' => '2026-09-21']);

        actingAs($stock->user)
            ->put(route('stocks.update', $stock), [
                'quantity' => 2,
                'consumption_interval_days' => 7,
            ])
            ->assertRedirect(route('stocks.index'));

        expect($stock->refresh()->last_purchased_on)->toBeNull();
    });
});

describe('destroy', function () {
    it('削除するとストックが消え、一覧に戻る', function () {
        $stock = Stock::factory()->create();

        actingAs($stock->user)
            ->delete(route('stocks.destroy', $stock))
            ->assertRedirect(route('stocks.index'));

        assertDatabaseMissing('stocks', ['id' => $stock->id]);
    });
});

describe('purchase', function () {
    it('入力したストック数を保存し、その数で予定日を進める', function () {
        $stock = Stock::factory()->create([
            'quantity' => 3,
            'consumption_interval_days' => 7,
            'next_purchase_date' => '2026-09-22',
        ]);

        actingAs($stock->user)
            ->patch(route('stocks.purchase', $stock), ['quantity' => 2])
            ->assertRedirect(route('dashboard'));

        expect($stock->refresh())
            ->next_purchase_date->format('Y-m-d')->toBe('2026-10-05')
            ->quantity->toBe(2)
            ->last_purchased_on->format('Y-m-d')->toBe('2026-09-21');
    });

    it('ストック数NGでは何も変えない', function (array $data) {
        $stock = Stock::factory()->create([
            'quantity' => 3,
            'next_purchase_date' => '2026-09-22',
        ]);

        actingAs($stock->user)
            ->patch(route('stocks.purchase', $stock), $data)
            ->assertInvalid('quantity');

        expect($stock->refresh())
            ->next_purchase_date->format('Y-m-d')->toBe('2026-09-22')
            ->quantity->toBe(3)
            ->last_purchased_on->toBeNull();
    })->with([
        '未入力' => [[]],
        '0' => [['quantity' => 0]],
        '小数' => [['quantity' => 1.5]],
    ]);
});
