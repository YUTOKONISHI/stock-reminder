import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { PaginationMeta } from '@/shared/types/pagination';
import { Pagination } from './Pagination';

vi.mock('@inertiajs/react', () => ({
  usePage: () => ({ url: '/admin/dashboard?categories=1&page=3' }),
  Link: ({ href, children, ...props }: ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function meta(overrides: Partial<PaginationMeta> = {}): PaginationMeta {
  return {
    current_page: 1,
    last_page: 10,
    per_page: 50,
    total: 500,
    from: 1,
    to: 50,
    ...overrides,
  };
}

describe('表示の有無', () => {
  it('1ページしか無ければ何も出さない', () => {
    render(<Pagination meta={meta({ last_page: 1 })} />);
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});

describe('ページ番号の組み立て', () => {
  it('7ページまでは省略記号を出さずに全部並べる', () => {
    render(<Pagination meta={meta({ last_page: 7 })} />);
    const pages = screen.getAllByRole('link', { name: /ページ目$/ });
    expect(pages.map((link) => link.textContent)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    expect(screen.queryAllByText('…')).toHaveLength(0);
  });

  it('先頭寄りなら後ろだけ省略する', () => {
    render(<Pagination meta={meta({ current_page: 2, last_page: 10 })} />);
    const pages = screen.getAllByRole('link', { name: /ページ目$/ });
    expect(pages.map((link) => link.textContent)).toEqual(['1', '2', '3', '10']);
    expect(screen.queryAllByText('…')).toHaveLength(1);
  });

  it('中ほどなら前後とも省略する', () => {
    render(<Pagination meta={meta({ current_page: 5, last_page: 10 })} />);
    const pages = screen.getAllByRole('link', { name: /ページ目$/ });
    expect(pages.map((link) => link.textContent)).toEqual(['1', '4', '5', '6', '10']);
    expect(screen.queryAllByText('…')).toHaveLength(2);
  });

  it('末尾寄りなら前だけ省略する', () => {
    render(<Pagination meta={meta({ current_page: 9, last_page: 10 })} />);
    const pages = screen.getAllByRole('link', { name: /ページ目$/ });
    expect(pages.map((link) => link.textContent)).toEqual(['1', '8', '9', '10']);
    expect(screen.queryAllByText('…')).toHaveLength(1);
  });

  it('現在のページに aria-current を付ける', () => {
    render(<Pagination meta={meta({ current_page: 5, last_page: 10 })} />);

    expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent('5');
    expect(screen.getByRole('link', { name: '4ページ目' })).not.toHaveAttribute('aria-current');
  });
});

describe('前後の矢印', () => {
  it('先頭では前へ進めない', () => {
    render(<Pagination meta={meta()} />);

    expect(screen.queryByRole('link', { name: '前のページ' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '次のページ' })).toBeInTheDocument();
  });

  it('末尾では次へ進めない', () => {
    render(<Pagination meta={meta({ current_page: 10 })} />);

    expect(screen.getByRole('link', { name: '前のページ' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '次のページ' })).not.toBeInTheDocument();
  });
});

describe('リンク先', () => {
  it('今のクエリを保ったまま page だけ差し替える', () => {
    render(<Pagination meta={meta({ current_page: 3 })} />);

    expect(screen.getByRole('link', { name: '4ページ目' })).toHaveAttribute(
      'href',
      '/admin/dashboard?categories=1&page=4',
    );
  });
});

describe('件数の表示', () => {
  it('全件数と表示中の範囲を出す', () => {
    render(<Pagination meta={meta({ total: 500, from: 51, to: 100 })} />);

    expect(screen.getByText('500件中 51件目から100件目')).toBeInTheDocument();
  });

  it('件数が無ければ0件目と出す', () => {
    render(<Pagination meta={meta({ from: null, to: null })} />);

    expect(screen.getByText('500件中 0件目から0件目')).toBeInTheDocument();
  });
});
