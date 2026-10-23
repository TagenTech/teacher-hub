import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { SecurityEventType } from '@aulinha/contracts';
import { TeachersService } from '../professor/teachers.service';
import type { RequestContext } from '../security/request-context';
import { SecurityEventsService } from '../security/security-events.service';
import { SessionRevocationService } from '../security/session-revocation.service';
import { AuthService } from './auth.service';
import { DeleteAccountDto } from './dto/mfa.dto';

/** Tabelas com dados do professor, na ordem segura para apagar (filhos antes dos pais). */
const OWNED_TABLES = [
  'payments',
  'charges',
  'lessons',
  'makeup_credits',
  'recurring_slots',
  'billing_plans',
  'students',
  'schedule_blocks',
  'notification_logs',
  'push_subscriptions',
  'saved_filters',
  'refresh_tokens',
  'email_tokens',
  'mfa_recovery_codes',
  'security_events',
  'auth_identities',
];

/** Exclusão definitiva da conta e de todos os dados (LGPD, art. 18). */
@Injectable()
export class AccountService {
  constructor(
    private readonly teachers: TeachersService,
    private readonly auth: AuthService,
    private readonly events: SecurityEventsService,
    private readonly revocation: SessionRevocationService,
    private readonly db: DataSource,
  ) {}

  async deleteAccount(teacherId: string, dto: DeleteAccountDto, ctx: RequestContext = {}) {
    const t = await this.teachers.findByIdWithPassword(teacherId);
    if (dto.confirmEmail.trim().toLowerCase() !== t.email.toLowerCase()) {
      throw new BadRequestException('O e-mail digitado não confere');
    }
    if (t.passwordHash && !(await bcrypt.compare(dto.password ?? '', t.passwordHash))) {
      throw new UnauthorizedException('Senha incorreta');
    }
    if (t.mfaEnabledAt && !(await this.auth.checkSecondFactor(teacherId, dto.code ?? '', ctx))) {
      throw new UnauthorizedException('Código de verificação inválido');
    }
    await this.db.transaction(async (em) => {
      for (const table of OWNED_TABLES) await em.query(`DELETE FROM "${table}" WHERE "teacher_id" = $1`, [teacherId]);
      await em.query('DELETE FROM "teachers" WHERE "id" = $1', [teacherId]);
    });
    this.revocation.markDeleted(teacherId);
    // Sem dado pessoal: só um hash para correlacionar com logs, se preciso.
    await this.events.record(SecurityEventType.ACCOUNT_DELETED, null, ctx, {
      ref: createHash('sha256').update(teacherId).digest('hex').slice(0, 16),
    });
  }
}
