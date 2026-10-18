<?php

use App\Models\Product;

it('消費日数の初期値を世帯人数で割る', function (?int $householdSize, int $expected) {
    $product = new Product(['default_consumption_interval_days' => 14]);
    expect($product->initialConsumptionIntervalDays($householdSize))->toBe($expected);
})->with([
    '世帯人数が未設定' => [null, 14],
    '1人' => [1, 14],
    '0人は1人と同じ扱い' => [0, 14],
    '2人で半分' => [2, 7],
    '割り切れないときは切り捨て' => [3, 4],
    '下限は1日' => [30, 1],
]);
