import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { markStockAsPurchased } from '@/features/stock/api';
import type { Stock } from '@/features/stock/types';
import { CategoryIcon } from '@/shared/components/CategoryIcon';
import { Button } from '@/shared/components/ui/button';
import { daysUntil, formatMonthDay } from '@/shared/lib/date';

type Props = {
  stock: Stock;
};

/** 予定日までの日数を「今日」「3日超過」「あと2日」に言い換える */
function describeDue(days: number): string {
  if (days === 0) {
    return '今日';
  }

  if (days < 0) {
    return `${-days}日超過`;
  }

  return `あと${days}日`;
}

export function DueStockRow({ stock }: Props) {
  const days = daysUntil(stock.next_purchase_date);
  const isUrgent = days <= 0;

  return (
    <li
      className={
        isUrgent
          ? 'flex items-center gap-4 rounded-lg border border-urgent-600 bg-urgent-50 p-4'
          : 'flex items-center gap-4 rounded-lg border border-line bg-surface p-4'
      }
    >
      <span
        className={
          isUrgent
            ? 'flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface text-urgent-700'
            : 'flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700'
        }
      >
        <CategoryIcon category={stock.product.category?.name} className="h-5 w-5" />
      </span>

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium text-ink">{stock.product.name}</span>
        <span
          className={isUrgent ? 'text-xs font-medium text-urgent-700' : 'text-xs text-ink-muted'}
        >
          {formatMonthDay(stock.next_purchase_date)}・{describeDue(days)}
        </span>
      </span>

      <Button
        type="button"
        variant={isUrgent ? 'urgent' : 'outline'}
        aria-label={`「${stock.product.name}」を購入済みにする`}
        onClick={() => markStockAsPurchased(stock.id)}
      >
        <FontAwesomeIcon icon={faCheck} />
        買った
      </Button>
    </li>
  );
}
