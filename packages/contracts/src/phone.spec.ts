import { formatPhone, isValidPhone, normalizePhone, whatsappLink } from './phone';

describe('phone', () => {
  it('normaliza e remove DDI 55', () => {
    expect(normalizePhone('+55 (11) 98765-4321')).toBe('11987654321');
  });
  it('valida celular e fixo', () => {
    expect(isValidPhone('11987654321')).toBe(true);
    expect(isValidPhone('1133334444')).toBe(true);
    expect(isValidPhone('1198765')).toBe(false);
  });
  it('mascara progressivamente', () => {
    expect(formatPhone('11')).toBe('(11');
    expect(formatPhone('119876')).toBe('(11) 9876');
    expect(formatPhone('1133334444')).toBe('(11) 3333-4444');
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321');
  });
  it('gera link do WhatsApp', () => {
    expect(whatsappLink('11987654321', 'Oi!')).toBe('https://wa.me/5511987654321?text=Oi!');
  });
});
