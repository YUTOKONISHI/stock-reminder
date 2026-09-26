import { describe, it } from 'vitest';

describe('status の判定', () => {
  it.todo('Service Worker が無ければ unsupported になる');

  it.todo('PushManager が無ければ unsupported になる');

  it.todo('通知が拒否されていれば denied になる');

  it.todo('購読していなければ off になる');

  it.todo('すでに購読していれば on になる');
});

describe('subscribe', () => {
  it.todo('許可されれば購読してAPIに送り、on になる');

  it.todo('拒否されれば denied にして購読しない');

  it.todo('保留のままなら off にして購読しない');

  it.todo('VAPIDの公開鍵をUint8Arrayに変換して渡す');
});

describe('unsubscribe', () => {
  it.todo('購読があればAPIに削除を送り、端末側も解除して off になる');

  it.todo('購読が無ければ何も送らずに off にする');
});
