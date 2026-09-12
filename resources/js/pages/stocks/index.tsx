import { faChevronRight, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link } from '@inertiajs/react';
import type { Stock } from '@/features/stock/types';
import settingsRoutes from '@/routes/settings';
import stockRoutes from '@/routes/stocks';
import { CategoryIcon } from '@/shared/components/CategoryIcon';
import { Pagination } from '@/shared/components/Pagination';
import { Button } from '@/shared/components/ui/button';
import { AppShell } from '@/shared/layouts/AppShell';
import { formatMonthDay } from '@/shared/lib/date';
import type { Paginated } from '@/shared/types/pagination';

type Props = {
  stocks: Paginated<Stock>;
};

export default function Stocks({ stocks }: Props) {
  return (
    <AppShell title="ストック管理" active="settings" backHref={settingsRoutes.index.url()}>
      {/* 追加ボタンは画面に固定されているので、最後の行がその下に隠れないよう余白を足す */}
      <div className="max-w-3xl pb-20 md:pb-0">
        {stocks.data.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-line-strong bg-surface p-8 text-center">
            <p className="text-ink-muted">登録されているストックはありません</p>
            <Button asChild>
              <Link href={stockRoutes.create.url()}>
                <FontAwesomeIcon icon={faPlus} />
                ストックを追加
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <p className="mb-2 text-right text-xs text-ink-muted">
              <span className="font-numeric">{stocks.total}</span>件
            </p>

            <ul className="overflow-hidden rounded-xl border border-line bg-surface">
              {stocks.data.map((stock) => (
                <li key={stock.id} className="border-b border-line last:border-b-0">
                  <Link
                    href={stockRoutes.edit.url(stock.id)}
                    className="flex items-center gap-4 p-4 hover:bg-primary-50"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                      <CategoryIcon category={stock.product.category?.name} className="h-4 w-4" />
                    </span>

                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium text-ink">{stock.product.name}</span>
                      <span className="text-xs text-ink-muted">
                        残り<span className="font-numeric">{stock.quantity}</span>個・次回{' '}
                        {formatMonthDay(stock.next_purchase_date)}
                      </span>
                    </span>

                    {stock.quantity === 1 && (
                      <span className="shrink-0 rounded-full bg-urgent-50 px-2 text-xs font-medium text-urgent-700">
                        残り1
                      </span>
                    )}

                    <FontAwesomeIcon
                      icon={faChevronRight}
                      className="h-4 w-4 shrink-0 text-ink-muted"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        <Pagination meta={stocks} />
      </div>

      {stocks.data.length > 0 && (
        <Button
          asChild
          size="icon-lg"
          className="fixed right-4 bottom-24 rounded-full shadow-lg md:right-8 md:bottom-8"
        >
          <Link href={stockRoutes.create.url()} aria-label="ストックを追加">
            <FontAwesomeIcon icon={faPlus} className="h-5 w-5" />
          </Link>
        </Button>
      )}
    </AppShell>
  );
}
