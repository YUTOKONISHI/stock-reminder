<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreStockRequest;
use App\Http\Requests\UpdateStockRequest;
use App\Models\Product;
use App\Models\Stock;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class StockController extends Controller
{
    public function index(): Response
    {
        $stocks = Stock::with('product.category')->where('user_id', Auth::id())->orderBy('next_purchase_date', 'asc')->paginate(20);

        return Inertia::render('stocks/index', [
            'stocks' => $stocks,
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('stocks/form', [
            'products' => $this->productsForForm(excludeOwned: true),
            'stock' => null,
        ]);
    }

    public function edit(Stock $stock): Response
    {
        abort_if($stock->user_id !== Auth::id(), 403);

        return Inertia::render('stocks/form', [
            'products' => $this->productsForForm(excludeOwned: false),
            'stock' => $stock->load('product.category'),
        ]);
    }

    public function store(StoreStockRequest $request): RedirectResponse
    {
        Stock::create([
            ...$request->validated(),
            'user_id' => Auth::id(),
            'next_purchase_date' => $this->resolveNextPurchaseDate($request),
        ]);

        return to_route('stocks.index');
    }

    public function update(UpdateStockRequest $request, Stock $stock): RedirectResponse
    {
        abort_if($stock->user_id !== Auth::id(), 403);

        $stock->update([
            ...$request->validated(),
            'next_purchase_date' => $this->resolveNextPurchaseDate($request),
        ]);

        return to_route('stocks.index');
    }

    public function destroy(Stock $stock): RedirectResponse
    {
        abort_if($stock->user_id !== Auth::id(), 403);

        $stock->delete();

        return to_route('stocks.index');
    }

    public function purchase(Stock $stock): RedirectResponse
    {
        abort_if($stock->user_id !== Auth::id(), 403);

        $stock->update([
            'next_purchase_date' => $stock->calculateNextPurchaseDate(),
        ]);

        return to_route('dashboard');
    }

    /**
     * 次回購入予定日を決める。
     *
     * 入力があればそれを使う（要件どおり手動で上書きできる）。
     * 空欄なら「最終更新日 + 消費日数 × ストック数」で算出する。
     * 保存した時点が最終更新日になる。
     */
    private function resolveNextPurchaseDate(Request $request): string
    {
        if ($request->filled('next_purchase_date')) {
            return $request->date('next_purchase_date')->toDateString();
        }

        return Stock::purchaseDateAfter(
            (int) $request->consumption_interval_days,
            (int) $request->quantity,
        );
    }

    /**
     * ストック設定画面に渡す商品一覧を組み立てる。
     *
     * 消費日数の初期値はここで世帯人数の補正を掛ける。保存時（store / update）に
     * 届く値は補正済みか手で書き換えた値なので除算不要
     *
     * @return Collection<int, Product>
     */
    private function productsForForm(bool $excludeOwned): Collection
    {
        /** @var User|null $user */
        $user = Auth::guard('web')->user();
        $householdSize = $user?->household_size;

        return Product::with('category')
            ->when($excludeOwned, fn ($query) => $query->whereNotIn(
                'id',
                Stock::where('user_id', Auth::id())->pluck('product_id'),
            ))
            ->orderBy('name', 'asc')
            ->get()
            ->each(fn (Product $product) => $product->setAttribute(
                'initial_consumption_interval_days',
                $product->initialConsumptionIntervalDays($householdSize),
            ));
    }
}
