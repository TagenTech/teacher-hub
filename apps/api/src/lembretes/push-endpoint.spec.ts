import { isAllowedPushEndpoint } from './push-endpoint';

describe('isAllowedPushEndpoint (anti-SSRF)', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc123',
    'https://updates.push.services.mozilla.com/wpush/v2/xyz',
    'https://web.push.apple.com/QH8xyz',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
  ])('aceita serviço oficial %s', (u) => expect(isAllowedPushEndpoint(u)).toBe(true));

  it.each([
    'http://fcm.googleapis.com/fcm/send/abc', // sem TLS
    'https://169.254.169.254/latest/meta-data', // metadados da nuvem
    'https://localhost:3200/v1/health',
    'https://postgres:5432/',
    'https://fcm.googleapis.com.evil.com/x', // sufixo enganoso
    'https://user:pass@fcm.googleapis.com/x',
    'https://fcm.googleapis.com:8443/x',
    'javascript:alert(1)',
    'nao-e-url',
  ])('recusa %s', (u) => expect(isAllowedPushEndpoint(u)).toBe(false));
});
