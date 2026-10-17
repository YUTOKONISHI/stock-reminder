import { ja } from 'date-fns/locale';
import { DueStockRow } from '@/features/stock/components/DueStockRow';
import type { Stock } from '@/features/stock/types';
import { Calendar } from '@/shared/components/ui/calendar';
import { Card, CardContent } from '@/shared/components/ui/card';
import { AppShell } from '@/shared/layouts/AppShell';
import {
  daysUntil,
  formatMonthDayWithWeekday,
  isToday,
  isWithinDays,
  toDate,
} from '@/shared/lib/date';

type Props = {
  stocks: Stock[];
};

const CALENDAR_CLASS_NAMES = {
  root: 'w-full',
  weekdays: 'flex [&>th:first-child]:text-danger-600 [&>th:last-child]:text-info-600',
  day: 'relative aspect-square w-full p-0 flex items-center justify-center',
};

/* 円は背景をセルの内側に切り詰めて描く。p-1.5 と bg-clip-content で四角の枠より内側に
 * 収まるので、同じ色でも枠と重ならない。padding は絶対配置の ::before を動かさない。 */
const TODAY_PLAIN =
  '[&[data-today]]:rounded-full [&[data-today]]:bg-primary-600 [&[data-today]]:bg-clip-content [&[data-today]]:p-1.5 [&[data-today]]:text-white';

/* 今日が予定日のときは緑の丸を出さず、下の一覧と同じ差し色の枠で示す。
 * 丸と枠を重ねると二重の輪になって、どちらが予定日か読めない。 */
const TODAY_DUE =
  "[&[data-today]]:font-bold [&[data-today]]:text-urgent-700 before:absolute before:inset-0.5 before:rounded-md before:border-2 before:border-urgent-600 before:content-['']";

const CALENDAR_MODIFIER_CLASS_NAMES = {
  /* 四角の枠は ::before で描く。outline や border はセル自身の border-radius に従うため、
   * 今日と重なると rounded-full に引きずられて円になる。 */
  purchase:
    "before:absolute before:inset-0.5 before:rounded-md before:border-2 before:border-primary-600 before:content-['']",
  overdue:
    "font-bold text-urgent-700 before:absolute before:inset-0.5 before:rounded-md before:border-2 before:border-urgent-600 before:content-['']",
  sunday: 'text-danger-600 [&[data-outside]]:text-ink-muted',
  saturday: 'text-info-600 [&[data-outside]]:text-ink-muted',
};

export default function Dashboard({ stocks }: Props) {
  const todayIsDue = stocks.some((stock) => isToday(stock.next_purchase_date));

  /* 予定日を過ぎたものも今日買うべきものなので、同じ数字に入れる。
   * 当日ちょうどだけを数えると、超過が1件もないときと同じ 0 になって見分けが付かない。 */
  const dueTodayStocks = stocks.filter((stock) => daysUntil(stock.next_purchase_date) <= 0);

  /* 今日ぶんは today 側で描くので purchase からは外す。両方当てると枠が二重になる。
   * 過ぎた日は一覧と同じ差し色にする。緑のままだと、同じ日が一覧では超過、
   * カレンダーでは予定どおりに見える。 */
  const purchaseDates = stocks
    .filter(
      (stock) => !isToday(stock.next_purchase_date) && daysUntil(stock.next_purchase_date) > 0,
    )
    .map((stock) => toDate(stock.next_purchase_date));

  const overdueStocks = stocks.filter((stock) => daysUntil(stock.next_purchase_date) < 0);
  const overdueDates = overdueStocks.map((stock) => toDate(stock.next_purchase_date));
  const isOverdue = overdueStocks.length > 0;

  /** next_purchase_date は YYYY-MM-DD なので、文字列のまま比べれば日付順になる。 */
  const nextPurchaseDate =
    stocks.length > 0
      ? stocks.map((stock) => stock.next_purchase_date).reduce((a, b) => (a < b ? a : b))
      : null;

  /** カレンダーと次回購入日は全件を見る。購入予定品は1週間先までに絞る。 */
  const dueStocks = stocks.filter((stock) => isWithinDays(stock.next_purchase_date, 7));

  return (
    <AppShell title="ダッシュボード" active="dashboard">
      <Card className="mb-8">
        <CardContent className="flex flex-col gap-2">
          {/* 予定日を過ぎたものがあると、最小値である次回購入日も過去になる。
              「次回購入日」のままだと言葉と中身が食い違うので、見出しごと言い換える。 */}
          <p className={isOverdue ? 'text-xs font-bold text-urgent-700' : 'text-xs text-ink-muted'}>
            {isOverdue ? '買い忘れ' : '次回購入日'}
          </p>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <p className={`text-3xl font-bold ${isOverdue ? 'text-urgent-700' : 'text-ink'}`}>
                {nextPurchaseDate ? formatMonthDayWithWeekday(nextPurchaseDate) : '未設定'}
              </p>
              {isOverdue && nextPurchaseDate && (
                <span className="rounded-full bg-urgent-600 px-2 text-xs font-medium text-white">
                  <span className="font-numeric">{-daysUntil(nextPurchaseDate)}</span>日超過
                </span>
              )}
            </div>
            <div className="flex gap-6">
              <p className="flex flex-col">
                <span
                  className={`font-numeric text-2xl font-bold ${dueTodayStocks.length > 0 ? 'text-urgent-600' : 'text-ink'}`}
                >
                  {dueTodayStocks.length}
                </span>
                <span className="text-xs text-ink-muted">今日まで</span>
              </p>
              <p className="flex flex-col">
                <span className="font-numeric text-2xl font-bold text-ink">{dueStocks.length}</span>
                <span className="text-xs text-ink-muted">1週間以内</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="md:grid md:grid-cols-2 md:gap-8">
        <Card className="mb-8 md:mb-0">
          <CardContent>
            <Calendar
              locale={ja}
              className="w-full p-0"
              classNames={{
                ...CALENDAR_CLASS_NAMES,
                today: todayIsDue ? TODAY_DUE : TODAY_PLAIN,
              }}
              modifiers={{
                purchase: purchaseDates,
                overdue: overdueDates,
                sunday: { dayOfWeek: [0] },
                saturday: { dayOfWeek: [6] },
              }}
              modifiersClassNames={CALENDAR_MODIFIER_CLASS_NAMES}
            />
          </CardContent>
        </Card>

        <section>
          <h2 className="mb-4 text-xl font-bold text-ink">購入予定品</h2>
          {dueStocks.length === 0 ? (
            <p className="text-ink-muted">1週間以内に購入予定の品はありません</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {dueStocks.map((stock) => (
                <DueStockRow key={stock.id} stock={stock} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
