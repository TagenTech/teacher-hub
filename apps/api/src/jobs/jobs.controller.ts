import { createHash, timingSafeEqual } from 'crypto';
import { Controller, Headers, HttpCode, NotFoundException, Param, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { StudentsService } from '../alunos/students.service';
import { SlotsService } from '../agenda/slots.service';
import { BillingService } from '../financeiro/billing.service';
import { RemindersService } from '../lembretes/reminders.service';
import { SecurityEventsService } from '../security/security-events.service';

@Controller('internal/jobs')
export class JobsController {
  constructor(
    private readonly config: ConfigService,
    private readonly reminders: RemindersService,
    private readonly slots: SlotsService,
    private readonly students: StudentsService,
    private readonly billing: BillingService,
    private readonly securityEvents: SecurityEventsService,
  ) {}

  @Post(':job')
  @Public()
  @SkipThrottle()
  @HttpCode(200)
  async run(@Param('job') job: string, @Headers('authorization') authorization?: string) {
    const secret = this.config.get<string | null>('cronSecret');
    if (!secret || secret.length < 32) throw new NotFoundException('Endpoint não encontrado');

    const token = /^Bearer ([^\s]+)$/.exec(authorization ?? '')?.[1];
    if (!token || !this.matchesSecret(token, secret)) throw new UnauthorizedException('Token inválido');

    const jobs: Record<string, () => Promise<void>> = {
      reminders: () => this.reminders.tick(),
      slots: () => this.slots.generateAll(),
      pauses: () => this.students.resumeExpiredPauses(),
      billing: () => this.billing.generateAll(),
      'security-prune': () => this.securityEvents.prune(),
    };
    const runJob = Object.prototype.hasOwnProperty.call(jobs, job) ? jobs[job] : undefined;
    if (!runJob) throw new NotFoundException('Tarefa não encontrada');

    const startedAt = Date.now();
    await runJob();
    return { job, ok: true, ms: Date.now() - startedAt };
  }

  private matchesSecret(token: string, secret: string) {
    const tokenHash = createHash('sha256').update(token).digest();
    const secretHash = createHash('sha256').update(secret).digest();
    return timingSafeEqual(tokenHash, secretHash);
  }
}
