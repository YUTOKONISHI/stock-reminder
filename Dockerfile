# syntax=docker/dockerfile:1

# 本番用。開発は Sail（compose.yaml）で動かしており、このファイルは使わない。

FROM dunglas/frankenphp:1-php8.5-trixie AS base

RUN install-php-extensions bcmath gmp intl pdo_pgsql zip \
    && cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"

WORKDIR /app


FROM base AS vendor

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --no-interaction --prefer-dist

COPY . .
RUN composer dump-autoload --no-dev --optimize


# wayfinder の Vite プラグインがビルド中に php artisan を呼ぶので、PHP と vendor のある段で Node を動かす。
FROM vendor AS assets

COPY --from=node:24-trixie-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=node:24-trixie-slim /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm

# VITE_ で始まる変数はビルド時に JS へ埋め込まれる。実行時の環境変数では変えられない。
ARG VITE_APP_NAME
RUN npm ci && npm run build


FROM base

# バックアップの pg_dump は DB と同じメジャーバージョンが要る。Debian の標準のリポジトリには 18 が無いので PGDG から入れる。
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && install -d /usr/share/postgresql-common/pgdg \
    && curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt trixie-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client-18 \
    && rm -rf /var/lib/apt/lists/*

# Fly Proxy が TLS を終端するので、HTTP で待ち受ける。
ENV SERVER_NAME=:8080

COPY --from=vendor --chown=www-data:www-data /app /app
COPY --from=assets --chown=www-data:www-data /app/public/build /app/public/build
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/app-entrypoint

RUN chown -R www-data:www-data /data/caddy /config/caddy

USER www-data

EXPOSE 8080

ENTRYPOINT ["app-entrypoint"]
CMD ["frankenphp", "run", "--config", "/etc/frankenphp/Caddyfile", "--adapter", "caddyfile"]
