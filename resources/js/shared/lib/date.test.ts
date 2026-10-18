import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  daysUntil,
  formatDate,
  formatDateWithWeekday,
  formatMonthDay,
  formatMonthDayWithWeekday,
  isToday,
  isWithinDays,
  toDateInputValue,
} from './date';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-23T09:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('isWithinDays', () => {
  it('当日は含む', () => {
    expect(isWithinDays('2026-09-23', 7)).toBe(true);
  });

  it('ちょうど7日後は含む', () => {
    expect(isWithinDays('2026-09-30', 7)).toBe(true);
  });

  it('8日後は含まない', () => {
    expect(isWithinDays('2026-10-01', 7)).toBe(false);
  });

  it('過ぎた日付も含む', () => {
    expect(isWithinDays('2026-09-20', 7)).toBe(true);
  });
});

describe('daysUntil', () => {
  it('先の日付は正の数になる', () => {
    expect(daysUntil('2026-09-24')).toBe(1);
  });

  it('過ぎた日付は負の数になる', () => {
    expect(daysUntil('2026-09-22')).toBe(-1);
  });

  it('当日は0になる', () => {
    expect(daysUntil('2026-09-23')).toBe(0);
  });
});

describe('isToday', () => {
  it('当日は true になる', () => {
    expect(isToday('2026-09-23')).toBe(true);
  });

  it('当日以外は false になる', () => {
    expect(isToday('2026-09-24')).toBe(false);
  });
});

describe('書式', () => {
  it('formatDate は 2026/09/06 の形にする', () => {
    expect(formatDate('2026-09-06T09:00:00')).toBe('2026/09/06');
  });

  it('formatMonthDay は 9月6日 の形にする', () => {
    expect(formatMonthDay('2026-09-06T09:00:00')).toBe('9月6日');
  });

  it('formatMonthDayWithWeekday は曜日を日本語で付ける', () => {
    expect(formatMonthDayWithWeekday('2026-09-06T09:00:00')).toBe('9月6日(日)');
  });

  it('formatDateWithWeekday は曜日を日本語で付ける', () => {
    expect(formatDateWithWeekday('2026-09-06T09:00:00')).toBe('2026/09/06(日)');
  });

  it('toDateInputValue は input[type=date] に渡せる形にする', () => {
    expect(toDateInputValue('2026-09-06T09:00:00')).toBe('2026-09-06');
  });
});
