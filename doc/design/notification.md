# Push通知

当日の買い忘れを防ぐための通知を、毎朝9時に送る。
配信は Web Push で、`laravel-notification-channels/webpush` を使う。

登場するのは次の3つである。

- **購読**：端末とブラウザが持つ Push の宛先。`push_subscriptions` に写しを置く
- **配信**：日次のコマンドが起点になり、キューを経て端末に届く
- **履歴**：`notification_logs` に積み、Push通知画面に未読だけを出す

## 通知のON/OFF

正本は端末側の購読の有無である。
サーバに設定列は無い。
`push_subscriptions` に行があるかどうかが、端末の状態を写す。

同じ利用者が複数の端末から購読すれば、行はその数だけできる。

### 購読の切り替え

`features/notification/hooks/usePushSubscription.ts` が状態を持つ。

| 状態 | 意味 |
|---|---|
| `unsupported` | Service Worker が無い。または単独ウィンドウで開いていて `PushManager` か `Notification` が無い |
| `needs-install` | Service Worker はあり、単独ウィンドウで開いておらず、`PushManager` が無い（iOS Safari のタブ） |
| `denied` | 端末またはブラウザの通知許可が拒否されている |
| `off` | 購読していない |
| `on` | 購読している |

画面を開いた時点で `/app/` スコープの Service Worker 登録を引き、購読があれば `on` にする。

ONにするときは、通知の許可を求めてから `pushManager.subscribe` を呼び、得た購読を `POST /app/push-subscriptions` に送る。
許可されなければ購読はせず、`denied` か `off` に戻す。

OFFにするときは、`DELETE /app/push-subscriptions` に `endpoint` を送ってから、端末側の購読を解除する。

単独ウィンドウかどうかは `display-mode` のメディアクエリで、`standalone` か `fullscreen` のどちらかに当たるかを見る。

`unsupported`、`needs-install`、`denied` のときはトグルを無効にし、理由を画面に出す。
`needs-install` では、理由の代わりにホーム画面への追加の手順を枠で囲んで出す。

### サーバ側

`PushSubscriptionController` が担う。

| 操作 | 入力 | 処理 |
|---|---|---|
| `store` | `endpoint`（500文字以内）、`keys.p256dh`、`keys.auth` | `updatePushSubscription` で登録または更新 |
| `destroy` | `endpoint` | `deletePushSubscription` で削除 |

VAPID の公開鍵は `NotificationLogController::index` が `vapidPublicKey` プロップとして画面に渡す。
鍵の対は `.env` の `VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY`、`VAPID_SUBJECT` に置く。

## 配信

### 起点

`routes/console.php` のスケジューラが、毎日9時（`Asia/Tokyo`）に `app:send-purchase-reminders` を実行する。
`onOneServer()` を付けており、スケジューラが複数台あっても実行は1台に限られる。ロックはキャッシュ（`database`）に置く。

### コマンドの処理

`App\Console\Commands\SendPurchaseReminders`。

1. 次回購入予定日が今日以前のストックを、商品と利用者を伴って取得する
2. 利用者ごとにまとめる
3. まとまりごとに文面を組み立てる
4. `PurchaseReminder` 通知を送る
5. `notification_logs` に未読として1件積む

予定日を過ぎたものにも毎朝送る。
1日で打ち切らないため、購入済みを記録するまで通知は続く。

利用者1人あたりの通知は1件で、ストックの数だけ送ることはない。

### 文面

まとまりの中に予定日を過ぎたものが1つでもあれば、買い忘れの文面に切り替える。

| 状態 | 件数 | 見出し |
|---|---|---|
| 予定日どおり | 1件 | 「{商品名}」の購入予定日です |
| 予定日どおり | 複数 | 「{商品名}」ほかN件の購入予定日です |
| 予定日超過 | 1件 | 「{商品名}」を買い忘れていませんか |
| 予定日超過 | 複数 | 「{商品名}」ほかN件を買い忘れていませんか |

見出しに出す商品名は、予定日の早いものである。

本文は状況を述べる一文に続けて、1件なら「買い忘れにご注意ください。」を、複数なら商品名を3件まで並べ、残りを「ほかN件」とする。

### 送信の経路

`PurchaseReminder` は `ShouldQueue` を実装しており、キューに積まれてから送られる。
キューは DB ドライバなので、配信にはワーカーの常駐が要る。

送信で例外が出たときは、`laravel.log` に利用者IDと例外を書いて次の利用者に進む。
通知履歴はこの例外にかかわらず積む。
履歴は既読状態を持つだけで、配信の成否は記録しない。

### 端末側の受信

`resources/pwa/sw.js` の `push` ハンドラが受け取り、通知を出す。

- 見出しと本文はペイロードから取る。取れなければ見出しを「買い忘れ防止」にする
- `tag` を `purchase-reminder` に固定する。同じ日に再送されても通知が積み上がらない
- クリックすると、既に開いているウィンドウがあればそれを目的の URL に移して前面に出し、無ければ新しく開く。既定の行き先は `/app/dashboard`

## 履歴

`GET /app/notifications`（`NotificationLogController::index`）。

未読（`status = unread`）だけを、新しい順に20件ずつ返す。
既読にすると画面から消える。

| 操作 | ルート | 処理 |
|---|---|---|
| 既読にする | `PATCH /app/notifications/{notificationLog}/read` | `status` を `read` にして元の画面に戻る |
| 未読に戻す | `PATCH /app/notifications/{notificationLog}/unread` | `status` を `unread` にして元の画面に戻る |

どちらも、対象の `user_id` がログイン中の利用者と違えば 403 を返す。

既読にすると「既読にしました」のトーストが出て、「元に戻す」から未読に戻せる。
消えた通知を取り戻す導線はこれだけである。

履歴を既読にしても通知は止まらない。
翌朝も同じ条件で通知が来る。
止められるのはダッシュボードの購入ボタンだけである。
