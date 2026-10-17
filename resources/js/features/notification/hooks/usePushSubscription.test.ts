import { router } from '@inertiajs/react';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePushSubscription } from './usePushSubscription';

vi.mock('@inertiajs/react', () => ({
  router: { post: vi.fn(), delete: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const VAPID_KEY =
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

/** 端末が持つ購読。toJSON の入れ子はブラウザの PushSubscription に合わせてある。 */
function pushSubscription(endpoint = 'https://fcm.googleapis.com/fcm/send/abc123') {
  return {
    endpoint,
    toJSON: () => ({
      endpoint,
      keys: { p256dh: 'BpublicKeyForTest', auth: 'AuthTokenForTest' },
    }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  };
}

type PushEnvironment = {
  /** 画面を開いた時点の許可状態。 */
  permission?: NotificationPermission;
  /** requestPermission() の応答。省略すると permission と同じ。 */
  requestedPermission?: NotificationPermission;
  /** 端末がすでに持っている購読。無ければ null。 */
  subscription?: ReturnType<typeof pushSubscription> | null;
};

/**
 * Push通知に対応した端末を組み立てる。jsdom は PushManager も Notification も持たないので、
 * 呼ばなければ status は unsupported になる。
 */
function stubPushEnvironment({
  permission = 'default',
  requestedPermission = permission,
  subscription = null,
}: PushEnvironment = {}) {
  const created = pushSubscription();
  const pushManager = {
    getSubscription: vi.fn().mockResolvedValue(subscription),
    subscribe: vi.fn().mockResolvedValue(created),
  };
  const registration = { pushManager };
  const requestPermission = vi.fn().mockResolvedValue(requestedPermission);

  vi.stubGlobal('navigator', {
    serviceWorker: {
      ready: Promise.resolve(registration),
      getRegistration: vi.fn().mockResolvedValue(registration),
    },
  });
  vi.stubGlobal('PushManager', class {});
  vi.stubGlobal('Notification', { permission, requestPermission });

  return { pushManager, requestPermission, created };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('status の判定', () => {
  it('Service Worker が無ければ unsupported になる', () => {
    vi.stubGlobal('PushManager', class {});
    vi.stubGlobal('Notification', { permission: 'default' });

    const { result } = renderHook(() => usePushSubscription(VAPID_KEY));

    expect(result.current.status).toBe('unsupported');
  });

  it('PushManager が無ければ unsupported になる', () => {
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistration: vi.fn().mockResolvedValue(undefined) },
    });
    vi.stubGlobal('Notification', { permission: 'default' });

    const { result } = renderHook(() => usePushSubscription(VAPID_KEY));

    expect(result.current.status).toBe('unsupported');
  });

  it('通知が拒否されていれば denied になる', () => {
    stubPushEnvironment({ permission: 'denied' });
    const { result } = renderHook(() => usePushSubscription(VAPID_KEY));

    expect(result.current.status).toBe('denied');
  });

  it('購読していなければ off になる', async () => {
    const { pushManager } = stubPushEnvironment({ permission: 'granted' });
    const { result } = renderHook(() => usePushSubscription(VAPID_KEY));

    await waitFor(() => {
      expect(pushManager.getSubscription).toHaveBeenCalled();
    });

    expect(result.current.status).toBe('off');
  });

  it('すでに購読していれば on になる', async () => {
    stubPushEnvironment({ permission: 'granted', subscription: pushSubscription() });
    const { result } = renderHook(() => usePushSubscription(VAPID_KEY));

    await waitFor(() => {
      expect(result.current.status).toBe('on');
    });
  });
});

describe('subscribe', () => {
  it('許可されれば購読してAPIに送り、on になる', async () => {
    stubPushEnvironment({ permission: 'granted', subscription: pushSubscription() });
    const { result } = renderHook(() => usePushSubscription(VAPID_KEY));

    act(() => {
      result.current.subscribe();
    });

    await waitFor(() => {
      expect(result.current.status).toBe('on');
    });
  });

  it('拒否されれば denied にして購読しない', async () => {
    stubPushEnvironment({ permission: 'denied', subscription: pushSubscription() });
    const { result } = renderHook(() => usePushSubscription(VAPID_KEY));

    act(() => {
      result.current.subscribe();
    });
    await waitFor(() => {
      expect(result.current.status).toBe('denied');
    });
  });

  it('保留のままなら off にして購読しない', async () => {
    stubPushEnvironment({ permission: 'default', subscription: pushSubscription() });
    const { result } = renderHook(() => usePushSubscription(VAPID_KEY));

    act(() => {
      result.current.subscribe();
    });
    await waitFor(() => {
      expect(result.current.status).toBe('off');
    });
  });

  it('VAPIDの公開鍵をUint8Arrayに変換して渡す', async () => {
    stubPushEnvironment({ permission: 'granted', subscription: pushSubscription() });
    const { result } = renderHook(() => usePushSubscription(VAPID_KEY));

    act(() => {
      result.current.subscribe();
    });

    await waitFor(() => {
      expect(router.post).toHaveBeenCalledWith(
        '/app/push-subscriptions',
        {
          endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
          keys: {
            auth: 'AuthTokenForTest',
            p256dh: 'BpublicKeyForTest',
          },
        },
        {
          preserveScroll: true,
          preserveState: true,
        },
      );
    });
  });
});

describe('unsubscribe', () => {
  it('購読があればAPIに削除を送り、端末側も解除して off になる', async () => {
    stubPushEnvironment({ permission: 'granted', subscription: pushSubscription() });
    const { result } = renderHook(() => usePushSubscription(VAPID_KEY));

    act(() => {
      result.current.unsubscribe();
    });

    await waitFor(() => {
      expect(router.delete).toHaveBeenCalledWith('/app/push-subscriptions', {
        data: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
        },
        preserveScroll: true,
        preserveState: true,
      });
      expect(result.current.status).toBe('off');
    });
  });

  it('購読が無ければ何も送らずに off にする', async () => {
    stubPushEnvironment({ permission: 'granted' });
    const { result } = renderHook(() => usePushSubscription(VAPID_KEY));

    act(() => {
      result.current.unsubscribe();
    });

    await waitFor(() => {
      expect(result.current.status).toBe('off');
    });

    expect(router.delete).not.toHaveBeenCalled();
  });
});
