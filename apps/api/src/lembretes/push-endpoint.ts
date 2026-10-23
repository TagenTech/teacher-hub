/**
 * Proteção contra SSRF: o endereço de push vem do navegador e o servidor faz requisições para ele.
 * Só aceitamos HTTPS nos serviços de push oficiais dos navegadores.
 */
const ALLOWED_HOSTS = [
  /^fcm\.googleapis\.com$/, // Chrome, Edge, Android
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /^web\.push\.apple\.com$/, // Safari / iOS
  /^[a-z0-9-]+\.push\.apple\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/, // Edge (WNS)
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && !u.port && !u.username && !u.password && ALLOWED_HOSTS.some((r) => r.test(u.hostname));
  } catch {
    return false;
  }
}
