CREATE TABLE "users"(
    "id" BIGINT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "email_verified_at" TIMESTAMP(0) WITH
        TIME zone NULL,
        "password" VARCHAR(255) NOT NULL,
        "household_size" INTEGER NULL,
        "remember_token" VARCHAR(100) NULL,
        "created_at" TIMESTAMP(0)
    WITH
        TIME zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(0)
    WITH
        TIME zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "two_factor_secret" TEXT NULL,
        "two_factor_recovery_codes" TEXT NULL,
        "two_factor_confirmed_at" TIMESTAMP(0)
    WITH
        TIME zone NULL
);
ALTER TABLE
    "users" ADD PRIMARY KEY("id");
ALTER TABLE
    "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");
COMMENT
ON COLUMN
    "users"."name" IS 'ユーザ名';
COMMENT
ON COLUMN
    "users"."email" IS 'メールアドレス';
COMMENT
ON COLUMN
    "users"."email_verified_at" IS 'メールアドレス認証の確認日付';
COMMENT
ON COLUMN
    "users"."password" IS 'パスワード';
COMMENT
ON COLUMN
    "users"."household_size" IS '世帯人数';
COMMENT
ON COLUMN
    "users"."remember_token" IS 'ログイン保持トークン';
COMMENT
ON COLUMN
    "users"."created_at" IS '作成日時';
COMMENT
ON COLUMN
    "users"."updated_at" IS '更新日付';
COMMENT
ON COLUMN
    "users"."two_factor_secret" IS '二要素認証の秘密鍵';
COMMENT
ON COLUMN
    "users"."two_factor_recovery_codes" IS '二要素認証のリカバリコード';
COMMENT
ON COLUMN
    "users"."two_factor_confirmed_at" IS '二要素認証の有効化日時';
CREATE TABLE "password_reset_tokens"(
    "email" VARCHAR(255) NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(0) WITH
        TIME zone NULL
);
ALTER TABLE
    "password_reset_tokens" ADD PRIMARY KEY("email");
COMMENT
ON COLUMN
    "password_reset_tokens"."email" IS 'メールアドレス';
COMMENT
ON COLUMN
    "password_reset_tokens"."token" IS '仮パスワードのハッシュ';
COMMENT
ON COLUMN
    "password_reset_tokens"."created_at" IS '作成日時';
CREATE TABLE "admin"(
    "id" BIGINT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(0) WITH
        TIME zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(0)
    WITH
        TIME zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE
    "admin" ADD PRIMARY KEY("id");
COMMENT
ON COLUMN
    "admin"."name" IS '管理者名';
COMMENT
ON COLUMN
    "admin"."password" IS 'パスワード';
COMMENT
ON COLUMN
    "admin"."created_at" IS '作成日付';
COMMENT
ON COLUMN
    "admin"."updated_at" IS '更新日付';
CREATE TABLE "categories"(
    "id" BIGINT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "created_by" BIGINT NOT NULL,
    "updated_by" BIGINT NOT NULL,
    "created_at" TIMESTAMP(0) WITH
        TIME zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(0)
    WITH
        TIME zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE
    "categories" ADD PRIMARY KEY("id");
COMMENT
ON COLUMN
    "categories"."name" IS 'カテゴリ名';
COMMENT
ON COLUMN
    "categories"."created_by" IS '作成した管理者';
COMMENT
ON COLUMN
    "categories"."updated_by" IS '更新した管理者';
COMMENT
ON COLUMN
    "categories"."created_at" IS '作成日付';
COMMENT
ON COLUMN
    "categories"."updated_at" IS '更新日付';
CREATE TABLE "products"(
    "id" BIGINT NOT NULL,
    "category_id" BIGINT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "default_consumption_interval_days" INTEGER NOT NULL,
    "created_by" BIGINT NOT NULL,
    "updated_by" BIGINT NOT NULL,
    "created_at" TIMESTAMP(0) WITH
        TIME zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(0)
    WITH
        TIME zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE
    "products" ADD PRIMARY KEY("id");
COMMENT
ON COLUMN
    "products"."category_id" IS 'カテゴリID';
COMMENT
ON COLUMN
    "products"."name" IS '商品名';
COMMENT
ON COLUMN
    "products"."default_consumption_interval_days" IS '消費日数の目安。世帯人数で割って初期値にする';
COMMENT
ON COLUMN
    "products"."created_by" IS '作成した管理者';
COMMENT
ON COLUMN
    "products"."updated_by" IS '更新した管理者';
COMMENT
ON COLUMN
    "products"."created_at" IS '作成日付';
COMMENT
ON COLUMN
    "products"."updated_at" IS '更新日付';
CREATE TABLE "stocks"(
    "id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "product_id" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "consumption_interval_days" INTEGER NOT NULL,
    "next_purchase_date" TIMESTAMP(0) WITH
        TIME zone NOT NULL,
        "last_purchased_on" DATE NULL,
        "created_at" TIMESTAMP(0)
    WITH
        TIME zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(0)
    WITH
        TIME zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE
    "stocks" ADD CONSTRAINT "stocks_user_id_product_id_unique" UNIQUE("user_id", "product_id");
ALTER TABLE
    "stocks" ADD PRIMARY KEY("id");
COMMENT
ON COLUMN
    "stocks"."user_id" IS 'ユーザID';
COMMENT
ON COLUMN
    "stocks"."product_id" IS '商品ID';
COMMENT
ON COLUMN
    "stocks"."quantity" IS 'ストック数';
COMMENT
ON COLUMN
    "stocks"."consumption_interval_days" IS 'ユーザが設定する消費日数/個数(amount)';
COMMENT
ON COLUMN
    "stocks"."next_purchase_date" IS '次回購入予定日';
COMMENT
ON COLUMN
    "stocks"."last_purchased_on" IS '最終購入日';
COMMENT
ON COLUMN
    "stocks"."created_at" IS '作成日付';
COMMENT
ON COLUMN
    "stocks"."updated_at" IS '更新日付';
CREATE TABLE "notification_logs"(
    "id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(0) WITH
        TIME zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(0)
    WITH
        TIME zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE
    "notification_logs" ADD PRIMARY KEY("id");
COMMENT
ON COLUMN
    "notification_logs"."user_id" IS 'ユーザID';
COMMENT
ON COLUMN
    "notification_logs"."title" IS 'タイトル';
COMMENT
ON COLUMN
    "notification_logs"."description" IS '通知内容';
COMMENT
ON COLUMN
    "notification_logs"."status" IS '既読状態。unread または read';
COMMENT
ON COLUMN
    "notification_logs"."created_at" IS '作成日時';
COMMENT
ON COLUMN
    "notification_logs"."updated_at" IS '更新日時';
CREATE TABLE "push_subscriptions"(
    "id" BIGINT NOT NULL,
    "subscribable_type" VARCHAR(255) NOT NULL,
    "subscribable_id" BIGINT NOT NULL,
    "endpoint" VARCHAR(500) NOT NULL,
    "public_key" VARCHAR(255) NULL,
    "auth_token" VARCHAR(255) NULL,
    "content_encoding" VARCHAR(255) NULL,
    "created_at" TIMESTAMP(0) WITH
        TIME zone NULL,
        "updated_at" TIMESTAMP(0)
    WITH
        TIME zone NULL
);
ALTER TABLE
    "push_subscriptions" ADD PRIMARY KEY("id");
ALTER TABLE
    "push_subscriptions" ADD CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint");
COMMENT
ON COLUMN
    "push_subscriptions"."subscribable_type" IS '購読者のモデル名。App\Models\User が入る';
COMMENT
ON COLUMN
    "push_subscriptions"."subscribable_id" IS '購読者のID。users.id を指すが外部キーは張らない';
COMMENT
ON COLUMN
    "push_subscriptions"."endpoint" IS 'ブラウザが発行する配信先URL';
COMMENT
ON COLUMN
    "push_subscriptions"."public_key" IS '暗号化の公開鍵(p256dh)';
COMMENT
ON COLUMN
    "push_subscriptions"."auth_token" IS '暗号化の認証シークレット';
COMMENT
ON COLUMN
    "push_subscriptions"."content_encoding" IS '本文のエンコード方式';
COMMENT
ON COLUMN
    "push_subscriptions"."created_at" IS '作成日時';
COMMENT
ON COLUMN
    "push_subscriptions"."updated_at" IS '更新日時';
ALTER TABLE
    "products" ADD CONSTRAINT "products_category_id_foreign" FOREIGN KEY("category_id") REFERENCES "categories"("id");
ALTER TABLE
    "stocks" ADD CONSTRAINT "stocks_user_id_foreign" FOREIGN KEY("user_id") REFERENCES "users"("id");
ALTER TABLE
    "categories" ADD CONSTRAINT "categories_updated_by_foreign" FOREIGN KEY("updated_by") REFERENCES "admin"("id");
ALTER TABLE
    "products" ADD CONSTRAINT "products_created_by_foreign" FOREIGN KEY("created_by") REFERENCES "admin"("id");
ALTER TABLE
    "products" ADD CONSTRAINT "products_updated_by_foreign" FOREIGN KEY("updated_by") REFERENCES "admin"("id");
ALTER TABLE
    "notification_logs" ADD CONSTRAINT "notification_logs_user_id_foreign" FOREIGN KEY("user_id") REFERENCES "users"("id");
ALTER TABLE
    "categories" ADD CONSTRAINT "categories_created_by_foreign" FOREIGN KEY("created_by") REFERENCES "admin"("id");
ALTER TABLE
    "stocks" ADD CONSTRAINT "stocks_product_id_foreign" FOREIGN KEY("product_id") REFERENCES "products"("id");