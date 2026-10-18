import { router } from '@inertiajs/react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PasswordChangeDialog } from './PasswordChangeDialog';

vi.mock('@inertiajs/react', () => ({
  router: { post: vi.fn() },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn() },
}));

function fillPasswords(current: string, next: string, confirm: string) {
  fireEvent.change(screen.getByLabelText('現在のパスワード'), { target: { value: current } });
  fireEvent.change(screen.getByLabelText('新しいパスワード'), { target: { value: next } });
  fireEvent.change(screen.getByLabelText('パスワード確認'), { target: { value: confirm } });
  fireEvent.click(screen.getByRole('button', { name: '変更する' }));
}

/** router.post に渡されたコールバックを取り出す。Inertia の型は onSuccess に Page を
 * 要求するが、このコンポーネントは引数を使わない。 */
function callbacks(call = 0) {
  return vi.mocked(router.post).mock.calls[call][2] as {
    onSuccess?: () => void;
    onError?: (errors: Record<string, string>) => void;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PasswordChangeDialog', () => {
  it('新しいパスワードと確認が違えば送らずにエラーを出す', () => {
    render(<PasswordChangeDialog open onClose={() => {}} />);

    fillPasswords('password', 'password1', 'password2');

    expect(screen.getByText('パスワードが一致しません')).toBeInTheDocument();
  });

  it('一致していれば変更を送る', () => {
    render(<PasswordChangeDialog open onClose={() => {}} />);

    fillPasswords('password', 'password1', 'password1');

    expect(router.post).toHaveBeenCalledWith(
      '/admin/password',
      {
        current_password: 'password',
        password: 'password1',
        password_confirmation: 'password1',
      },
      expect.anything(),
    );
  });

  it('成功するとトーストを出して閉じる', () => {
    const onClose = vi.fn();
    render(<PasswordChangeDialog open onClose={onClose} />);

    fillPasswords('password', 'password1', 'password1');

    act(() => {
      callbacks().onSuccess?.();
    });

    expect(toast.success).toHaveBeenCalledWith('パスワードを変更しました');
    expect(onClose).toHaveBeenCalled();
  });

  it('成功すると入力を空に戻す', () => {
    render(<PasswordChangeDialog open onClose={() => {}} />);

    fillPasswords('password', 'password1', 'password1');

    act(() => {
      callbacks().onSuccess?.();
    });

    expect(screen.getByLabelText('現在のパスワード')).toHaveValue('');
    expect(screen.getByLabelText('新しいパスワード')).toHaveValue('');
    expect(screen.getByLabelText('パスワード確認')).toHaveValue('');
  });

  it('サーバのエラーを項目ごとに出す', () => {
    render(<PasswordChangeDialog open onClose={() => {}} />);

    fillPasswords('password', 'password1', 'password1');

    act(() => {
      callbacks().onError?.({
        current_password: '現在のパスワードが違います',
        password: 'パスワードは8文字以上にしてください',
      });
    });

    expect(screen.getByText('現在のパスワードが違います')).toBeInTheDocument();
    expect(screen.getByText('パスワードは8文字以上にしてください')).toBeInTheDocument();
  });
});
