# テストフレームワークの導入

自動テストを入れる計画である。
2026-09-12 時点でフロントエンドの実行環境（Vitest）だけを入れ、テスト本体はまだ1本も書いていない。

バックエンドは Pest 4 が `composer.json` に入っており、`composer test` から `artisan test` が走る状態になっている。
ただし中身は雛形の `ExampleTest` だけで、アプリの振る舞いは何も確かめていない。

## フロントエンドは Vitest にする

Jest ではなく Vitest を使う。
ビルドが Vite 8 で、ソースは TypeScript の ESM である。
Vitest なら `vite.config.ts` と同じ解決規則がそのまま効くが、Jest では transform と ESM 解決を別に組むことになる。

### 入れたもの

| パッケージ | 用途 |
|---|---|
| `vitest` | テストランナー |
| `@vitest/coverage-v8` | カバレッジ |
| `jsdom` | DOM の実行環境 |
| `@testing-library/react` | コンポーネントとフックの描画 |
| `@testing-library/user-event` | クリックや入力の再現 |
| `@testing-library/jest-dom` | `toBeInTheDocument` などのマッチャー |

### 設定

`vite.config.ts` は触らず、`vitest.config.ts` を別に置いた。
`laravel-vite-plugin` と `wayfinder` はビルド用で、テスト実行時に動かす必要がない。
エイリアス `@` は `tsconfig.json` の `paths` と合わせてある。

テストの置き場は対象ファイルの隣とし、`resources/js/**/*.test.ts(x)` を拾う。
共通の前処理は `resources/js/test/setup.ts` に置く。
ここで `@testing-library/jest-dom/vitest` を読み込み、各テストの後に `cleanup()` を呼ぶ。

`npm run test` で1回実行、`npm run test:watch` で監視する。
`docker compose exec -T laravel.test npm run test` で叩く。

テストが1本も無い間、`vitest run` は「No test files found」で終了コード1を返す。
最初のテストを書くまで `composer ci:check` には足さない。
足す場所は `composer.json` の `ci:check` で、`npm run types:check` の次に `npm run test` を入れる。

## フロントエンドの対象

### 優先度A（純粋なロジック）

| ファイル | 見るところ |
|---|---|
| `shared/lib/date.ts` | `isWithinDays` の境界（当日、7日後、過ぎた日付を含む）、各フォーマット |
| `features/stock/hooks/useStockForm.ts` | 編集時の初期値、カテゴリ変更で商品がクリアされる、消費日数の自動入力が手動編集後は上書きしない、送信値の型変換、予定日の空欄が `null` になる |
| `features/notification/hooks/usePushSubscription.ts` | `unsupported` / `denied` / `off` / `on` の判定、購読と解除でAPIが呼ばれる、`urlBase64ToUint8Array` |
| `features/admin/hooks/useCategoryFilter.ts` | トグルの追加と削除、`router.get` に渡すクエリ |

### 優先度B（画面）

要件で決めたことが直接載っている画面を先にする。

- `pages/dashboard.tsx` … カレンダーは全件、購入予定品は1週間以内という切り分け。件数表示。購入ボタン
- `pages/notifications.tsx` … 未読のみ表示、既読化とトーストの「元に戻す」、通知スイッチが無効になる条件
- `features/admin/components/ProductTable.tsx`、`CategoryManageDialog.tsx`、`PasswordChangeDialog.tsx`
- `shared/components/Pagination.tsx` … ページ番号の組み立て

画面のテストでは `@inertiajs/react` の `router` と `usePage` をモックする。

### 対象にしないもの

`resources/js/actions/`、`routes/`、`wayfinder/` は Wayfinder の生成物である。
`shared/components/ui/*` は shadcn 由来で、`.prettierignore` と eslint の `ignores` でも除いている。
`*/types.ts` と `app.tsx` も除く。

`features/*/api.ts` は `router.*` を呼ぶだけなので、単体では見ない。
呼び出し側のフックのテストからモックで確かめる。

## バックエンドの対象

### Unit（DBに触れない）

| ファイル | 見るところ |
|---|---|
| `Models/Stock.php` | `purchaseDateAfter` と `calculateNextPurchaseDate` |
| `Models/Product.php` | `initialConsumptionIntervalDays`（世帯人数が `null`、1以下、下限1、切り捨て） |
| `Support/LogContext.php` | web、admin、未ログインの分岐 |

### Feature（HTTP）

| 対象 | 見るところ |
|---|---|
| `StockController` | 同一商品の重複登録を弾く、他人のストックで403、`purchase` で予定日が進みストック数は変わらない、予定日の手動上書きと自動算出、`create` で登録済み商品を除外 |
| `DashboardController` | ストック数1を先頭にした並び順 |
| `NotificationLogController` | 未読のみ返す、既読化と未読への戻し、他人のログで403 |
| `PasswordResetController` | 仮パスワードの照合、期限切れ、未登録メールでも同じ応答、再設定後のトークン削除 |
| `Admin/ProductController`、`Admin/CategoryController` | CRUD、使用中は削除できない |
| `Admin/AuthController` | 管理者ログイン、一般ユーザーの資格情報では入れない |
| `ProfileController`、`PushSubscriptionController` | 更新できる項目、購読の登録と削除 |
| `Actions/Fortify/*` | `CreateNewUser`、`UpdateUserPassword`、`UpdateUserProfileInformation` の検証規則 |

### その他

`Console/Commands/SendPurchaseReminders.php` は、当日と予定日超過で文面が変わること、複数件の「ほかN件」、通知が例外を投げても履歴は作ること、ユーザー単位でまとまることを見る。

`Http/Middleware/LogRequest.php` は、パスワードなどのマスク（入れ子を含む）、除外パス、ステータスによるログレベルを見る。

### 対象にしないもの

`HandleInertiaRequests`、`Providers/*`、`Controller.php`、モデルのリレーション定義のみの箇所。

## Pest の手引き

以下は仕組みの確認だけを目的とした最小の例である。
`vendor/bin/sail` は AIエージェント向けの出力切り替えが入るため、人が叩くときはそのままでよい。

### 準備

1. `tests/Unit/ExampleTest.php` と `tests/Feature/ExampleTest.php` を削除する
2. `tests/Pest.php` を下記のとおり書き換える
3. ファクトリを足す（`Admin`、`Category`、`Product`、`Stock`、`NotificationLog`）
4. ファクトリを足したモデルに `HasFactory` トレイトを付ける。今付いているのは `User` だけである

テスト用のDB（`testing`）は Sail が pgsql コンテナの初期化時に作っている。
`phpunit.xml` が `DB_DATABASE=testing` を指すので、追加の設定は要らない。

### `tests/Pest.php`

```php
pest()->extend(TestCase::class)->in('Unit');

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');
```

`Unit` にも `TestCase::class` を付ける。
既定では素の PHPUnit のテストケースになり、アプリが起動しないため `now()` や `travelTo()` が使えない。

`RefreshDatabase` は `Feature` だけに付ける。
Unit に付けると、DBに触れないテストまで毎回マイグレーションを待つことになる。

### ファクトリ

`Stock` を例に挙げる。
他のモデルも同じ形で、参照先は `Model::factory()` をそのまま値に置ける。

```php
class StockFactory extends Factory
{
    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'product_id' => Product::factory(),
            'quantity' => 2,
            'consumption_interval_days' => 7,
            'next_purchase_date' => now()->addDays(14)->toDateString(),
        ];
    }
}
```

`products` と `categories` の `created_by` / `updated_by` は `admin` テーブルへの外部キーである。
どちらにも `Admin::factory()` を渡す必要がある。

### Unit の書き方

```php
it('次回購入予定日は消費日数とストック数を掛けた日数だけ先になる', function () {
    $this->travelTo(Carbon::parse('2026-09-12'));

    expect(Stock::purchaseDateAfter(7, 3))->toBe('2026-10-03');
});
```

`travelTo()` は `DateTimeInterface` を受けるので、文字列は `Carbon::parse()` を通す。

### Feature の書き方

```php
it('他人のストックは編集できない', function () {
    $stock = Stock::factory()->create();

    $this->actingAs(User::factory()->create())
        ->get(route('stocks.edit', $stock))
        ->assertForbidden();
});
```

ルートには名前が付いているので、URLを直に書かずに `route()` を使う。
所有者を指定したいときは `Stock::factory()->for($user)->create()` と書く。

検証の入り口は、リダイレクト先が `assertRedirect(route('stocks.index'))`、
入力エラーが `assertSessionHasErrors(['product_id' => '...'])`、
保存結果が `expect(Stock::firstOrFail())->...` である。

### コマンドと通知

```php
Notification::fake();

$this->artisan('app:send-purchase-reminders')->assertSuccessful();

Notification::assertSentTo($user, PurchaseReminder::class);
```

`NotificationLog` の `status` はモデル側で `NotificationStatus` にキャストされる。
比較する相手は `'unread'` ではなく `NotificationStatus::Unread` である。

### 実行

```
./vendor/bin/sail artisan test
./vendor/bin/sail artisan test --filter=Stock
```

`composer test` は pint と phpstan を通してから `artisan test` を走らせる。
書いている途中は `artisan test` を直に叩くほうが速い。

## 追記（2026-09-19）：Unit のひな形

準備（`ExampleTest` の削除、`tests/Pest.php`、ファクトリ5つ、`HasFactory`）が済んだ。
「バックエンドの対象」の Unit から `Stock` を例に、ひな形を置く。

置き場は `app/` の階層に合わせ、`tests/Unit/Models/` とする。

### モデルは `new` で作る

Unit では `RefreshDatabase` を付けていないので、マイグレーションが走らずテーブルが無い。
モデルは `new` に属性を渡して作る。

`Product::factory()->make()` は使えない。
`make()` は保存しないが、定義に置いた `Category::factory()` や `Admin::factory()` の側は `create()` して ID を取るので、DB に書き込みに行く。
`withoutParents()` を挟めば避けられるが、属性を2つ3つ渡すだけなら `new` のほうが短い。

### 時刻は `Pest\Laravel\travelTo()` で止める

`$this->travelTo()` でも動くが、エディタ（Intelephense）が `Undefined method 'travelTo'` を出す。
`it()` に渡すクロージャの `$this` は実行時に Pest が `Tests\TestCase` へ差し替えるもので、静的に読むだけでは型が分からないためである。

`pest-plugin-laravel` の関数版は中で `test()->travelTo()` を呼ぶだけで、動きは変わらない。
`actingAs()` など `$this` から呼ぶ他のメソッドにも、同じ名前の関数がある。

### `tests/Unit/Models/StockTest.php`

```php
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
```

## 追記（2026-09-23）：`Actions/Fortify/*` は Feature で見る

「バックエンドの対象 > Feature（HTTP）」の表に挙げた `Actions/Fortify/*` は、単体では書かない。

`UpdateUserProfileInformation` と `UpdateUserPassword` は `ProfileController` が呼ぶ経路がそのまま検証になっている。
`tests/Feature/ProfileControllerTest.php` で名前と世帯人数の更新、現在のパスワードの照合、失敗時の巻き戻しまで見ているため、
同じ検証規則を単体で書き直しても内容が重複する。

残る2つは、結線ごと確かめられるHTTPの入口から見る。

| ファイル | 見るところ |
|---|---|
| `tests/Feature/RegistrationTest.php` | 登録できる、メールの重複を弾く、パスワードが確認と一致しないと弾く |
| `tests/Feature/LoginTest.php` | ログインできる、失敗時に `auth_error` へ日本語のメッセージが入る |

`CreateNewUser` は `Fortify::createUsersUsing()` で、`AttemptToAuthenticate` は認証パイプラインで結ばれている。
クラスを直接呼ぶと、この結線が外れても気づけない。

`PasswordValidationRules` は `CreateNewUser` と `UpdateUserPassword` が使うルールの定義で、両者のテストから間接的に通る。
