import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ErrorPage from './error';

vi.mock('@inertiajs/react', () => ({
  Head: () => null,
  Link: ({ href, children }: { href: string; children?: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('ErrorPage', () => {
  it.each([
    { code: 403, title: 'このページは開くことができません', canRetry: false },
    { code: 404, title: 'ページが見つかりません', canRetry: false },
    { code: 419, title: 'ページの有効期限が切れました', canRetry: true },
    { code: 500, title: '問題が発生しました', canRetry: true },
  ])('$code の画面', ({ code, title, canRetry }) => {
    render(<ErrorPage code={code} />);

    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();

    const retry = screen.queryByRole('button', { name: '読み込みなおす' });

    if (canRetry) {
      expect(retry).toBeInTheDocument();
    } else {
      expect(retry).toBeNull();
    }
  });

  it.each([
    { path: '/admin/foo', href: '/admin/dashboard' },
    { path: '/app/foo', href: '/app/dashboard' },
  ])('$path では $href へ戻る', ({ path, href }) => {
    window.history.pushState({}, '', path);
    render(<ErrorPage code={404} />);
    expect(screen.getByRole('link', { name: 'ダッシュボードへ戻る' })).toHaveAttribute(
      'href',
      href,
    );
  });
});
