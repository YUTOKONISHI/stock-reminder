import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureInstallPrompt } from '../installPrompt';
import { InstallCard } from './InstallCard';

const DISMISSED_KEY = 'install-card-dismissed';

function dispatchInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome }),
  });

  act(() => {
    window.dispatchEvent(event);
  });

  return event;
}

/** iOS Safari と同じ形にする。Service Worker はあるが PushManager が無い。jsdom はどちらも持たない。 */
function stubManualInstallEnvironment(displayMode: 'browser' | 'standalone' = 'browser') {
  vi.stubGlobal('navigator', { serviceWorker: {} });
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === `(display-mode: ${displayMode})`,
  }));
}

beforeEach(() => {
  captureInstallPrompt();
});

afterEach(() => {
  act(() => {
    window.dispatchEvent(new Event('appinstalled'));
  });
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('出す条件', () => {
  it('イベントが届かず手順も要らない環境では出さない', () => {
    render(<InstallCard />);

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('描画より先に届いたイベントでもボタンを出す', () => {
    const event = dispatchInstallPrompt();
    render(<InstallCard />);

    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByRole('button', { name: 'インストール' })).toBeInTheDocument();
  });

  it('描画の後に届いたイベントでもボタンを出す', () => {
    render(<InstallCard />);
    dispatchInstallPrompt();

    expect(screen.getByRole('button', { name: 'インストール' })).toBeInTheDocument();
  });

  it('iOS Safari のタブでは追加の手順を出す', () => {
    stubManualInstallEnvironment();
    render(<InstallCard />);

    expect(screen.getByText(/「ホーム画面に追加」を選ぶ/)).toBeInTheDocument();
    expect(screen.getByText('追加したアイコンから開く')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'インストール' })).not.toBeInTheDocument();
  });

  it('ホーム画面から開いているときは手順を出さない', () => {
    stubManualInstallEnvironment('standalone');
    render(<InstallCard />);

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('インストールが済むと消える', () => {
    render(<InstallCard />);
    dispatchInstallPrompt();

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });
});

describe('インストールボタン', () => {
  it('ダイアログを開いてバナーを消す。受け入れたら閉じた記録は残さない', async () => {
    const event = dispatchInstallPrompt('accepted');
    render(<InstallCard />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'インストール' }));
    });

    expect(event.prompt).toHaveBeenCalledOnce();
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(localStorage.getItem(DISMISSED_KEY)).toBeNull();
  });

  it('ダイアログでキャンセルすると閉じた記録を残す', async () => {
    dispatchInstallPrompt('dismissed');
    render(<InstallCard />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'インストール' }));
    });

    expect(localStorage.getItem(DISMISSED_KEY)).not.toBeNull();
  });
});

describe('閉じる操作', () => {
  it('「今はしない」で閉じると、次に開いたときも出さない', () => {
    dispatchInstallPrompt();
    const { unmount } = render(<InstallCard />);

    fireEvent.click(screen.getByRole('button', { name: '今はしない' }));
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();

    unmount();
    render(<InstallCard />);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('手順のカードは×で閉じ、閉じた記録を残す', () => {
    stubManualInstallEnvironment();
    render(<InstallCard />);

    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(localStorage.getItem(DISMISSED_KEY)).not.toBeNull();
  });

  it('localStorage が使えなくても画面は壊れず、閉じられる', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    dispatchInstallPrompt();
    render(<InstallCard />);

    fireEvent.click(screen.getByRole('button', { name: '今はしない' }));

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });
});
