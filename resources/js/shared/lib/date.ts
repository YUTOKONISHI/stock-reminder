import {
  addDays,
  differenceInCalendarDays,
  format,
  isToday as isTodayFns,
  parseISO,
} from 'date-fns';
import { ja } from 'date-fns/locale';

export function toDate(value: string): Date {
  return parseISO(value);
}

/** 2026/09/06 */
export function formatDate(value: string): string {
  return format(parseISO(value), 'yyyy/MM/dd');
}

/** 9月6日。年をまたいで残らない近い日付にだけ使う */
export function formatMonthDay(value: string): string {
  return format(parseISO(value), 'M月d日');
}

/** 9月6日(日) */
export function formatMonthDayWithWeekday(value: string): string {
  return format(parseISO(value), 'M月d日(EEE)', { locale: ja });
}

/** 2026/09/06(日) */
export function formatDateWithWeekday(value: string): string {
  return format(parseISO(value), 'yyyy/MM/dd(EEE)', { locale: ja });
}

/** input[type=date] の value に渡す形式 */
export function toDateInputValue(value: string): string {
  return format(parseISO(value), 'yyyy-MM-dd');
}

export function isToday(value: string): boolean {
  return isTodayFns(parseISO(value));
}

/** 今日から days 日後までに来る日付か。過ぎた日付も含む */
export function isWithinDays(value: string, days: number): boolean {
  return value <= format(addDays(new Date(), days), 'yyyy-MM-dd');
}

/** 今日から value までの日数。過ぎていれば負になる */
export function daysUntil(value: string): number {
  return differenceInCalendarDays(parseISO(value), new Date());
}
