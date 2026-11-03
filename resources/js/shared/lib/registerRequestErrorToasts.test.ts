import { router } from '@inertiajs/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerRequestErrorToasts } from './registerRequestErrorToasts';

vi.mock('@inertiajs/react', () => ({ router: { on: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('通信エラー関連', () => {
  it('networkError時、Toastを出す', () => {
    registerRequestErrorToasts();

    const handler = vi.mocked(router.on).mock.calls.find(([name]) => name === 'networkError')![1];
    const event = { preventDefault: vi.fn() };

    handler(event as never);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('通信できませんでした', expect.anything());
  });

  it('httpException時、Toastを出す', () => {
    registerRequestErrorToasts();

    const handler = vi.mocked(router.on).mock.calls.find(([name]) => name === 'httpException')![1];
    const event = { preventDefault: vi.fn() };

    handler(event as never);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('エラーが発生しました。');
  });
});
