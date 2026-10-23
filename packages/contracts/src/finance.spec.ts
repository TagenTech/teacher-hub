import { chargeStatus, fillTemplate } from './finance';
import { attendanceDefaults, overlappingIds } from './lessons';
import { latenessScore, payerBadge } from './reports';

const c = { amountCents: 28000, discountCents: 0, dueDate: '2026-10-10', canceledAt: null };

describe('chargeStatus', () => {
  it('deriva o status', () => {
    expect(chargeStatus(c, 0, '2026-10-09')).toBe('PENDENTE');
    expect(chargeStatus(c, 10000, '2026-10-09')).toBe('PARCIAL');
    expect(chargeStatus(c, 10000, '2026-10-11')).toBe('ATRASADO');
    expect(chargeStatus(c, 28000, '2026-10-30')).toBe('PAGO');
    expect(chargeStatus({ ...c, discountCents: 3000 }, 25000, '2026-10-30')).toBe('PAGO');
    expect(chargeStatus({ ...c, canceledAt: new Date() }, 0, '2026-10-30')).toBe('CANCELADO');
  });
});

describe('attendanceDefaults', () => {
  it('segue a tabela do plano', () => {
    expect(attendanceDefaults('REALIZADA')).toEqual({ chargeable: true, makeup: false });
    expect(attendanceDefaults('FALTA_ALUNO')).toEqual({ chargeable: true, makeup: false });
    expect(attendanceDefaults('FALTA_ALUNO', true)).toEqual({ chargeable: false, makeup: true });
    expect(attendanceDefaults('FALTA_PROFESSOR')).toEqual({ chargeable: false, makeup: true });
    expect(attendanceDefaults('CANCELADA')).toEqual({ chargeable: false, makeup: false });
  });
});

describe('overlappingIds', () => {
  it('detecta conflito', () => {
    const l = (id: string, s: string, e: string) => ({ id, startsAt: s, endsAt: e, status: 'AGENDADA' as const });
    const ids = overlappingIds([
      l('a', '2026-10-23T10:00:00Z', '2026-10-23T11:00:00Z'),
      l('b', '2026-10-23T10:30:00Z', '2026-10-23T11:30:00Z'),
      l('c', '2026-10-23T11:30:00Z', '2026-10-23T12:00:00Z'),
    ]);
    expect([...ids].sort()).toEqual(['a', 'b']);
  });
});

describe('ranking de atraso', () => {
  it('pontua e classifica', () => {
    expect(payerBadge(latenessScore(0, 0, false))).toBe('EM_DIA');
    expect(payerBadge(latenessScore(50, 5, false))).toBe('AS_VEZES');
    expect(payerBadge(latenessScore(100, 20, true))).toBe('SEMPRE');
  });
});

describe('fillTemplate', () => {
  it('troca variáveis e mantém as desconhecidas', () => {
    expect(fillTemplate('Oi {nome}, {x}', { nome: 'Ana' })).toBe('Oi Ana, {x}');
  });
});
