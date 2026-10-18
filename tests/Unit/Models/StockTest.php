<?php

use App\Models\Stock;
use Illuminate\Support\Carbon;

use function Pest\Laravel\travelTo;

beforeEach(function () {
    travelTo(Carbon::parse('2026-09-12'));
});

it('次回購入予定日は消費日数とストック数を掛けた日数だけ先になる', function () {
    expect(Stock::purchaseDateAfter(7, 3))->toBe('2026-10-03');
});

it('自分の消費日数とストック数から次回購入予定日を出す', function () {
    $stock = new Stock(['quantity' => 3, 'consumption_interval_days' => 7]);

    expect($stock->calculateNextPurchaseDate())->toBe('2026-10-03');
});
