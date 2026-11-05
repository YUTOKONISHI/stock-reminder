import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { login } from '@/features/auth/api';
import Login from './login';

vi.mock('@inertiajs/react', () => ({
  Link: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock('@/features/auth/api', () => ({
  login: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText('メールアドレス'), {
    target: { value: 'himari@example.com' },
  });
  fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'password' } });
  fireEvent.click(screen.getByRole('button', { name: 'ログイン' }));
}

describe('Login', () => {
  it('ログイン状態を保持するは最初からチェックされている', () => {
    render(<Login />);

    expect(screen.getByLabelText('ログイン状態を保持する')).toBeChecked();
  });

  it.each([
    { uncheck: false, remember: true },
    { uncheck: true, remember: false },
  ])(
    'チェックを外したか: $uncheck なら remember: $remember を送る',
    async ({ uncheck, remember }) => {
      render(<Login />);

      if (uncheck) {
        fireEvent.click(screen.getByLabelText('ログイン状態を保持する'));
      }

      fillAndSubmit();

      await waitFor(() => {
        expect(login).toHaveBeenCalledWith(
          { email: 'himari@example.com', password: 'password', remember },
          expect.anything(),
        );
      });
    },
  );
});
