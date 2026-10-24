import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as webpush from 'web-push';
import type { PushPayload, PushStatusDto } from '@turmei/contracts';
import type { AppConfig } from '../config/configuration';
import { SubscribeDto } from './dto/push.dto';
import { isAllowedPushEndpoint } from './push-endpoint';
import { PushSubscriptionEntity } from './entities/push-subscription.entity';

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private enabled = false;

  constructor(
    @InjectRepository(PushSubscriptionEntity) private readonly subs: Repository<PushSubscriptionEntity>,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const v = this.config.get<AppConfig['vapid']>('vapid')!;
    if (v.publicKey && v.privateKey) {
      webpush.setVapidDetails(v.subject, v.publicKey, v.privateKey);
      this.enabled = true;
    } else {
      this.logger.warn('VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY ausentes — notificações push desligadas');
    }
  }

  async status(teacherId: string): Promise<PushStatusDto> {
    const devices = await this.subs.find({ where: { teacherId }, order: { lastSeenAt: 'DESC' } });
    return {
      publicKey: this.enabled ? this.config.get<AppConfig['vapid']>('vapid')!.publicKey : null,
      enabled: this.enabled,
      devices: devices.map((d) => ({ id: d.id, deviceLabel: d.deviceLabel, lastSeenAt: d.lastSeenAt.toISOString() })),
    };
  }

  async subscribe(teacherId: string, dto: SubscribeDto) {
    const existing = await this.subs.findOne({ where: { endpoint: dto.endpoint } });
    // Um aparelho por conta: se o navegador mudar de conta, a inscrição passa para a nova.
    await this.subs.save(
      this.subs.create({
        ...(existing ?? {}),
        teacherId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        deviceLabel: dto.deviceLabel ?? existing?.deviceLabel ?? null,
        lastSeenAt: new Date(),
      }),
    );
  }

  async unsubscribe(teacherId: string, endpoint: string) {
    await this.subs.delete({ teacherId, endpoint });
  }

  /** Envia para todos os aparelhos do professor; remove inscrições expiradas. Retorna quantos receberam. */
  async send(teacherId: string, payload: PushPayload): Promise<number> {
    if (!this.enabled) return 0;
    const list = (await this.subs.find({ where: { teacherId } })).filter((s) => isAllowedPushEndpoint(s.endpoint));
    let ok = 0;
    await Promise.all(
      list.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(payload),
            { TTL: 60 * 60, urgency: payload.requireInteraction ? 'high' : 'normal', timeout: 10_000 },
          );
          ok++;
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await this.subs.delete({ id: s.id });
          else this.logger.warn(`Falha no push (${code ?? '?'}): ${(err as Error).message}`);
        }
      }),
    );
    return ok;
  }
}
