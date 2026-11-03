import { router } from '@inertiajs/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resendVerificationEmail } from '@/features/auth/api';
import VerifyEmail from './verify-email';

vi.mock('@inertiajs/react', () => ({
  usePage: () => ({ props: { auth: { user: { email: 'himari@example.com' } } } }),
  router: { visit: vi.fn() },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn() },
  Toaster: () => null,
}));

vi.mock('@/features/auth/api', () => ({
  resendVerificationEmail: vi.fn(),
}));

vi.mock('@/shared/lib/auth', () => ({
  logout: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('VerifyEmail', () => {
  it('送り先のアドレスを出す', () => {
    render(<VerifyEmail expired={false} />);

    expect(screen.getByText('himari@example.com')).toBeInTheDocument();
  });

  it.each([
    { expired: true, shown: true },
    { expired: false, shown: false },
  ])('expired が $expired なら期限切れの文言を出すか: $shown', ({ expired, shown }) => {
    render(<VerifyEmail expired={expired} />);

    const message = screen.queryByText(/リンクの有効期限が切れています/);

    if (shown) {
      expect(message).toBeInTheDocument();
    } else {
      expect(message).toBeNull();
    }
  });

  it('再送に成功したらトーストを出す', () => {
    vi.mocked(resendVerificationEmail).mockImplementationOnce((callbacks) => {
      callbacks.onSuccess?.();
      callbacks.onFinish?.();
    });
    render(<VerifyEmail expired={false} />);

    fireEvent.click(screen.getByRole('button', { name: '確認メールを再送する' }));

    expect(resendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('確認メールを送信しました');
  });

  it('送信中は再送ボタンを押せない', () => {
    render(<VerifyEmail expired={false} />);

    fireEvent.click(screen.getByRole('button', { name: '確認メールを再送する' }));

    expect(screen.getByRole('button', { name: '送信中...' })).toBeDisabled();
  });

  it('ダッシュボードへ進むボタンでダッシュボードを開き直す', () => {
    render(<VerifyEmail expired={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'ダッシュボードへ進む' }));

    expect(router.visit).toHaveBeenCalledWith('/app/dashboard');
  });
});
