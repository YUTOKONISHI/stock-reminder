# コードレビューの指摘への対応

GitHub Issue #3（Step 24 Review）でコードレビューを受けた。
改善推奨が3点、提案が2点で、いずれも必須ではないという評価だった。

本書は改善推奨の3点を対象とする。
提案の自動テストは `20260912-testing-framework.md` が引き受け、ダッシュボードの全件取得は見送る。

## FormRequest への分離

バリデーションルールがコントローラの `store` と `update` に二重に書かれている。
`Admin/ProductController` は3ルールが完全に一致し、`Admin/CategoryController` は `unique` の `ignore` だけが違う。
`StockController` は `update` に `product_id` が無いため、重なるのは残り3ルールである。

指摘のとおり FormRequest に切り出す。
アクションごとに1クラスとし、置き場はコントローラの階層に合わせる。

| クラス | 呼び出し元 |
|---|---|
| `App\Http\Requests\StoreStockRequest` | `StockController::store` |
| `App\Http\Requests\UpdateStockRequest` | `StockController::update` |
| `App\Http\Requests\Admin\StoreProductRequest` | `Admin\ProductController::store` |
| `App\Http\Requests\Admin\UpdateProductRequest` | `Admin\ProductController::update` |
| `App\Http\Requests\Admin\StoreCategoryRequest` | `Admin\CategoryController::store` |
| `App\Http\Requests\Admin\UpdateCategoryRequest` | `Admin\CategoryController::update` |

`make:request` の雛形は `authorize()` が `false` を返す。
生成したまま置くと全リクエストが403になるので、6クラスすべてでメソッドごと削除する。
`FormRequest::passesAuthorization()` は `method_exists()` で存在を見てから呼ぶので、メソッドが無ければ `true` になる。

`StoreStockRequest` は `messages()` を持つ。
現在 `validate()` の第2引数にある「この商品は既に登録されています」をそこへ移す。

`UpdateCategoryRequest` の除外対象は `$this->route('category')` から取る。
ルートモデル結合で `Category` が入るため、`Rule::unique('categories')->ignore($this->route('category'))` と書ける。

コントローラ側は `$request->validated()` を使う。
`Stock::create()` は `user_id` と `next_purchase_date` を足すので、展開したうえで2つを重ねる。

`resolveNextPurchaseDate()` の引数の型は `Request` のままでよい。
`FormRequest` がその子クラスであり、中で使う `filled()` と `date()` はどちらも親にある。

### 残る重複

Stock の `quantity`、`consumption_interval_days`、`next_purchase_date` の3ルールは、`Store` と `Update` の両方に載る。
リソースごとに1クラスにまとめ、`$this->route('stock')` の有無で `product_id` を出し分ければ1箇所に収まるが、その形は採らない。
レビューが示した例が `StoreStockRequest` であり、アクションごとに分ける形に揃える。

### 認可は移さない

レビューは `authorize()` に認可を寄せる案も挙げていた。
採らない。

所有者の判定は `StockController` の `edit`、`update`、`destroy`、`purchase` の4箇所にあるが、FormRequest を受け取るのは `update` だけである。
1箇所だけ移すと判定の置き場が `authorize()` と `abort_if` の2種類になり、どちらを見ればよいか分からなくなる。
まとめるなら `StockPolicy` に寄せる形になり、これはレビューの指摘の範囲を超えるので別に扱う。

## `ProfileController` の入力を絞る

`update` は `$request->all()` を Fortify のアクションへ渡している。
今は渡した先の `UpdateUserProfileInformation` が `forceFill()` でカラムを明示しているため実害は無いが、守りが受け取る側だけにある。

コントローラの時点で `only()` に絞る。

```php
$input = $request->only([
    'name',
    'household_size',
    'current_password',
    'password',
    'password_confirmation',
]);
```

キーが5つあるのは、渡し先が2つあるためである。
`UpdateUserProfileInformation` が `name` と `household_size` を、`UpdateUserPassword` が残り3つを見る。

`$request->filled('password')` の判定は `$request` のままでよい。
絞り込みは渡す値だけに掛ける。

## リクエストログのメールアドレス

`LogRequest` は `$request->all()` を全パスで記録するため、`email` が平文で残る。
ログイン、新規登録、パスワード忘却の3画面が該当する。

`FILTERED_KEYS` に `email` を足す。
定数は1箇所にあり、入れ子の配列も再帰でたどるので、追加はこの1行で済む。

`doc/design/non-functional.md` の「入力の伏せ字」に鍵の一覧が書いてあるので、同時に直す。

追跡への影響は小さい。
ログイン後のリクエストは `LogContext::actor()` が `user_id` と `guard` を残すため、誰の操作かは分かる。
ログイン失敗だけは主体が消えるが、`ip`、`path`、`status` は残る。

### 許可リスト方式を採らない理由

レビューは、残すキーを許可リストで選ぶ方式も挙げていた。
採らない。

`input` に何が来るかは画面ごとに違うため、フォームに項目を足すたびに許可リストを直すことになる。
直し忘れたときに起きるのは「ログに何も残らない」であり、伏せ字の追加で直し忘れたときの「個人情報が残る」に比べれば軽いが、更新の手間が画面の数だけ増える。
伏せたい鍵は現状 `email` の1つで、増える見込みも薄い。

## 対応しないもの

### ダッシュボードの全件取得

`DashboardController::index` は `get()` で本人のストックを全件取る。
レビューは表示件数の上限や「近い予定だけ表示」を提案していたが、絞り込むと壊れるものがある。

画面は受け取った配列を4通りに使っている。

| 用途 | 必要な範囲 |
|---|---|
| カレンダーの枠 | 全件。要件定義書が「絞り込みは掛けない」と決めている |
| 次回購入日 | 全件の最小値 |
| 購入予定品の一覧 | 1週間以内 |
| 期限超過の警告 | 予定日を過ぎた全件 |

上限を入れるとカレンダーに穴が空き、次回購入日もずれる。

件数は商品マスタの件数で頭打ちになる。
同じ商品を重ねて登録できないため、1ユーザーが持てるストックは商品の総数を超えない。
数百件が現実になるのはマスタがその規模になったときで、そのときはマスタ側の設計から見直すことになる。

### 自動テスト

`20260912-testing-framework.md` に対象と書き方をまとめてある。
レビューが例に挙げた「他人のストックは操作できない」「期限切れの仮パスワードでは再設定できない」「存在しないメールでも同じ応答が返る」の3つは、いずれもその計画の Feature の表に入っている。
`RefreshDatabase` を `Feature` だけに付けることも決めてある。
残っているのは実装であり、本書では扱わない。

## 追記（2026-09-13）：認可を `StockPolicy` に移す

「認可は移さない」で見送った所有者の判定を、`authorize()` ではなく Policy に移す。
`authorize()` を採らない理由は変わっていない。
FormRequest を受け取るのは `update` だけで、残る3メソッドに `abort_if` が残るためである。

FormRequest への分離が終わり、6クラスとコントローラ3つが揃ったので、次の段として扱う。

### `StockPolicy`

`app/Policies/StockPolicy.php` を作る。
`Gate::guessPolicyName()` が `App\Models\Stock` から `App\Policies\StockPolicy` を導くので、登録は要らない。
本プロジェクトは `guessPolicyNamesUsing()` を差し替えていない。

能力は4つで、いずれも `$stock->user_id === $user->id` を返す。

| 能力 | 当てるメソッド |
|---|---|
| `view` | `edit` |
| `update` | `update` |
| `delete` | `destroy` |
| `purchase` | `purchase` |

`purchase` は Laravel の標準の能力名に無い。
購入の記録と編集は画面も操作も別なので、`update` にまとめず独自の名前を足す。
将来どちらかの条件だけが変わったときに、片方を直すと両方が動く状態を避ける。

`edit` に `view` を当てるのは、編集画面の表示と保存を別の能力として残すためである。
`update` にまとめて3つに減らす形もあるが、読む権限と書く権限が同じ名前になる。

### コントローラ

`StockController` の `abort_if` 4行を `Gate::authorize()` に置き換える。

```php
Gate::authorize('view', $stock);
```

`Illuminate\Support\Facades\Gate` を import する。
`$this->authorize()` は使えない。
抽象 `Controller` は空で、`AuthorizesRequests` トレイトを使っていない。

`Auth` の import は残る。
`store()` の `'user_id' => Auth::id()` と `productsForForm()` が使っている。

応答は変わらない。
`Gate::authorize()` が投げる `AuthorizationException` を例外ハンドラが403に変換するので、`abort_if(..., 403)` と同じステータスになる。

### ルートに寄せる案を採らない理由

`->can('view', 'stock')` をルート定義に付ければ、コントローラから判定が消える。
採らない。
コントローラを読んだだけで認可の有無が分からなくなる。

### `NotificationLogController`

同じ比較が `updateStatus()` にもある。
本書では触らない。

`markAsRead` と `markAsUnread` がこの private メソッドを共有していて、比較は既に1箇所にまとまっている。
`Stock` の4箇所のような重複が無い。

### `Admin` 側を触らない理由

`admin` ガードで守られており、レコード単位の所有者判定が無い。
商品とカテゴリは全管理者が共有する。

### 確認

`edit`、`update`、`destroy`、`purchase` の4経路について、他人のストックのIDを指定して403になることを見る。
自分のストックで操作が通ることもあわせて見る。
`20260912-testing-framework.md` の Feature の表にある「他人のストックで403」が、そのままこの確認に当たる。
