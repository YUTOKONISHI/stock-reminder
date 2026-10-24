# Lightsail に本番環境を置く

## 目的

本番のデプロイ先が決まっていない。
`20260729-pwa-general-user-only.md` は本番の HTTPS を対象外とし、`20261018-ios-safari-push.md` は HTTPS のオリジンが無いことを実機検証の前提として残した。
毎朝9時の通知が届くこと、iPhone で Push を試せることの2つを満たす本番環境を用意する。

本計画は Amazon Lightsail に置く案である。
同じ日に Fly.io に置く案（`20261018-deploy-flyio.md`）を書いており、どちらを採るかはまだ決めていない。

## 前提

本番に要るものは次のとおりである。

- PHP の Web サーバと PostgreSQL
- 毎朝9時に `app:send-purchase-reminders` を走らせるスケジューラ（`routes/console.php`）
- HTTPS
- パスワードのリセットに使うメールの配信

アップロードされたファイルは無く、セッションとキャッシュは DB に置いている。
アプリのコンテナは中にデータを持たないので、いつ作り直してもよい。

DB も Docker のイメージで動かし、マネージドの DB は使わない。
Lightsail のマネージド DB は月 $15 からで、インスタンスより高くつく。

## 構成

Lightsail の 2GB のインスタンス1台に、docker compose で全部を載せる。

```
Lightsail 2GB（東京）
└ docker compose
   ├ app        … FrankenPHP。80/443 を受け、証明書を自分で取って更新する
   ├ scheduler  … app と同じイメージで schedule:work を動かす
   └ db         … postgres:18-alpine。データは名前付きボリュームに置き、ポートは外に出さない
```

| 要素 | 置き方 | 目安（US の公表価格） |
|---|---|---|
| インスタンス | Linux 2GB（2 vCPU、60GB SSD、転送量 3TB、IPv4 込み） | $12 |
| 静的 IP | インスタンスに付けている間は無料 | $0 |
| バックアップ | Lightsail のオブジェクトストレージ（S3 互換） | $1 |
| 合計 | | 月 $13 前後 |

1GB の $7 でも動く見込みはある。
ただし PHP と Postgres が同じメモリを分け合うので、余裕を見て 2GB にする。

### TLS は FrankenPHP に任せる

FrankenPHP は Caddy を内蔵しており、Let's Encrypt の証明書を自分で取って更新する。
入口用の Caddy や Nginx を別のコンテナに立てずに済む。
証明書はコンテナの外に残すため、`/data` と `/config` をボリュームにする。
アプリの前にプロキシが無いので、`trustProxies` の設定は要らない。

Let's Encrypt の証明書にはドメイン名が要る。
IP アドレスだけでは HTTPS を出せないので、独自ドメインを取る。

### 起動の順番

`db` にヘルスチェック（`pg_isready`）を付け、`app` と `scheduler` は `depends_on` の `condition: service_healthy` で DB を待たせる。
どのサービスも `restart: unless-stopped` にして、落ちたときと再起動したときに立ち上げ直させる。

開発の `compose.yaml` には `laravel.queue` があるが、本番には置かない。
`QUEUE_CONNECTION=sync` にして、通知はスケジューラの中でその場で送る。

## 実装するときに触るもの

### 本番用の Dockerfile と compose

Sail のイメージは開発用で、本番には使えない。
FrankenPHP の公式イメージを土台にし、多段ビルドで作る。

1. `composer install --no-dev --optimize-autoloader`
2. フロントエンドのビルド。`@laravel/vite-plugin-wayfinder` はビルド中に `php artisan` を呼んで型を生成する（生成物は `.gitignore` にある）。この段には Node と PHP の両方と、`vendor` が要る
3. 実行用の段に `public/build` と `vendor` を写す

PHP のバージョンは開発の Sail（`runtimes/8.5`）に揃える。
本番用の compose は開発用の `compose.yaml` と別のファイルにする（例：`compose.production.yaml`）。

### アプリの設定

- `request` チャンネルは `storage/logs/request.log` に日ごとに書いている（`config/logging.php:76`）。コンテナを作り直すたびに消えるので、本番は stderr に出せるよう環境変数で切り替えられるようにする。stderr に出したログは `docker compose logs` で見られる
- Docker のログドライバに上限（`max-size`、`max-file`）を付け、ディスクが埋まらないようにする
- `QUEUE_CONNECTION=sync`
- `APP_ENV=production`、`APP_DEBUG=false`、`SESSION_SECURE_COOKIE=true`

### サーバの準備

- Ubuntu の LTS に Docker Engine と compose のプラグインを入れる
- Lightsail のファイアウォールで、22、80、443 番だけを開ける
- SSH は鍵認証だけにし、パスワード認証を切る
- OS のセキュリティ更新は `unattended-upgrades` で自動にする
- Lightsail の自動スナップショットを有効にする

### 秘密情報

サーバ上の `.env` に置き、権限を 600 にする。
イメージには入れない。
`APP_KEY`、DB の接続情報、VAPID の鍵、メールの認証情報が対象である。
VAPID の鍵は本番用に作り直し、`VAPID_SUBJECT` には実在する連絡先を入れる（Apple の Push サービスは不正な値を弾くと言われている）。

### メール

Resend などの配信サービスを契約し、SMTP で繋ぐ。
送信元のドメインの認証（SPF、DKIM）を、TLS 用に取る独自ドメインで行う。

AWS の SES も使える。
ただし最初は送れる宛先が限られた状態（サンドボックス）で、抜けるには申請が要る。

### バックアップ

サーバの cron で毎日 `docker compose exec db pg_dump` を取り、オブジェクトストレージに送る。
インスタンスの自動スナップショットもあるが、インスタンスごと消えたときに備えて、ダンプは外に置く。
復元を最初に一度試し、手順を README に残す。

Postgres のメジャーバージョンを上げるときは、イメージのタグを変えるだけではデータが移らない。
ダンプしてから戻す手順が要るので、タグは `18-alpine` のように固定しておく。

### 初期データ

`DatabaseSeeder` はデモ用で、管理者のパスワードが `password` になっている（`AdminSeeder`）。
本番ではカテゴリと商品のシーダーだけを流し、管理者は別の手段で作る。
手段は実装するときに決める。

### デプロイ

GitHub Actions でイメージをビルドして GHCR に置き、SSH でサーバに入って入れ替える。

1. `docker compose pull`
2. `docker compose run --rm app php artisan migrate --force`
3. `docker compose up -d`

`tests.yml` が通った後に main への push で走らせる。
アクションは既存のワークフローと同じく SHA で固定する。
サーバ上でビルドしない。
2GB のインスタンスでフロントエンドをビルドすると、動いているアプリとメモリを取り合う。

## 決めること

- **独自ドメインの名前と、どこで取るか**。HTTPS とメールの送信元の認証の両方に要る
- **メールの配信サービス**
- **管理者の作り方**

## 確かめること

- 東京リージョンの価格。上の金額は US の公表価格である
- 2GB で PHP と Postgres を同居させたときのメモリの使い方
- 一般ユーザーの画面が PWA としてインストールでき、Service Worker が登録されること（開発中は登録しないので、本番で初めて動く）

## 採らなかった案

**Lightsail のマネージド DB。** バックアップを任せられるが、月 $15 からで、インスタンスより高い。

**Caddy を入口用に別のコンテナで立てる。** FrankenPHP が TLS を終端できるので、コンテナが1つ増えるだけである。

**サーバ上でイメージをビルドする。** GHCR を介さずに済むが、ビルド中に動いているアプリとメモリを取り合う。

**ECS Fargate と RDS。** 実務に近い構成だが、ALB と RDS だけで月 $40 前後かかり、構成を組む手間も大きい。
同じイメージで後から移れるので、必要になってから検討する。

## 決定（2026-10-24）

Fly.io の案（`20261018-deploy-flyio.md`）を採り、本計画は採らない。
