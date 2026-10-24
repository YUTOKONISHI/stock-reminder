# 管理者向けのマスタ管理

管理者の操作は `/admin/dashboard` の1画面に収まる。
商品とカテゴリの追加、編集、削除、およびパスワード変更をここから行う。
追加と編集はモーダルで、専用の URL を持たない。

認証は `admin` ガードのセッションで、詳しくは [auth.md](auth.md) にある。

## 画面の構成

`admin/dashboard` は次の部品でできている。

| 部品 | 役割 |
|---|---|
| `AdminHeader` | カテゴリ管理とパスワード変更のモーダルを開く。ログアウト |
| `CategorySidebar` | カテゴリの一覧と、商品一覧の絞り込み |
| `ProductTable` | 商品の一覧、追加、編集、削除 |
| `CategoryManageDialog` | カテゴリの追加、編集、削除 |
| `PasswordChangeDialog` | 管理者パスワードの変更 |

レスポンシブ対応の対象外である。

## 商品一覧

`ProductController::index` が返す。

| props | 中身 |
|---|---|
| `products` | 商品を作成日の新しい順に50件ずつ。各行に紐づくストック数（`stocks_count`）を伴う |
| `categories` | カテゴリを名前順に全件。各行に属する商品数（`products_count`）を伴う |
| `selectedCategories` | 絞り込みで選ばれているカテゴリのID |

### カテゴリでの絞り込み

サイドバーのチェックを切り替えると、選択中のIDをカンマ区切りにした `categories` クエリを付けて同じ画面を取り直す。
絞り込みはサーバ側で行う。
ページ送りがあるため、受け取った1ページ分だけを画面側で絞ると、次のページにある該当商品が漏れる。

クエリの有無で意味を分ける。

| `categories` | 意味 | 返す商品 |
|---|---|---|
| 無し | 絞り込み前 | 全件。`selectedCategories` は全カテゴリのID |
| 空文字 | すべてのチェックを外した状態 | 0件 |
| `1,3` | そのカテゴリだけ | 該当するもの |

ページ送りのリンクにはクエリを引き継ぐ。

## 商品のCRUD

| 操作 | ルート |
|---|---|
| 追加 | `POST /admin/products` |
| 更新 | `PUT /admin/products/{product}` |
| 削除 | `DELETE /admin/products/{product}` |

追加と更新の検証は共通である。

| 入力 | 検証 |
|---|---|
| `name` | 必須、255文字以内 |
| `category_id` | 必須、`categories` に存在 |
| `default_consumption_interval_days` | 必須、1以上の整数 |

追加では `created_by` と `updated_by` に、更新では `updated_by` に、操作した管理者のIDを入れる。

削除は、その商品を登録しているストックが1件でもあれば拒む。
画面には `delete` キーで「この商品は利用者のストックに登録されているため削除できません」を返す。

## カテゴリのCRUD

| 操作 | ルート |
|---|---|
| 追加 | `POST /admin/categories` |
| 更新 | `PUT /admin/categories/{category}` |
| 削除 | `DELETE /admin/categories/{category}` |

| 入力 | 検証 |
|---|---|
| `name` | 必須、255文字以内、`categories` の中で一意（更新では自身を除く） |

作成者と更新者の記録は商品と同じである。

削除は、そのカテゴリに属する商品が1件でもあれば拒む。
画面には `delete` キーで「このカテゴリは商品に登録されているため削除できません」を返す。

## パスワード変更

`POST /admin/password`。
モーダルから現在のパスワード、新しいパスワード、確認入力を送る。

| 入力 | 検証 |
|---|---|
| `current_password` | 必須、`admin` ガードの現在のパスワードと一致 |
| `password` | 必須、パスワード規則（[auth.md](auth.md)）、確認入力と一致 |

確認入力の不一致は画面側でも先に見て、サーバに送らずにエラーを出す。
サーバから返ったエラーは項目ごとに欄の下に出す。
成功すると「パスワードを変更しました」のトーストを出してモーダルを閉じる。

## 管理者の作成

管理者を作る画面は無い。
`php artisan app:create-admin {name=admin}` で作る。
パスワードは入力を伏せたプロンプトで2回受け取り、`Password::default()` と確認の一致を検証する。
同じ名前の管理者がいれば作らない。

カテゴリと商品のシーダーは、名前が `admin` の管理者を `created_by` に入れるので、先に作っておく。
本番では `AdminSeeder` を流さない（パスワードが `password` になる）。
