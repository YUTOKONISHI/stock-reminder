# データ設計

PostgreSQL を使う。
図の正本は drawSQL 側にあり、エクスポートは `doc/specifications/drawSQL-pgsql-export-2026-11-04.sql` に置く。
本書はマイグレーションから起こした列の一覧である。

日時列はすべて `timestamptz` で持つ。日付だけの値は `date` で持つ。
タイムゾーンの扱いは [non-functional.md](non-functional.md) にある。

## 関連

```
admin ──┬─< categories ──< products ──< stocks >── users ──< notification_logs
        └─< (created_by / updated_by)                  └──< push_subscriptions
```

- 1人の利用者は複数のストックを持ち、1つのストックは1つの商品を指す
- 同じ利用者が同じ商品を2回登録することはできない（`stocks` の複合一意制約）
- 商品は1つのカテゴリに属する
- カテゴリと商品には、作成した管理者と最後に更新した管理者を記録する

## 業務テーブル

### users（利用者）

| 列 | 型 | 制約 | 備考 |
|---|---|---|---|
| `id` | bigserial | PK | |
| `name` | varchar(255) | NOT NULL | ユーザ名 |
| `email` | varchar(255) | NOT NULL, UNIQUE | ログインID |
| `email_verified_at` | timestamptz | NULL可 | メールアドレスの確認が済んだ日時。`NULL` なら未確認 |
| `password` | varchar(255) | NOT NULL | ハッシュ済み |
| `two_factor_secret` | text | NULL可 | Fortify の2要素認証用。画面からは使っていない |
| `two_factor_recovery_codes` | text | NULL可 | 同上 |
| `two_factor_confirmed_at` | timestamptz | NULL可 | 同上 |
| `household_size` | integer | NULL可 | 世帯人数。消費日数の初期値の算出に使う |
| `remember_token` | varchar(100) | NULL可 | |
| `created_at` / `updated_at` | timestamptz | NOT NULL | 既定は現在時刻 |

### admin（管理者）

テーブル名は単数形の `admin` である。

| 列 | 型 | 制約 | 備考 |
|---|---|---|---|
| `id` | bigserial | PK | |
| `name` | varchar(255) | NOT NULL, UNIQUE | ログインIDを兼ねる |
| `password` | varchar(255) | NOT NULL | ハッシュ済み |
| `created_at` / `updated_at` | timestamptz | NOT NULL | |

管理者を作る画面は無い。
作り方は [admin.md](admin.md) にある。

### categories（カテゴリ）

| 列 | 型 | 制約 | 備考 |
|---|---|---|---|
| `id` | bigserial | PK | |
| `name` | varchar(255) | NOT NULL, UNIQUE | |
| `created_by` | bigint | NOT NULL, FK → `admin.id` | |
| `updated_by` | bigint | NOT NULL, FK → `admin.id` | |
| `created_at` / `updated_at` | timestamptz | NOT NULL | |

### products（商品マスタ）

| 列 | 型 | 制約 | 備考 |
|---|---|---|---|
| `id` | bigserial | PK | |
| `category_id` | bigint | NOT NULL, FK → `categories.id`（削除時 RESTRICT） | |
| `name` | varchar(255) | NOT NULL, UNIQUE | カテゴリをまたいで一意 |
| `default_consumption_interval_days` | integer | NOT NULL | ストック1つが何日もつかの既定値 |
| `created_by` | bigint | NOT NULL, FK → `admin.id` | |
| `updated_by` | bigint | NOT NULL, FK → `admin.id` | |
| `created_at` / `updated_at` | timestamptz | NOT NULL | |

### stocks（利用者ごとのストック）

| 列 | 型 | 制約 | 備考 |
|---|---|---|---|
| `id` | bigserial | PK | |
| `user_id` | bigint | NOT NULL, FK → `users.id`（削除時 CASCADE） | |
| `product_id` | bigint | NOT NULL, FK → `products.id`（削除時 RESTRICT） | |
| `quantity` | integer | NOT NULL, 既定 1 | ストック数 |
| `consumption_interval_days` | integer | NOT NULL | ストック1つあたりの消費日数 |
| `next_purchase_date` | date | NOT NULL | 次回購入予定日 |
| `last_purchased_on` | date | NULL可 | ダッシュボードの購入ボタンで購入済みにした日。編集すると NULL に戻る |
| `created_at` / `updated_at` | timestamptz | NOT NULL | |

`(user_id, product_id)` に一意制約を持つ。

`next_purchase_date` と `last_purchased_on` は Eloquent 側で `date:Y-m-d` にキャストしており、画面にもJSONにも `YYYY-MM-DD` で出る。

### notification_logs（通知履歴）

| 列 | 型 | 制約 | 備考 |
|---|---|---|---|
| `id` | bigserial | PK | |
| `user_id` | bigint | NOT NULL, FK → `users.id`（削除時 CASCADE） | |
| `title` | text | NOT NULL | 通知の見出し |
| `description` | text | NOT NULL | 通知の本文 |
| `status` | text | NOT NULL | 既読状態。`unread` または `read` |
| `created_at` / `updated_at` | timestamptz | NOT NULL | |

`(user_id, status, created_at)` に複合インデックスを持つ。Push通知画面の「利用者の未読を新しい順に」の検索と、一括既読の絞り込みに使う。

`status` は `App\Enums\NotificationStatus` にキャストする。

| 値 | 意味 |
|---|---|
| `unread` | 未読。Push通知画面に出る |
| `read` | 既読。画面から消える |

配信の成否は記録しない。
以前は `sent` と `failed` を持っていたが、既読状態を表す2値に置き換えた。

### push_subscriptions（Push購読）

`laravel-notification-channels/webpush` が用意するテーブルで、そのまま使っている。

| 列 | 型 | 制約 | 備考 |
|---|---|---|---|
| `id` | bigserial | PK | |
| `subscribable_type` / `subscribable_id` | varchar / bigint | 複合インデックス | 購読者。実際には `users` だけを指す |
| `endpoint` | varchar(500) | NOT NULL, UNIQUE | ブラウザが発行する送信先 |
| `public_key` | varchar(255) | NULL可 | 購読の `p256dh` |
| `auth_token` | varchar(255) | NULL可 | 購読の `auth` |
| `content_encoding` | varchar(255) | NULL可 | |
| `created_at` / `updated_at` | timestamptz | NOT NULL | |

通知のON/OFFを表す列は持たない。
正本は端末側の購読の有無であり、この表に行があるかどうかがそれを写す。

## 枠組みが使うテーブル

いずれも Laravel の標準で、アプリからは直接触らない。

| テーブル | 用途 |
|---|---|
| `sessions` | セッション。`SESSION_DRIVER=database` |
| `cache` / `cache_locks` | キャッシュ。`CACHE_STORE=database` |
| `jobs` / `job_batches` / `failed_jobs` | キュー。開発環境の `QUEUE_CONNECTION=database` で使う。本番は `sync` なので使わない |
| `password_reset_tokens` | パスワード再設定。仮パスワードのハッシュを入れる（[auth.md](auth.md)） |

## 削除の制約

要件の「使用中の商品とカテゴリは削除できない」は、DBの外部キーとアプリの検証の二段で守る。

| 対象 | DB | アプリ |
|---|---|---|
| 利用中の商品 | `stocks.product_id` が RESTRICT | 削除前に `stocks` の有無を見て、あれば画面にエラーを返す |
| 商品のあるカテゴリ | `products.category_id` が RESTRICT | 削除前に `products` の有無を見て、あれば画面にエラーを返す |

利用者を削除すると、そのストックと通知履歴は CASCADE で消える。
`push_subscriptions` はポリモーフィックで外部キーが無く、`password_reset_tokens` と `sessions` にも外部キーが無い。
この3つは `User::pruning()` で明示的に消す。アカウントの削除と、未確認のアカウントの自動削除の両方がこれを通る（[auth.md](auth.md)）。
