// 一般ユーザー画面（/app/*）用のサービスワーカー。
//
// このファイルが /app/sw.js から配信されるため、スコープは /app/ になる。
// 管理画面 /admin/* はスコープ外なので、そもそもこのSWに制御されない。
// つまり「管理画面はPWA化しない」はスコープだけで担保されており、
// fetch ハンドラの中で /admin を除外する必要は無い。
// 配信元を /sw.js に移すとスコープが / に広がり、管理画面も制御下に入るので注意。
//
// 一般ユーザー画面のルートを /app 配下から出すと、その画面がスコープ外になって
// PWAのウィンドウから抜ける。ルートを足すときは routes/web.php のグループ内に入れること。

const VERSION = 'v1';
const ASSET_CACHE = `assets-${VERSION}`;
const SHELL_CACHE = `shell-${VERSION}`;
const OFFLINE_URL = '/app/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.endsWith(VERSION)).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // HTML はキャッシュしない。Inertia が data-page 属性にログイン中ユーザーの
  // props（auth.user 含む）を埋め込むため、キャッシュはそのまま個人データの流出になる。
  // キャッシュはオリジン単位で共有され、ログアウトしても消えない。
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error())
    );

    return;
  }

  // ビルド成果物はファイル名に内容ハッシュを含み不変なので CacheFirst でよい。
  // /build/ はスコープ外だが、スコープが決めるのは制御するページであって
  // リクエスト先ではない。制御下のページから出た要求はここに届く。
  if (url.pathname.startsWith('/build/assets/')) {
    event.respondWith(cacheFirst(event.request));
  }
});

self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? '買い忘れ防止', {
      body: payload.body ?? '',
      icon: '/icons/icon-192.png',
      // tag を固定して、同日に再送されても通知が積み上がらないようにする。
      tag: 'purchase-reminder',
      data: { url: payload.url ?? '/app/dashboard' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const target = new URL(event.notification.data?.url ?? '/app/dashboard', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const client = clients.find((c) => c.url.startsWith(self.location.origin));

      if (client) {
        client.navigate(target);

        return client.focus();
      }

      return self.clients.openWindow(target);
    })
  );
});

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request);

  if (hit) {
    return hit;
  }

  const response = await fetch(request);

  if (response.ok) {
    cache.put(request, response.clone());
  }

  return response;
}
