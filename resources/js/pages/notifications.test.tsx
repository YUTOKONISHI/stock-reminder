import { router } from '@inertiajs/react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationLog } from '@/features/notification/types';
import type { Paginated } from '@/shared/types/pagination';
import Notifications from './notifications';

vi.mock('@inertiajs/react', () => ({
  Head: () => null,
  Link: ({ children }: { children?: ReactNode }) => <>{children}</>,
  usePage: () => ({ url: '/app/notifications' }),
  router: { patch: vi.fn() },
}));

/* AppShell が置いている Toaster も sonner から来るので一緒に塞ぐ。 */
vi.mock('sonner', () => ({
  toast: { success: vi.fn() },
  Toaster: () => null,
}));

type PushStatus = 'unsupported' | 'denied' | 'off' | 'on';

/* usePushSubscription には専用のテストがあるので、ここは状態と関数だけ差し替える。
 * status はテストごとに beforeEach で 'off' へ戻す。 */
let pushStatus: PushStatus = 'off';
const subscribe = vi.fn();
const unsubscribe = vi.fn();

vi.mock('@/features/notification/hooks/usePushSubscription', () => ({
  usePushSubscription: () => ({ status: pushStatus, subscribe, unsubscribe }),
}));

function notification(overrides: Partial<NotificationLog> = {}): NotificationLog {
  return {
    id: 1,
    title: '買い忘れがあります',
    description: 'ティッシュの予定日を過ぎています',
    status: 'unread',
    created_at: '2026-09-23T09:00:00.000000Z',
    ...overrides,
  };
}

/** last_page を1にしてページ送りが描かれない形にする。 */
function paginated(data: NotificationLog[]): Paginated<NotificationLog> {
  return {
    data,
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: data.length,
    from: data.length > 0 ? 1 : null,
    to: data.length > 0 ? data.length : null,
  };
}

function renderPage(notifications: NotificationLog[] = [notification()]) {
  return render(
    <Notifications notifications={paginated(notifications)} vapidPublicKey="dummy-key" />,
  );
}

function patchOptions(call = 0) {
  return vi.mocked(router.patch).mock.calls[call][2] as { onSuccess?: () => void };
}

beforeEach(() => {
  pushStatus = 'off';
  vi.clearAllMocks();
});

describe('通知の履歴', () => {
  /* 未読だけに絞るのは NotificationController の担当。ここで確かめられるのは
   * 渡された通知を題名・説明・日付の形で描くことだけ。 */
  it('渡された通知を並べる', () => {
    renderPage([
      notification({ id: 1 }),
      notification({ id: 2, title: '今日買うものがあります', description: '醤油が予定日です' }),
    ]);

    const rows = screen.getAllByRole('listitem');

    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('買い忘れがあります');
    expect(rows[0]).toHaveTextContent('ティッシュの予定日を過ぎています');
    expect(rows[0]).toHaveTextContent('2026/09/23');
    expect(rows[1]).toHaveTextContent('今日買うものがあります');
    expect(rows[1]).toHaveTextContent('醤油が予定日です');
  });

  it('1件も無ければその旨を出す', () => {
    renderPage([]);
    expect(screen.getByText('未読の通知はありません')).toBeInTheDocument();
  });

  it('チェックを付けると既読にする', () => {
    renderPage([notification({ id: 5 })]);

    fireEvent.click(screen.getByRole('button', { name: '「買い忘れがあります」を既読にする' }));

    expect(router.patch).toHaveBeenCalledWith('/app/notifications/5/read', {}, expect.anything());
  });

  it('既読にするとトーストを出す', () => {
    renderPage([notification({ id: 5 })]);

    fireEvent.click(screen.getByRole('button', { name: '「買い忘れがあります」を既読にする' }));

    const { onSuccess } = patchOptions(0);

    onSuccess?.();

    expect(toast.success).toHaveBeenCalledWith('既読にしました', {
      action: { label: '元に戻す', onClick: expect.any(Function) },
    });
  });

  it('トーストの「元に戻す」で未読へ戻す', () => {
    renderPage([notification({ id: 5 })]);

    fireEvent.click(screen.getByRole('button', { name: '「買い忘れがあります」を既読にする' }));

    patchOptions().onSuccess?.();

    const [, options] = vi.mocked(toast.success).mock.calls[0];
    (options as unknown as { action: { onClick: () => void } }).action.onClick();

    expect(router.patch).toHaveBeenCalledWith('/app/notifications/5/unread', {}, expect.anything());
  });
});

describe('通知スイッチ', () => {
  it('購読していればONになる', () => {
    pushStatus = 'on';
    renderPage();

    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('購読していなければOFFになる', () => {
    renderPage();

    expect(screen.getByRole('switch')).not.toBeChecked();
    expect(screen.getByRole('switch')).toBeEnabled();
  });

  it('端末が対応していなければ操作できない', () => {
    pushStatus = 'unsupported';
    renderPage();

    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('通知が拒否されていれば操作できない', () => {
    pushStatus = 'denied';
    renderPage();

    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('操作できないときは理由を出す', () => {
    pushStatus = 'unsupported';
    const { unmount } = renderPage();

    expect(screen.getByText('このブラウザはPush通知に対応していません')).toBeInTheDocument();

    unmount();
    pushStatus = 'denied';
    renderPage();

    expect(
      screen.getByText('ブラウザの設定で通知がブロックされています。設定から許可してください'),
    ).toBeInTheDocument();
  });

  it('ONにすると購読し、OFFにすると解除する', () => {
    const { unmount } = renderPage();

    fireEvent.click(screen.getByRole('switch'));

    expect(subscribe).toHaveBeenCalled();
    expect(unsubscribe).not.toHaveBeenCalled();

    unmount();
    pushStatus = 'on';
    renderPage();

    fireEvent.click(screen.getByRole('switch'));

    expect(unsubscribe).toHaveBeenCalled();
  });
});
