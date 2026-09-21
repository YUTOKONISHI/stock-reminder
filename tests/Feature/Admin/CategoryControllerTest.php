<?php

use App\Models\Admin;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Support\Facades\Auth;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\assertDatabaseMissing;
use function Pest\Laravel\delete;
use function Pest\Laravel\post;
use function Pest\Laravel\put;

beforeEach(function () {
    actingAs(Admin::factory()->create(), 'admin');
});

describe('store', function () {
    it('カテゴリを登録する', function () {
        post(route('admin.categories.store'), [
            'name' => '日用品',
        ])
            ->assertValid()
            ->assertRedirectBack();

        assertDatabaseHas('categories', [
            'name' => '日用品',
            'created_by' => Auth::guard('admin')->id(),
            'updated_by' => Auth::guard('admin')->id(),
        ]);
    });

    it('同じ名前は登録できない', function () {
        $category = Category::factory()->create(['name' => '日用品']);

        post(route('admin.categories.store'), [
            'name' => $category->name,
        ])
            ->assertInvalid(['name' => 'その名前は既に使われています。'])
            ->assertRedirectBack();
    });
});

describe('update', function () {
    it('カテゴリ名を更新する', function () {
        $category = Category::factory()->create(['name' => '日用品']);

        put(route('admin.categories.update', $category), [
            'name' => '日用品2',
        ])
            ->assertValid()
            ->assertRedirectBack();

        assertDatabaseHas('categories', [
            'id' => $category->id,
            'name' => '日用品2',
            'created_by' => $category->created_by,
            'updated_by' => Auth::guard('admin')->id(),
        ]);
    });

    it('名前を変えずに保存できる', function () {
        $category = Category::factory()->create(['name' => '日用品']);

        put(route('admin.categories.update', $category), [
            'name' => '日用品',
        ])
            ->assertValid()
            ->assertRedirectBack();
    });

    it('他のカテゴリと同じ名前には変えられない', function () {
        $category = Category::factory()->create(['name' => '日用品']);
        Category::factory()->create(['name' => '食品']);

        put(route('admin.categories.update', $category), [
            'name' => '食品',
        ])
            ->assertInvalid(['name' => 'その名前は既に使われています。'])
            ->assertRedirectBack();
    });
});

describe('destroy', function () {
    it('商品が無いカテゴリは削除できる', function () {
        $category = Category::factory()->create(['name' => '日用品']);

        delete(route('admin.categories.destroy', $category))
            ->assertValid()
            ->assertRedirectBack();

        assertDatabaseMissing('categories', ['id' => $category->id]);
    });

    it('商品があるカテゴリは削除できない', function () {
        $category = Category::factory()->create(['name' => '日用品']);
        Product::factory()->create(['category_id' => $category->id]);

        delete(route('admin.categories.destroy', $category))
            ->assertInvalid(['delete' => 'このカテゴリは商品に登録されているため削除できません'])
            ->assertRedirectBack();

        assertDatabaseHas('categories', ['id' => $category->id]);
    });
});

describe('未ログイン', function () {
    it('操作するとログイン画面へ送られる', function () {
        $category = Category::factory()->create(['name' => '日用品']);

        Auth::guard('admin')->logout();

        post(route('admin.categories.store'), ['name' => '食品'])
            ->assertRedirect(route('admin.login'));

        put(route('admin.categories.update', $category), ['name' => '食品'])
            ->assertRedirect(route('admin.login'));

        delete(route('admin.categories.destroy', $category))
            ->assertRedirect(route('admin.login'));

        assertDatabaseMissing('categories', ['name' => '食品']);
        assertDatabaseHas('categories', ['id' => $category->id, 'name' => '日用品']);
    });
});
