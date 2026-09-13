import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link, usePage } from '@inertiajs/react';
import { cn } from '@/shared/lib/utils';
import type { PaginationMeta } from '@/shared/types/pagination';

type Props = {
  meta: PaginationMeta;
  className?: string;
};

type PageItem = number | 'gap';

/** 先頭と末尾を除いて現在ページの前後に並べる数 */
const NEIGHBORS = 1;

/** 省略記号を出さずに全ページを並べられる上限 */
const WITHOUT_GAP = 7;

export function Pagination({ meta, className }: Props) {
  const { url } = usePage();

  if (meta.last_page <= 1) {
    return null;
  }

  const previous = meta.current_page - 1;
  const next = meta.current_page + 1;

  return (
    <nav aria-label="ページ送り" className={cn('mt-8 flex flex-col items-center gap-2', className)}>
      <ul className="flex items-center gap-2">
        <li>
          <Arrow
            href={pageUrl(url, previous)}
            disabled={previous < 1}
            label="前のページ"
            icon={<FontAwesomeIcon icon={faChevronLeft} className="h-4 w-4" />}
          />
        </li>

        {pageItems(meta.current_page, meta.last_page).map((item, index) =>
          item === 'gap' ? (
            <li key={`gap-${index}`} aria-hidden="true" className="px-2 text-ink-muted">
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                href={pageUrl(url, item)}
                aria-current={item === meta.current_page ? 'page' : undefined}
                aria-label={`${item}ページ目`}
                className={cn(
                  'flex h-8 min-w-8 items-center justify-center rounded-md px-2 transition',
                  item === meta.current_page
                    ? 'bg-primary-600 text-white'
                    : 'text-ink hover:bg-primary-50',
                )}
              >
                {item}
              </Link>
            </li>
          ),
        )}

        <li>
          <Arrow
            href={pageUrl(url, next)}
            disabled={next > meta.last_page}
            label="次のページ"
            icon={<FontAwesomeIcon icon={faChevronRight} className="h-4 w-4" />}
          />
        </li>
      </ul>

      <p className="text-xs text-ink-muted">
        {meta.total}件中 {meta.from ?? 0}件目から{meta.to ?? 0}件目
      </p>
    </nav>
  );
}

function Arrow({
  href,
  disabled,
  label,
  icon,
}: {
  href: string;
  disabled: boolean;
  label: string;
  icon: React.ReactNode;
}) {
  const shape = 'flex h-8 w-8 items-center justify-center rounded-md';

  if (disabled) {
    return (
      <span aria-hidden="true" className={cn(shape, 'text-line-strong')}>
        {icon}
      </span>
    );
  }

  return (
    <Link href={href} aria-label={label} className={cn(shape, 'text-ink hover:bg-primary-50')}>
      {icon}
    </Link>
  );
}

/**
 * 今のURLのクエリを保ったまま page だけ差し替える。
 * 管理画面の絞り込みのように、ページ送りで落としてはいけない条件がある。
 */
function pageUrl(currentUrl: string, page: number): string {
  const [path, query] = currentUrl.split('?');
  const params = new URLSearchParams(query);

  params.set('page', String(page));

  return `${path}?${params.toString()}`;
}

function pageItems(current: number, last: number): PageItem[] {
  if (last <= WITHOUT_GAP) {
    return range(1, last);
  }

  const start = Math.max(2, current - NEIGHBORS);
  const end = Math.min(last - 1, current + NEIGHBORS);

  return [
    1,
    ...(start > 2 ? (['gap'] as PageItem[]) : []),
    ...range(start, end),
    ...(end < last - 1 ? (['gap'] as PageItem[]) : []),
    last,
  ];
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}
