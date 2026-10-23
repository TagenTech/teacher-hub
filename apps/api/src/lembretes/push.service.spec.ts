import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import * as webpush from 'web-push';
import type { PushSubscriptionEntity } from './entities/push-subscription.entity';
import { PushService } from './push.service';

jest.mock('web-push', () => ({ setVapidDetails: jest.fn(), sendNotification: jest.fn() }));

describe('PushService.send', () => {
  const send = webpush.sendNotification as jest.Mock;
  const sub = (id: string, endpoint: string) => ({ id, teacherId: 't1', endpoint, p256dh: 'p', auth: 'a' }) as PushSubscriptionEntity;
  let deleted: unknown[];
  let rows: PushSubscriptionEntity[];
  let service: PushService;

  const build = (vapid: { publicKey: string; privateKey: string }) => {
    const subs = {
      find: jest.fn(async () => rows),
      delete: jest.fn(async (w: unknown) => deleted.push(w)),
    } as unknown as Repository<PushSubscriptionEntity>;
    const config = { get: () => ({ subject: 'mailto:x@y.z', ...vapid }) } as unknown as ConfigService;
    const s = new PushService(subs, config);
    s.onModuleInit();
    return s;
  };

  beforeEach(() => {
    send.mockReset();
    deleted = [];
    rows = [];
    service = build({ publicKey: 'pub', privateKey: 'priv' });
  });

  it('envia para cada aparelho e conta os que receberam', async () => {
    rows = [sub('a', 'https://fcm.googleapis.com/fcm/send/1'), sub('b', 'https://web.push.apple.com/2')];
    send.mockResolvedValue({});
    const n = await service.send('t1', { title: 'Oi', body: 'b', url: '/hoje', requireInteraction: true });
    expect(n).toBe(2);
    const [target, body, opts] = send.mock.calls[0];
    expect(target).toEqual({ endpoint: 'https://fcm.googleapis.com/fcm/send/1', keys: { p256dh: 'p', auth: 'a' } });
    expect(JSON.parse(body)).toMatchObject({ title: 'Oi', url: '/hoje' });
    expect(opts).toMatchObject({ urgency: 'high', timeout: 10_000 });
  });

  it('remove inscrição expirada (404/410) e mantém a que falhou por outro motivo', async () => {
    rows = [
      sub('expirada', 'https://fcm.googleapis.com/fcm/send/1'),
      sub('sumiu', 'https://updates.push.services.mozilla.com/2'),
      sub('instavel', 'https://web.push.apple.com/3'),
    ];
    send
      .mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }))
      .mockRejectedValueOnce(Object.assign(new Error('not found'), { statusCode: 404 }))
      .mockRejectedValueOnce(Object.assign(new Error('timeout'), { statusCode: 500 }));
    expect(await service.send('t1', { title: 'x', body: 'y', url: '/' })).toBe(0);
    expect(deleted).toEqual([{ id: 'expirada' }, { id: 'sumiu' }]);
  });

  it('nunca chama endereço fora da lista de serviços de push (anti-SSRF)', async () => {
    rows = [sub('mal', 'https://169.254.169.254/latest'), sub('ok', 'https://fcm.googleapis.com/fcm/send/1')];
    send.mockResolvedValue({});
    expect(await service.send('t1', { title: 'x', body: 'y', url: '/' })).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('sem chaves VAPID não envia nada', async () => {
    service = build({ publicKey: '', privateKey: '' });
    rows = [sub('a', 'https://fcm.googleapis.com/fcm/send/1')];
    expect(await service.send('t1', { title: 'x', body: 'y', url: '/' })).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });
});
