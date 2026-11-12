import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, timingSafeEqual, createHash } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { Teacher } from '../professor/entities/teacher.entity';
import { SessionRevocationService } from '../security/session-revocation.service';
import type { AppConfig } from '../config/configuration';
import { WebhookEvent } from './entities/webhook-event.entity';

const REPLAY_WINDOW_S = 300;

interface EntitlementPayload {
  event_id?: string;
  event?: string;
  occurred_at?: string;
  version?: number;
  product?: string;
  sent_at?: string;
  entitlement?: {
    id?: string;
    external_ref?: string | null;
    name?: string;
    email?: string | null;
    plan?: string | null;
    seats_limit?: number | null;
    status?: string;
  };
}

/**
 * Recebe os eventos de liberação de contas do backoffice Tagen.
 * Segurança: HMAC-SHA256 sobre `${ts}.${body bruto}` com comparação em tempo
 * constante, janela de replay de 5 min, eventos em lista fechada e dedupe por
 * entrega — sem nada disso, o evento nem chega a ser processado.
 */
@Injectable()
export class EntitlementsWebhookService {
  private readonly logger = new Logger(EntitlementsWebhookService.name);

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly db: DataSource,
    private readonly revocation: SessionRevocationService,
    @InjectRepository(WebhookEvent) private readonly events: Repository<WebhookEvent>,
    @InjectRepository(Teacher) private readonly teachers: Repository<Teacher>,
  ) {}

  async handle(rawBody: Buffer | undefined, timestamp: string | undefined, signature: string | undefined) {
    const secret = this.config.get('entitlements.secret', { infer: true });
    if (!secret) {
      this.logger.error('TAGEN_ENTITLEMENTS_SECRET não configurado; webhook recusado');
      throw new UnauthorizedException('webhook disabled');
    }
    if (!rawBody?.length || !timestamp || !signature) {
      throw new BadRequestException('missing signature');
    }

    // Replay: timestamp precisa estar dentro da janela.
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > REPLAY_WINDOW_S) {
      throw new UnauthorizedException('stale timestamp');
    }

    const body = rawBody.toString('utf8');
    const expected = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest();
    const got = signature.startsWith('v1=') ? signature.slice(3) : signature;
    let gotBuf: Buffer;
    try {
      gotBuf = Buffer.from(got, 'hex');
    } catch {
      throw new UnauthorizedException('bad signature');
    }
    if (gotBuf.length !== expected.length || !timingSafeEqual(gotBuf, expected)) {
      throw new UnauthorizedException('bad signature');
    }

    let payload: EntitlementPayload;
    try {
      payload = JSON.parse(body);
    } catch {
      throw new BadRequestException('invalid_json');
    }

    // Produto errado não processa aqui (o mesmo endpoint existe em cada app).
    if (payload.product !== this.config.get('entitlements.productSlug', { infer: true })) {
      return { ok: true, ignored: true };
    }

    const event = String(payload.event ?? '');
    // Ping de teste do backoffice: valida rota + assinatura sem tocar no banco.
    if (event === 'integration.ping') return { ok: true, ping: true };
    const allowed = new Set([
      'entitlement.created',
      'entitlement.activated',
      'entitlement.suspended',
      'entitlement.cancelled',
      'entitlement.updated',
    ]);
    if (!allowed.has(event)) {
      throw new BadRequestException('unknown_event');
    }

    const ent = payload.entitlement ?? {};
    // Dedupe pelo event_id do contrato; fallback no hash da entrega para
    // integrações antigas que ainda não enviam event_id.
    const dedupeKey = payload.event_id
      ? `evt_${payload.event_id}`
      : createHash('sha256')
          .update(`${timestamp}.${event}.${ent.id ?? ''}.${payload.sent_at ?? ''}`)
          .digest('hex');

    // Dedupe dentro de transação: insert falha na unique se já processamos.
    const inserted = await this.db.query(
      'INSERT INTO turmei_webhook_events (dedupe_key, event) VALUES ($1, $2) ON CONFLICT (dedupe_key) DO NOTHING RETURNING dedupe_key',
      [dedupeKey, event],
    );
    if (!inserted.length) return { ok: true, duplicate: true };

    await this.apply(event, ent, payload.version ?? 0);
    return { ok: true };
  }

  private async apply(
    event: string,
    ent: NonNullable<EntitlementPayload['entitlement']>,
    version: number,
  ) {
    const teacher = await this.findTeacher(ent);
    if (!teacher) {
      // Conta ainda não existe no produto (signup chega pelo /api/provision).
      this.logger.log(`Evento ${event} sem professor correspondente (${ent.email ? maskEmail(ent.email) : 'sem e-mail'})`);
      return;
    }

    // Evento fora de ordem/atrasado: nunca regride o estado aplicado.
    if (version > 0 && version <= teacher.backofficeEntitlementVersion) {
      this.logger.log(`Evento ${event} v${version} ignorado (atual: v${teacher.backofficeEntitlementVersion})`);
      return;
    }

    const patch: Partial<Teacher> = {};
    if (ent.id && teacher.backofficeEntitlementId !== ent.id) {
      patch.backofficeEntitlementId = ent.id;
    }
    if (version > 0) patch.backofficeEntitlementVersion = version;
    if (Object.keys(patch).length) await this.teachers.update(teacher.id, patch);

    switch (event) {
      case 'entitlement.suspended':
      case 'entitlement.cancelled': {
        await this.teachers.update(teacher.id, { suspendedAt: new Date() });
        // Derruba todas as sessões abertas na hora.
        await this.revocation.revokeAllFor(teacher.id);
        this.logger.log(`Professor ${teacher.id} suspenso pelo backoffice (${event})`);
        break;
      }
      case 'entitlement.activated': {
        await this.teachers.update(teacher.id, { suspendedAt: null });
        this.logger.log(`Professor ${teacher.id} liberado pelo backoffice`);
        break;
      }
      default:
        // created/updated: só o vínculo acima já basta por enquanto.
        break;
    }
  }

  private async findTeacher(ent: NonNullable<EntitlementPayload['entitlement']>) {
    if (ent.id) {
      const byEnt = await this.teachers.findOne({ where: { backofficeEntitlementId: ent.id } });
      if (byEnt) return byEnt;
    }
    if (ent.external_ref) {
      const byRef = await this.teachers.findOne({ where: { id: ent.external_ref } });
      if (byRef) return byRef;
    }
    if (ent.email) {
      return this.teachers.findOne({ where: { email: ent.email.toLowerCase() } });
    }
    return null;
  }
}

function maskEmail(email: string): string {
  const [u, d] = email.split('@');
  return `${u.slice(0, 2)}***@${d ?? ''}`;
}
