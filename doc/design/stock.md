# ストック管理とダッシュボード

## 用語

- **消費日数**：ストック1つを使い切るまでの日数。`stocks.consumption_interval_days`
- **ストック数**：手元にある個数。`stocks.quantity`
- **次回購入予定日**：`stocks.next_purchase_date`

次回購入予定日は「最終更新日 + 消費日数 × ストック数」で決まる。
算出は `Stock::purchaseDateAfter` にあり、保存した時点を起点とする。

## ストック一覧

`GET /app/stocks`（`StockController::index`）。

ログイン中の利用者のストックを、次回購入予定日の早い順に20件ずつ返す。
商品とそのカテゴリを一緒に読み込む。

一覧の各行は商品名、次回購入予定日、ストック数を出し、行そのものが編集画面への導線になる。
ページ送りは `shared/components/Pagination.tsx` が描く。

## ストックの登録

`GET /app/stocks/create`（`StockController::create`）で画面を出し、`POST /app/stocks`（`store`）で保存する。

### 画面に渡す商品一覧

`productsForForm` が商品一覧を組み立てる。
登録画面では、既にその利用者が登録済みの商品を候補から除く。
同じ商品を重ねて登録できないためである。

各商品には `initial_consumption_interval_days` を付ける。
これはマスタの `default_consumption_interval_days` を世帯人数で割った値である。

```
初期値 = max(1, floor(既定の消費日数 ÷ 世帯人数))
```

世帯人数が未設定、または1のときは割らない。
世帯人数が増えれば1つを使い切る日数は短くなる、という考え方に従う。

この補正を掛けるのは画面に出す初期値だけである。
保存時に届く値は、補正済みか利用者が書き換えた値なので、サーバ側では割らない。

### 入力と検証

| 入力 | 検証 |
|---|---|
| `product_id` | 必須、`products` に存在、その利用者のストックとして未登録 |
| `quantity` | 必須、1以上の整数 |
| `consumption_interval_days` | 必須、1以上の整数 |
| `next_purchase_date` | 任意、`YYYY-MM-DD` |

重複したときのエラーは「この商品は既に登録されています」を返す。
DB 側にも `(user_id, product_id)` の一意制約がある。

`next_purchase_date` が空欄なら「今日 + 消費日数 × ストック数」で埋める。
値が入っていればそれをそのまま使う（手動での上書き）。

### 画面側の組み立て

登録と編集は `stocks/form` の1つのページ部品で、状態は `useStockForm` が持つ。

商品はカテゴリで絞ってから選ぶ。
カテゴリの一覧は、サーバから来た商品一覧の `category` を重複を除いて集めたもので、別の props としては受け取らない。
カテゴリを変えると選択中の商品は空に戻る。

商品を選ぶと消費日数の欄にその商品の初期値が入る。
ただし利用者が消費日数を一度でも触っていれば、上書きしない。

## ストックの編集と削除

`GET /app/stocks/{stock}/edit`（`edit`）、`PUT /app/stocks/{stock}`（`update`）、`DELETE /app/stocks/{stock}`（`destroy`）。

編集では商品を変更できない。
検証の対象は `quantity`、`consumption_interval_days`、`next_purchase_date` の3つで、`product_id` は受け取らない。
編集画面に渡す商品一覧は、登録済みを除かない。
選択中の商品を表示するためである。

削除はブラウザの確認ダイアログを挟む。

`edit`、`update`、`destroy`、`purchase` はいずれも、対象のストックの `user_id` がログイン中の利用者と違えば 403 を返す。

## ダッシュボード

`GET /app/dashboard`（`DashboardController::index`）。

### サーバが返すもの

ログイン中の利用者のストックを全件、次の順で返す。

1. ストック数が1のものを先に
2. その中と残りを、それぞれ次回購入予定日の早い順に

ストック数の昇順にはしない。
残りが多くても購入予定日が近いものを先に出すためである。

絞り込みはサーバでは掛けない。
全件を返し、画面側で用途ごとに絞る。

### 画面の構成

| 表示 | 対象 |
|---|---|
| カレンダー（月単位） | 全件。予定日の枠を出す |
| 次回購入日 | 全件のうち最も早い予定日 |
| 購入予定品の一覧と件数 | 1週間以内に予定日が来るもの。購入後に外すものを除く（下記） |
| 今日の購入予定の件数 | 予定日が今日のもの |

1週間の判定は `isWithinDays(value, 7)` で、今日から7日後までを含む。
過ぎた日付も含む。
比較は `YYYY-MM-DD` の文字列同士で行う。

`last_purchased_on` から `next_purchase_date` までが7日以内のものは、予定日の前日まで購入予定品から外す（`isHiddenAfterPurchase`）。
購入しても1週間以内に予定日が来るので、外さないと押した後も一覧に残る。

カレンダーの枠は `::before` の擬似要素で描く。
今日を表す丸と重なったときに、枠が丸に引きずられないようにするためである。

### 購入済みの記録

購入予定品の各カードにある買い物かごのボタンから `PATCH /app/stocks/{stock}/purchase`（`StockController::purchase`）を呼ぶ。

次回購入予定日を「今日 + 消費日数 × ストック数」に進め、`last_purchased_on` に今日を入れる。
ストック数は変えない。
編集（`update`）では `last_purchased_on` を NULL に戻す。
処理のあとダッシュボードに戻る。

Push通知が止まるのはこの操作だけである。
通知履歴を既読にしても、次回購入予定日は動かない。
