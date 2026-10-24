import { addDays, addMonths, firstDayOf, lastDayOf, monthOf, type IsoDate } from '@turmei/contracts';

export const PERIODS = [
  { v: 'mes', l: 'Este mês' },
  { v: 'mes-passado', l: 'Mês passado' },
  { v: '3-meses', l: '3 meses' },
  { v: '6-meses', l: '6 meses' },
  { v: 'ano', l: 'Este ano' },
  { v: 'personalizado', l: 'Escolher datas' },
] as const;

export function periodRange(period: string, today: IsoDate, custom?: { from?: string; to?: string }): { from: IsoDate; to: IsoDate } {
  const m = monthOf(today);
  switch (period) {
    case 'mes-passado':
      return { from: firstDayOf(addMonths(m, -1)), to: lastDayOf(addMonths(m, -1)) };
    case '3-meses':
      return { from: firstDayOf(addMonths(m, -2)), to: lastDayOf(m) };
    case '6-meses':
      return { from: firstDayOf(addMonths(m, -5)), to: lastDayOf(m) };
    case 'ano':
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
    case 'personalizado':
      return { from: custom?.from ?? addDays(today, -30), to: custom?.to ?? today };
    default:
      return { from: firstDayOf(m), to: lastDayOf(m) };
  }
}
