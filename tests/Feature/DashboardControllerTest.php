<?php

use App\Models\Stock;
use App\Models\User;
use Carbon\Carbon;
use Inertia\Testing\AssertableInertia as Assert;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\travelTo;

beforeEach(function () {
    travelTo(Carbon::parse('2026-09-21'));
});

describe('index', function () {
    it('他人のストックは出さない', function () {
        $user = User::factory()->create();
        Stock::factory()->for($user)->create();
        Stock::factory()->create();

        actingAs($user)
            ->get(route('dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('dashboard')
                ->has('stocks', 1));
    });
    it('ストック数1を先頭にした並び順になる', function () {
        $user = User::factory()->create();
        $stocks = collect([
            'ストック数2で予定日が近い' => ['quantity' => 2, 'next_purchase_date' => '2026-09-22'],
            'ストック数1で予定日が遠い' => ['quantity' => 1, 'next_purchase_date' => '2026-12-01'],
            'ストック数2で予定日が遠い' => ['quantity' => 2, 'next_purchase_date' => '2026-12-31'],
            'ストック数1で予定日が近い' => ['quantity' => 1, 'next_purchase_date' => '2026-09-23'],
        ])->map(fn (array $attributes) => Stock::factory()->for($user)->create($attributes));

        actingAs($user)
            ->get(route('dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('dashboard')
                ->has('stocks', 4)
                ->where('stocks.0.id', $stocks['ストック数1で予定日が近い']->id)
                ->where('stocks.1.id', $stocks['ストック数1で予定日が遠い']->id)
                ->where('stocks.2.id', $stocks['ストック数2で予定日が近い']->id)
                ->where('stocks.3.id', $stocks['ストック数2で予定日が遠い']->id));
    });
});
