import { describe, it } from 'vitest';

describe('通知の履歴', () => {
  it.todo('未読のものだけ並べる');

  it.todo('1件も無ければその旨を出す');

  it.todo('チェックを付けると既読にする');

  it.todo('既読にするとトーストを出す');

  it.todo('トーストの「元に戻す」で未読へ戻す');
});

describe('通知スイッチ', () => {
  it.todo('購読していればONになる');

  it.todo('端末が対応していなければ操作できない');

  it.todo('通知が拒否されていれば操作できない');

  it.todo('操作できないときは理由を出す');

  it.todo('ONにすると購読し、OFFにすると解除する');
});
