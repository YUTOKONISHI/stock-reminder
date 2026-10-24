#!/bin/sh
set -e

# 設定のキャッシュは環境変数を焼き込むので、ビルド時ではなく起動時に作る。
php artisan optimize

exec docker-php-entrypoint "$@"
