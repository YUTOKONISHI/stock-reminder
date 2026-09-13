<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreProductRequest;
use App\Http\Requests\Admin\UpdateProductRequest;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class ProductController extends Controller
{
    public function index(Request $request): Response
    {
        // categories が無いときは絞り込み前、空のときは全てのチェックを外した状態を表す。
        $selected = $request->has('categories')
            ? array_filter(array_map('intval', explode(',', (string) $request->query('categories'))))
            : null;

        $products = Product::withCount('stocks')
            ->when($selected !== null, fn ($query) => $query->whereIn('category_id', $selected ?? []))
            ->orderBy('created_at', 'desc')
            ->paginate(50)
            ->withQueryString();

        $categories = Category::withCount('products')->orderBy('name', 'asc')->get();

        return Inertia::render('admin/dashboard', [
            'products' => $products,
            'categories' => $categories,
            'selectedCategories' => $selected ?? $categories->pluck('id'),
        ]);
    }

    public function store(StoreProductRequest $request): RedirectResponse
    {
        Product::create([
            ...$request->validated(),
            'created_by' => Auth::guard('admin')->id(),
            'updated_by' => Auth::guard('admin')->id(),
        ]);

        return back();
    }

    public function update(UpdateProductRequest $request, Product $product): RedirectResponse
    {
        $product->update([
            ...$request->validated(),
            'updated_by' => Auth::guard('admin')->id(),
        ]);

        return back();
    }

    public function destroy(Product $product): RedirectResponse
    {
        if ($product->stocks()->exists()) {
            return back()->withErrors(['delete' => 'この商品は利用者のストックに登録されているため削除できません']);
        }

        $product->delete();

        return back();
    }
}
