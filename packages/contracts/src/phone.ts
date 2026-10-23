/** Telefones brasileiros guardados só com dígitos (DDD + número): '11987654321'. */

export function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, '');
  if (digits.length > 11 && digits.startsWith('55')) digits = digits.slice(2);
  return digits;
}

export function isValidPhone(digits: string): boolean {
  return /^[1-9]\d(9\d{8}|[2-8]\d{7})$/.test(digits);
}

/** Máscara progressiva para digitação: '1198765' → '(11) 9876-5'. */
export function formatPhone(input: string): string {
  const d = normalizePhone(input).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Link do WhatsApp (com DDI 55), opcionalmente com mensagem pronta. */
export function whatsappLink(digits: string, text?: string): string {
  const base = `https://wa.me/55${normalizePhone(digits)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
