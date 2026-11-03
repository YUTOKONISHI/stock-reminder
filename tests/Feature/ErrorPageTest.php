<?php

use App\Models\User;
use Illuminate\Support\Facades\Route;
use Inertia\Testing\AssertableInertia as Assert;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\get;
use function Pest\Laravel\withoutVite;

beforeEach(function () {
    withoutVite();
    config(['app.debug' => false]);

    Route::middleware('web')->get('/__test/{status}', fn (int $status) => abort($status));
});

it('エラー画面を返す', function (int $status) {
    get("/__test/{$status}")
        ->assertStatus($status)
        ->assertInertia(fn (Assert $page) => $page->component('error')->where('code', $status));
})->with([403, 404, 419, 500, 503]);

it('開発中はLaravelの画面のまま', function () {
    config(['app.debug' => true]);
    get('/__test/404')
        ->assertStatus(404)
        ->assertDontSee('"component":"error"', false);
});

it('入力ミスは今までどおり元の画面へ戻す', function () {
    config(['app.debug' => false]);

    actingAs(User::factory()->create())
        ->from(route('stocks.create'))
        ->post(route('stocks.store'), [])
        ->assertRedirect(route('stocks.create'))
        ->assertInvalid(['product_id']);
});
