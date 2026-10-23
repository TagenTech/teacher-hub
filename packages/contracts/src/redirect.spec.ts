import { safeNext } from './redirect';

describe('safeNext (anti open redirect)', () => {
  it.each([
    ['/agenda', '/agenda'],
    ['/alunos/123?aba=aulas#x', '/alunos/123?aba=aulas#x'],
    [null, '/hoje'],
    ['', '/hoje'],
    ['https://evil.com', '/hoje'],
    ['//evil.com', '/hoje'],
    ['/\\evil.com', '/hoje'],
    ['/\\/evil.com', '/hoje'],
    ['javascript:alert(1)', '/hoje'],
    ['/%2F%2Fevil.com', '/%2F%2Fevil.com'],
  ])('%p → %p', (input, expected) => expect(safeNext(input)).toBe(expected));
});
