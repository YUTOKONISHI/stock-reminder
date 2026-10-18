<?php

use App\Models\Admin;
use App\Models\Category;
use App\Models\Product;
use App\Models\Stock;
use Inertia\Testing\AssertableInertia as Assert;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\assertDatabaseMissing;
use function Pest\Laravel\delete;
use function Pest\Laravel\get;
use function Pest\Laravel\post;
use function Pest\Laravel\put;

beforeEach(function () {
    actingAs(Admin::factory()->create(), 'admin');
});

describe('index', function () {
    it('商品とカテゴリの一覧を返す', function () {
        $daily = Category::factory()->create(['name' => '日用品']);
        $food = Category::factory()->create(['name' => '食品']);
        Product::factory()->count(2)->create(['category_id' => $daily->id]);
        Product::factory()->create(['category_id' => $food->id]);

        get(route('admin.dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/dashboard')
                ->has('products.data', 3)
                ->has('categories', 2)
                ->where('categories.0.products_count', 2)
                ->where('categories.1.products_count', 1)
                ->where('selectedCategories', [$daily->id, $food->id]));
    });

    it('カテゴリで絞り込む', function () {
        $daily = Category::factory()->create(['name' => '日用品']);
        $food = Category::factory()->create(['name' => '食品']);
        Product::factory()->count(2)->create(['category_id' => $daily->id]);
        Product::factory()->create(['category_id' => $food->id]);

        get(route('admin.dashboard', ['categories' => $daily->id]))
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/dashboard')
                ->has('products.data', 2)
                ->has('categories', 2)
                ->where('categories.0.products_count', 2)
                ->where('categories.1.products_count', 1)
                ->where('selectedCategories', [$daily->id]));
    });

    it('categoriesが空なら1件も返さない', function () {
        $daily = Category::factory()->create(['name' => '日用品']);
        $food = Category::factory()->create(['name' => '食品']);
        Product::factory()->count(2)->create(['category_id' => $daily->id]);
        Product::factory()->create(['category_id' => $food->id]);

        get(route('admin.dashboard', ['categories' => '']))
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/dashboard')
                ->has('products.data', 0)
                ->has('categories', 2)
                ->where('categories.0.products_count', 2)
                ->where('categories.1.products_count', 1)
                ->where('selectedCategories', []));
    });
});

describe('store', function () {
    it('商品を登録する', function () {
        $daily = Category::factory()->create(['name' => '日用品']);

        post(route('admin.products.store'), [
            'name' => 'トイレットペーパー',
            'category_id' => $daily->id,
            'default_consumption_interval_days' => 14,
        ])
            ->assertValid()
            ->assertRedirectBack();

        assertDatabaseHas('products', [
            'name' => 'トイレットペーパー',
            'category_id' => $daily->id,
            'default_consumption_interval_days' => 14,
        ]);
    });

    it('登録した管理者を created_by と updated_by に残す', function () {
        $daily = Category::factory()->create(['name' => '日用品']);

        post(route('admin.products.store'), [
            'name' => 'トイレットペーパー',
            'category_id' => $daily->id,
            'default_consumption_interval_days' => 14,
        ])
            ->assertValid()
            ->assertRedirectBack();

        assertDatabaseHas('products', [
            'created_by' => Auth::guard('admin')->id(),
            'updated_by' => Auth::guard('admin')->id(),
        ]);
    });

    it('入力が欠けていれば弾く', function () {
        post(route('admin.products.store'), [])
            ->assertInvalid([
                'name' => '名前を入力してください。',
                'category_id' => 'カテゴリを入力してください。',
                'default_consumption_interval_days' => '消費間隔を入力してください。',
            ]);
    });
});

describe('update', function () {
    it('商品を更新し、updated_by を書き換える', function () {
        $daily = Category::factory()->create(['name' => '日用品']);
        $product = Product::factory()->create([
            'name' => 'トイレットペーパー',
            'category_id' => $daily->id,
            'default_consumption_interval_days' => 14,
        ]);
        put(route('admin.products.update', $product), [
            'name' => 'トイレットペーパー',
            'category_id' => $daily->id,
            'default_consumption_interval_days' => 7,
        ])
            ->assertValid()
            ->assertRedirectBack();

        assertDatabaseHas('products', [
            'name' => 'トイレットペーパー',
            'category_id' => $daily->id,
            'default_consumption_interval_days' => 7,
            'created_by' => $product->created_by,
            'updated_by' => Auth::guard('admin')->id(),
        ]);
    });

    it('入力が欠けていれば弾く', function () {
        $daily = Category::factory()->create(['name' => '日用品']);
        $product = Product::factory()->create([
            'name' => 'トイレットペーパー',
            'category_id' => $daily->id,
            'default_consumption_interval_days' => 14,
        ]);
        put(route('admin.products.update', $product), [])
            ->assertInvalid([
                'name' => '名前を入力してください。',
                'category_id' => 'カテゴリを入力してください。',
                'default_consumption_interval_days' => '消費間隔を入力してください。',
            ]);
    });
});

describe('destroy', function () {
    it('使われていない商品は削除できる', function () {
        $daily = Category::factory()->create(['name' => '日用品']);
        $product = Product::factory()->create([
            'name' => 'トイレットペーパー',
            'category_id' => $daily->id,
            'default_consumption_interval_days' => 14,
        ]);
        delete(route('admin.products.destroy', $product))
            ->assertRedirectBack();

        assertDatabaseMissing('products', ['id' => $product->id]);
    });

    it('利用者のストックにある商品は削除できない', function () {
        $daily = Category::factory()->create(['name' => '日用品']);
        $product = Product::factory()->create([
            'name' => 'トイレットペーパー',
            'category_id' => $daily->id,
            'default_consumption_interval_days' => 14,
        ]);
        Stock::factory()->create(['product_id' => $product->id]);
        delete(route('admin.products.destroy', $product))
            ->assertInvalid(['delete' => 'この商品は利用者のストックに登録されているため削除できません'])
            ->assertRedirectBack();

        assertDatabaseHas('products', ['id' => $product->id]);
    });
});

describe('未ログイン', function () {
    it('操作するとログイン画面へ送られる', function () {
        $daily = Category::factory()->create(['name' => '日用品']);
        $food = Category::factory()->create(['name' => '食品']);
        $product = Product::factory()->create([
            'name' => 'トイレットペーパー',
            'category_id' => $daily->id,
            'default_consumption_interval_days' => 14,
        ]);
        Auth::guard('admin')->logout();

        post(route('admin.products.store'), [
            'name' => '卵',
            'category_id' => $food->id,
            'default_consumption_interval_days' => 14,
        ])
            ->assertRedirect(route('admin.login'));

        put(route('admin.products.update', $product), [
            'name' => $product->name,
            'category_id' => $daily->id,
            'default_consumption_interval_days' => 7,
        ])
            ->assertRedirect(route('admin.login'));

        delete(route('admin.products.destroy', $product))
            ->assertRedirect(route('admin.login'));

        assertDatabaseMissing('products', ['name' => '卵']);
        assertDatabaseHas('products', ['id' => $product->id, 'default_consumption_interval_days' => 14]);
    });
});
