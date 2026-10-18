# iOS Safari で Push通知を受けられるようにする

## 目的

サポートブラウザは Chrome だけで通してきた（`AGENTS.md`、`doc/design/non-functional.md`）。
iOS Safari 対応は `20260817-push-notification.md:281` で、本番のHTTPSは `20260729-pwa-general-user-only.md:486` で、
どちらも対象外としてある。

買い忘れを防ぐという目的は、朝の通知が届いて初めて達せられる。
スマートフォンで使う前提の機能である以上、iPhone を外したままでは目的を満たせない。
本計画はその判断を覆すものである。

## 調べたこと

iOS で Web Push が通る条件は3つある。

1. iOS / iPadOS 16.4 以降
2. マニフェストの `display` が `standalone` か `fullscreen`
3. ホーム画面に追加し、そこから開いていること

タブで開いている間は通らない（[WebKit Blog](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados)、[Pushpad](https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications)）。
許可を求める呼び出しがユーザーの操作に直接つながっていることも要る。

iOS Chrome も中身は WebKit で、iOS 16.4 以降はホーム画面への追加ができる（[9to5Mac](https://9to5mac.com/2023/07/14/google-chrome-web-apps-ios/)）。
ただしタブの時点で Service Worker が見えるかは確かめていない。後述の未検証に入れる。

macOS Safari は事情が違い、16 / Ventura 以降なら通常のタブで通る（[WebKit Blog](https://webkit.org/blog/12945/meet-web-push/)）。
こちらは実装の変更を要しない。

## すでに満たしているもの

| 条件 | 現状 |
|---|---|
| `display: standalone` | `public/app/manifest.webmanifest` にある |
| スコープ内に全画面がある | 一般ユーザーの画面は Fortify の `prefix` も含めてすべて `/app/` 配下 |
| ユーザー操作から許可を求める | スイッチの `onCheckedChange` → `subscribe()` → `Notification.requestPermission()` で、間に `await` が無い |
| 暗号方式 | `aes128gcm`。Safari も受け取れる |

サーバ側と Service Worker には手を入れない見込みである。

## 直すもの

### 1. 状態を1つ足す

今の判定は3つのどれかが欠ければ `unsupported` にする（`features/notification/hooks/usePushSubscription.ts`）。

```ts
!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)
```

iOS Safari のタブはここに落ち、「このブラウザはPush通知に対応していません」と出る。
ホーム画面に追加すれば使えるのに、使えないと言っている。

| 状態 | 判定 |
|---|---|
| `unsupported` | `serviceWorker` が無い、または単独ウィンドウで開いていて `PushManager` か `Notification` が無い |
| `needs-install` | `serviceWorker` はあり、単独ウィンドウで開いておらず、`PushManager` が無い |
| `denied` | `Notification.permission === 'denied'` |
| `off` / `on` | 購読していない / している |

`serviceWorker` があることを条件に入れる。
アプリ内ブラウザ（Instagram や LINE の WKWebView）には Service Worker が無いので、これで `unsupported` 側に落ちる。
アプリ内ブラウザには「共有 → ホーム画面に追加」自体が無いため、追加を案内してはいけない。

単独ウィンドウの判定は `window.matchMedia('(display-mode: standalone)').matches` を使い、
`navigator.standalone` も併せて見る。
後者は display-mode のメディアクエリが効かない古い iOS で、ホーム画面から開いている場合を
`needs-install` と誤判定せず `unsupported` に落とすためである。
その環境では追加しても Push は通らない。

### 2. 残る誤判定

この規則でも次の2つは `needs-install` に入る。
どちらも追加しても Push は通らない。

- iOS 16.3 以前のタブ
- macOS Safari 15 以前

バージョンで分けるには UA を読むことになる。
`navigator.userAgent` は採らない。iPadOS 13 以降は Mac を騙るため `maxTouchPoints` との併用が必要になり、
条件が増えるほど外れたときに黙って誤判定する。

対応するiOSの下限を 16.4 と割り切り、どちらも誤判定のまま残す。

iOS 16.3 以前のタブは、追加して開けばスイッチが押せず `unsupported` が出る。
一度余計な手間を掛けさせるが、そこで分かる。

macOS Safari 15 以前は案内が誤ったまま残る。
macOS に「ホーム画面に追加」は無く、Dock への追加ができるのは Safari 17 からである。
案内どおりに操作できず、`unsupported` にもたどり着けない。
利用者がほぼいない環境なので許容する。

### 3. 案内の文言

iOS は `beforeinstallprompt` を発火しないので、ブラウザ任せの導線が無い。
手順を文章で出す。

`needs-install` に入るのは、実際には Service Worker を持つ WebKit のタブに限られる。
デスクトップの Chrome と Firefox、Android の Chrome はいずれも `PushManager` を持つため入らない。
したがって文言は iOS Safari 向けと割り切る。

> Safari で開き、共有ボタンから「ホーム画面に追加」を選んでください。
> 追加したアイコンから開くと通知を受け取れます。ログインはやり直しになります。

最後の一文が要る。
iOS のホーム画面版は Safari と Cookie を共有しないため、追加して開くと `start_url` から
ログイン画面へ飛ばされる。
書いておかないと「追加したらログアウトされた」と受け取られる。

出す場所は Push通知画面の、今 `unsupported` の理由を出している所（`pages/notifications.tsx`）。
スイッチは無効のままにする。追加するまで押しても通らないため。

### 4. `denied` の文言

今は「ブラウザの設定で通知がブロックされています。設定から許可してください」と出る。
iOS で直す場所はブラウザではなく「設定 > 通知」の側である。
§1 で文言の誤りを問題にしているので、ここも併せて直す。

環境を見分けずに済む言い方にする。

> 通知がブロックされています。端末またはブラウザの設定から許可してください。

## 確かめること

### 実機と経路

iOS の Web Push には HTTPS のオリジンが要る。
本番のHTTPSは `20260729-pwa-general-user-only.md:486` で対象外としたままで、デプロイ先も決まっていない。
iPhone を借りられても、次のどちらかが無いと試せない。

- `cloudflared` などのトンネルで、HTTPS のホスト名を一時的に外へ出す
- 検証用のデプロイ先を1つ用意する

**どちらも本計画には含めない。** 先に決める必要がある前提として書き出しておく。
これが無いままでは、下の項目は永久に未検証のまま残る。

`.env.example:73` は `VAPID_SUBJECT=mailto:hello@example.com` のままである。
Apple の Push サービスは `subject` が不正だと 403（BadJwtToken）で弾くと言われている。
本番の `.env` がまだ無いので、デプロイ先を決めるときに実在の連絡先を設定する。

### 実機でしか分からないこと

- iOS Safari のタブで `serviceWorker`、`PushManager`、`Notification` が実際にどう見えるか。
  3つのうち何が欠けるかで §1 の判定を変える必要が出るかもしれない
- ホーム画面に追加した後、`pushManager.subscribe` が通るか
- iOS Chrome のタブに Service Worker があるか。無ければ `unsupported` に落ち、追加の案内が出ない
- iOS Chrome から追加した Web アプリで Push が通るか
- 通知の見た目。iOS は `showNotification` の `icon` を無視して Web アプリのアイコンを使うと言われている。
  `tag` による置き換えが効くかも未確認
- 届き続けるか。配信を代行する事業者が「最初は届くのに途中で止まることがある」と報告している。
  iOS 側の問題で、実装では避けられない

## テスト

Vitest で押さえられるのは §1 の判定と §3 の文言だけである。

### `resources/js/test/setup.ts`

jsdom は `window.matchMedia` を持たない（`typeof window.matchMedia === 'undefined'`）。
`readStatus` から無条件に呼ぶと、`stubPushEnvironment` を通らない既存の `unsupported` 2件が
`TypeError` で落ちる。

既定のスタブを `Object.defineProperty(window, 'matchMedia', ...)` で置く。
`matches: false`（単独ウィンドウでない）を返す形にすれば、既存のテストの前提が変わらない。

記述子に `configurable: true` と `writable: true` を付ける。
省くと既定の `false` になり、テスト側で `vi.stubGlobal('matchMedia', ...)` を呼んだ時点で `TypeError` になる。
`stubGlobal` は元の記述子を保存してから `Object.defineProperty` で上書きする実装で、
上書きできない property には書き込めない。

`vi.stubGlobal` は使わない。
`usePushSubscription.test.ts:68-70` が `afterEach` で `vi.unstubAllGlobals()` を呼んでおり、
これは `stubGlobal` で記録した分をすべて戻す。
セットアップで一度だけ置いても最初のテストが終わった時点で外れ、2件目から避けたかった `TypeError` が出る。
`beforeEach` の中で毎回置き直す手もあるが、各テストが `stubGlobal` で上書きする余地を残すほうがよいので
`defineProperty` を採る。

### `usePushSubscription.test.ts`

`stubPushEnvironment` に単独ウィンドウかどうかの指定を足す。

既存の「PushManager が無ければ unsupported になる」は、新しい規則では `needs-install` になる。
**期待値が反転するので書き換える。** 足すのではない。

| テスト | 扱い |
|---|---|
| PushManager が無ければ unsupported になる | 名前と期待値を書き換え（`needs-install` になる） |
| 単独ウィンドウで PushManager が無ければ unsupported になる | 新規（`matchMedia` が `true`） |
| 古いiOSのホーム画面からでも unsupported になる | 新規（`matchMedia` は `false`、`navigator.standalone` が `true`） |
| アプリ内ブラウザでは unsupported になる（`serviceWorker` 無し） | 既存の「Service Worker が無ければ」で足りる |

3件目で §1 の `navigator.standalone` を見る理由を確かめる。
これが無いと、分岐を足しても `needs-install` との差が検証されない。

### `notifications.test.tsx`

| テスト | 扱い |
|---|---|
| 操作できないときは理由を出す（163行目） | `denied` の文言を §4 のものに書き換え（照合は174行目） |
| 追加の手順を出してスイッチを無効にする | 新規（`needs-install`） |

23行目の `PushStatus` は、フック側の `PushSubscriptionStatus`（`usePushSubscription.ts:5`）を
手で書き写したものである。
状態を足すたびに2か所を直すことになるので、フック側を `export type` にして取り込む。

## 要件と設計書の扱い

`AGENTS.md` の非機能要件は、他の変更と同じ決定の記録の形にする。

> - サポートブラウザ
>     - Chrome
>     - **iOS 16.4 以降の Safari（ホーム画面に追加した場合）対応を目指す**（2026-10-18 決定、実機未検証）

「対応する」とは書かない。
実機で確かめていない段階で要件側が対応を宣言し、設計書側が未検証と書く、という食い違いを避ける。
検証が済んでから「対応を目指す」を外す。

`doc/design/non-functional.md` のサポートブラウザの節には、環境ごとの可否の表と未検証であることを書く。

## 採らなかった案

**ネイティブアプリを出す。** APNs を直に叩けば確実に届くが、Swift の実装と App Store の審査が要る。
Web アプリ1つで済ませる方針から外れる。

**`unsupported` のままで文言だけ変える。** 「対応していないか、ホーム画面に追加されていません」のような
両方を含む言い方にすれば状態を増やさずに済む。
ただしアプリ内ブラウザ（Instagram や LINE の WKWebView）にも追加を勧めることになる。
あちらには「共有 → ホーム画面に追加」自体が無く、Instagram 経由で来た人がいちばん詰まる。
状態を分ければ `serviceWorker` の有無でここを外せる。
§2 のとおり macOS Safari 15 以前の誤判定は残るが、そちらは利用者がほぼいない。

**追加を促すバナーを全画面に出す。** 通知を使うかどうかは利用者が決めることなので、
Push通知画面に来たときだけ出す。

**UA でiOSのバージョンを見て `needs-install` を絞る。** §2 のとおり、誤判定が黙って起きるほうが厄介である。

## 追記（2026-10-18）：レビューを受けて変えたこと

**`navigator.standalone` は見ない。**
§1 では display-mode のメディアクエリが効かない古い iOS のために見るとしていた。
ただし display-mode も Service Worker も iOS 11.3 で入っている。
それより古い iOS は最初の `serviceWorker` の判定で `unsupported` に落ちるので、この分岐に来る実機はほぼ無い。

**display-mode は `standalone` と `fullscreen` の両方を見る。**
今のマニフェストは `standalone` だが、変えたときに判定が黙って外れないようにする。

**`needs-install` の案内は §3 の文言から変えた。**
- 手順を番号付きの箇条にし、薄い背景の枠に通常の文字の大きさで出す。操作すれば解決する状態なので、`unsupported` や `denied` と同じ小さな灰色の文字にはしない
- 共有ボタンは「共有ボタン（または「…」メニューの「共有」）」と書く。iOS 26 の Safari は、既定のコンパクト表示で共有ボタンを「…」メニューの中に移している
- 「ログインはやり直しになります」は「ログインし直しが必要になることがあります」に弱める。Cookie を共有しないことを実機で確かめていない

画面の文言は文末に句点を付けない既存の書き方に合わせ、§4 の文言も末尾の「。」を外した。

「実機でしか分からないこと」に次の2つを足す。

- iOS 26 の Safari で、共有ボタンがどこにあるか。案内の文言どおりに操作できるか
- ホーム画面版で開いたとき、Safari のログイン状態が引き継がれないか
