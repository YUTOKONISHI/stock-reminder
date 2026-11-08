import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import TwoFactor from './two-factor';

vi.mock('@inertiajs/react', () => ({
  Head: () => null,
  Link: ({ children }: { children?: ReactNode }) => <>{children}</>,
  usePage: () => ({ url: '/app/settings/two-factor' }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn() }, Toaster: () => null }));

vi.mock('@/features/auth/api', () => ({
  enableTwoFactor: vi.fn(),
  confirmTwoFactor: vi.fn(),
  disableTwoFactor: vi.fn(),
  regenerateRecoveryCodes: vi.fn(),
}));

describe('settings/two-factor', () => {
  it.each([
    { status: 'disabled', buttons: ['2段階認証を有効にする'] },
    { status: 'pending', buttons: ['確かめて有効にする', 'やめる'] },
    { status: 'enabled', buttons: ['コードの再生成', '2段階認証を無効にする'] },
  ] as const)('3つの状態でそれぞれのボタンが出る（$status）', ({ status, buttons }) => {
    render(
      <TwoFactor
        status={status}
        qrCodeSvg={status === 'pending' ? '<svg></svg>' : null}
        secretKey={status === 'pending' ? 'SECRET' : null}
        recoveryCodes={status === 'enabled' ? ['aaaaaaaaaa-aaaaaaaaaa'] : null}
      />,
    );

    for (const name of buttons) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });
});
