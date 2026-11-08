import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { twoFactorChallenge } from '@/features/auth/api';
import TwoFactorChallenge from './two-factor-challenge';

vi.mock('@/features/auth/api', () => ({
  twoFactorChallenge: vi.fn(),
  requestTwoFactorRecovery: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn() },
  Toaster: () => null,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('auth/two-factor-challenge', () => {
  it('リカバリーコードの入力に切り替えると、送る値の名前が変わる', async () => {
    render(<TwoFactorChallenge />);

    expect(screen.getByLabelText('認証コード')).toBeInTheDocument();

    const toggleButton = screen.getByRole('button', { name: 'リカバリーコードを使う' });

    fireEvent.click(toggleButton);

    expect(screen.getByLabelText('リカバリーコード')).toBeInTheDocument();

    const textForm = screen.getByText('リカバリーコード');

    expect(textForm).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('リカバリーコード'), {
      target: { value: 'aaaaaaaaaa-aaaaaaaaaa' },
    });

    const submitButton = screen.getByRole('button', { name: '送信' });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(twoFactorChallenge).toHaveBeenCalledWith(
        { recovery_code: 'aaaaaaaaaa-aaaaaaaaaa' },
        expect.anything(),
      );
    });
  });
});
