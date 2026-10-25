import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { SecurityEventType } from '@turmei/contracts';
import { TeachersService } from '../professor/teachers.service';
import type { RequestContext } from '../security/request-context';
import { SecurityEventsService } from '../security/security-events.service';
import { SessionRevocationService } from '../security/session-revocation.service';
import { AuthService } from './auth.service';
import { DeleteAccountDto } from './dto/mfa.dto';
import { AuthIdentity } from './entities/auth-identity.entity';
import { EmailToken } from './entities/email-token.entity';
import { MfaRecoveryCode } from './entities/mfa-recovery-code.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { Lesson } from '../agenda/entities/lesson.entity';
import { MakeupCredit } from '../agenda/entities/makeup-credit.entity';
import { RecurringSlot } from '../agenda/entities/recurring-slot.entity';
import { ScheduleBlock } from '../agenda/entities/schedule-block.entity';
import { BillingPlan } from '../alunos/entities/billing-plan.entity';
import { Student } from '../alunos/entities/student.entity';
import { Charge } from '../financeiro/entities/charge.entity';
import { Payment } from '../financeiro/entities/payment.entity';
import { NotificationLog } from '../lembretes/entities/notification-log.entity';
import { PushSubscriptionEntity } from '../lembretes/entities/push-subscription.entity';
import { SavedFilter } from '../relatorios/entities/saved-filter.entity';
import { SecurityEvent } from '../security/entities/security-event.entity';
import { Teacher } from '../professor/entities/teacher.entity';

/** Tabelas com dados do professor, na ordem segura para apagar (filhos antes dos pais). */
const OWNED_ENTITIES = [
  Payment,
  Charge,
  Lesson,
  MakeupCredit,
  RecurringSlot,
  BillingPlan,
  Student,
  ScheduleBlock,
  NotificationLog,
  PushSubscriptionEntity,
  SavedFilter,
  RefreshToken,
  EmailToken,
  MfaRecoveryCode,
  SecurityEvent,
  AuthIdentity,
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
      for (const entity of OWNED_ENTITIES) {
        const table = this.db.getMetadata(entity).tableName;
        await em.query(`DELETE FROM "${table}" WHERE "teacher_id" = $1`, [teacherId]);
      }
      const teachersTable = this.db.getMetadata(Teacher).tableName;
      await em.query(`DELETE FROM "${teachersTable}" WHERE "id" = $1`, [teacherId]);
    });
    this.revocation.markDeleted(teacherId);
    // Sem dado pessoal: só um hash para correlacionar com logs, se preciso.
    await this.events.record(SecurityEventType.ACCOUNT_DELETED, null, ctx, {
      ref: createHash('sha256').update(teacherId).digest('hex').slice(0, 16),
    });
  }
}
