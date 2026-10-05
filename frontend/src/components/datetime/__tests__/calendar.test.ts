import { describe, expect, it } from 'vitest';
import { addDays, addMonths, monthGrid, monthTitle, sameDay, stepTime, summary, withTime } from '../calendar';

describe('calendar', () => {
  it('builds 6 weeks starting on the Sunday on or before the 1st', () => {
    const grid = monthGrid({ year: 2026, month: 10 }); // November 2026 starts on a Sunday
    expect(grid).toHaveLength(42);
    expect(grid[0]!.toDateString()).toBe(new Date(2026, 10, 1).toDateString());
    const october = monthGrid({ year: 2026, month: 9 }); // October 1st 2026 is a Thursday
    expect(october[0]!.toDateString()).toBe(new Date(2026, 8, 27).toDateString());
    expect(october[4]!.getDate()).toBe(1);
  });

  it('moves across years and keeps the time when changing days', () => {
    expect(addMonths({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(addMonths({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    const evening = new Date(2026, 10, 30, 19, 30);
    expect(addDays(evening, 1)).toEqual(new Date(2026, 11, 1, 19, 30));
    expect(withTime(new Date(2026, 10, 20, 8), 19, 5)).toEqual(new Date(2026, 10, 20, 19, 5));
    expect(sameDay(new Date(2026, 10, 20, 1), new Date(2026, 10, 20, 23))).toBe(true);
  });

  it('formats in Portuguese', () => {
    expect(monthTitle({ year: 2026, month: 10 })).toBe('Novembro de 2026');
    expect(summary(new Date(2026, 10, 20, 19, 0))).toBe('sex., 20 de nov. de 2026 às 19:00');
  });

  it('wraps hours and minutes around', () => {
    expect(stepTime(23, 1, 24)).toBe(0);
    expect(stepTime(0, -1, 24)).toBe(23);
    expect(stepTime(55, 5, 60)).toBe(0);
  });
});
