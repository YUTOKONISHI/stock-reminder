# 基本設計書

現行のコードから起こした基本設計書である。
要件定義書（`AGENTS.md`）が「何を作るか」を書くのに対し、本書は「どう作られているか」を書く。
画面、機能の処理の流れ、データ、認証、非機能の実現方法までを対象とし、クラス構成やメソッドの内部までは踏み込まない。

コードが正本であり、本書はその写しである。
食い違いを見つけたらコードを読み、本書を直す。

## 構成

| 文書 | 扱う範囲 |
|---|---|
| [screens.md](screens.md) | 画面一覧、画面遷移、ルート一覧 |
| [data-model.md](data-model.md) | テーブル定義、関連、制約 |
| [auth.md](auth.md) | 認証、アカウント登録、パスワード再設定 |
| [stock.md](stock.md) | ストック管理とダッシュボード |
| [notification.md](notification.md) | Push通知の購読、配信、履歴 |
| [admin.md](admin.md) | 管理者向けのマスタ管理 |
| [non-functional.md](non-functional.md) | PWA、ログ、タイムゾーン、セキュリティ |

設計を変えた経緯と、採用しなかった案は `doc/plans/` にある。
本書は現時点の姿だけを書き、理由は書かない。

## 全体構成

単一の Laravel アプリケーションで、サーバとフロントエンドを Inertia がつなぐ。
REST API は持たない。
画面はサーバのコントローラが `Inertia::render` で React のページ部品名と props を返し、ブラウザ側の React がそれを描く。
フォームの送信は Inertia のリクエストで、応答はリダイレクトである。

利用者の区分は2つあり、URL の接頭辞で分かれる。

- 一般ユーザー：`/app/*`。`web` ガードでセッション認証する
- 管理者：`/admin/*`。`admin` ガードでセッション認証する

`/` は `/app/welcome` に転送する。

Push通知の配信は Web Push で、日次のスケジューラが起点になる。
通知の本体は、開発環境ではキューを介して送り、本番ではコマンドの中で送る（[notification.md](notification.md)）。

## 技術構成

| 層 | 採用 |
|---|---|
| PHP | 8.4 |
| フレームワーク | Laravel 13 |
| 認証 | Laravel Fortify（`web` ガード）と、管理者向けの自前コントローラ（`admin` ガード） |
| 画面のつなぎ | Inertia 3（`inertiajs/inertia-laravel` と `@inertiajs/react`） |
| ルートのTypeScript出力 | Laravel Wayfinder |
| フロントエンド | React 19、TypeScript、Tailwind CSS 4、shadcn/ui 由来の部品（Radix UI） |
| ビルド | Vite |
| DB | PostgreSQL |
| セッション、キャッシュ | どちらも DB ドライバ |
| キュー | 開発環境は DB ドライバ、本番は `sync` |
| Push通知 | `laravel-notification-channels/webpush` |
| 開発環境 | Laravel Sail（Docker） |

## ディレクトリ構成

サーバ側は Laravel の既定に従う。
以下は既定から外れる、または本アプリ固有のものである。

| 場所 | 中身 |
|---|---|
| `app/Actions/Fortify/` | Fortify に差し込むアカウント操作。登録、プロフィール更新、パスワード更新、認証失敗時の文言 |
| `app/Console/Commands/SendPurchaseReminders.php` | 購入予定日の通知を送る日次コマンド |
| `app/Support/LogContext.php` | ログに書く主体（ガードとID）を返す |
| `resources/pwa/` | Service Worker、マニフェスト、オフライン画面。`routes/pwa.php` が `/app/` の下で配信する |

フロントエンドは `resources/js/` の下を役割で分ける。

| 場所 | 中身 |
|---|---|
| `pages/` | Inertia のページ部品。ファイル名が `Inertia::render` の第1引数に対応する |
| `features/<機能>/` | 機能ごとの `api.ts`、`hooks/`、`components/`、`types.ts` |
| `shared/` | 画面をまたぐ部品、レイアウト、日付や認証のユーティリティ、型 |
| `actions/`、`routes/` | Wayfinder の生成物。手で編集しない |

`features/*/api.ts` は Inertia の `router` 呼び出しをまとめる層で、ページ部品から HTTP の詳細を追い出している。
