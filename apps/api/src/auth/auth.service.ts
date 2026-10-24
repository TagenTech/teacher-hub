import { BadRequestException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, MoreThan, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import {
  deviceLabel,
  SecurityEventType as Ev,
  type AuthProvider,
  type AuthResponse,
  type MfaSetupDto,
  type SessionDto,
} from '@turmei/contracts';
import type { AppConfig } from '../config/configuration';
import { decryptField, encryptField } from '../common/crypto/field-crypto';
import type { JwtPayload } from '../common/types/jwt-payload';
import { MailService } from '../mail/mail.service';
import { Teacher } from '../professor/entities/teacher.entity';
import { BCRYPT_ROUNDS, TeachersService } from '../professor/teachers.service';
import type { RequestContext } from '../security/request-context';
import { maskIp, SecurityEventsService } from '../security/security-events.service';
import { SessionRevocationService } from '../security/session-revocation.service';
import { AuthIdentity } from './entities/auth-identity.entity';
import { EmailToken, type EmailTokenType } from './entities/email-token.entity';
import { MfaRecoveryCode } from './entities/mfa-recovery-code.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { LoginAttempts, maskEmail } from './login-guard';
import { generateRecoveryCodes, generateSecret, normalizeRecoveryCode, otpauthUrl, verifyTotp } from './totp';

/** Hash usado quando o e-mail não existe, para o tempo de resposta não revelar contas. */
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= bcrypt.hash('turmei-dummy', BCRYPT_ROUNDS));

const VERIFY_TTL_MS = 3 * 86_400_000;
const RESET_TTL_MS = 3_600_000;
const MFA_TOKEN_TTL_S = 300;

export interface IssuedSession {
  response: AuthResponse;
  refreshToken: string;
  refreshExpiresAt: Date;
}

/** Resultado de um login: sessão pronta ou desafio de 2FA. */
export type LoginOutcome = { kind: 'session'; session: IssuedSession } | { kind: 'mfa'; mfaToken: string };

export interface ProviderProfile {
  provider: AuthProvider;
  providerUserId: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Erro do login social com código fixo (a tela de login traduz; nada de texto livre na URL). */
export class OAuthError extends Error {
  constructor(readonly code: 'email' | 'vincular' | 'fechado' | 'falhou') {
    super(code);
  }
}

@Injectable()
export class AuthService {
  private readonly attempts = new LoginAttempts();
  private readonly mfaAttempts = new LoginAttempts();
  private readonly usedMfaTokens = new Map<string, number>();

  constructor(
    private readonly teachers: TeachersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly events: SecurityEventsService,
    private readonly revocation: SessionRevocationService,
    private readonly db: DataSource,
    @InjectRepository(RefreshToken) private readonly refreshRepo: Repository<RefreshToken>,
    @InjectRepository(EmailToken) private readonly emailTokens: Repository<EmailToken>,
    @InjectRepository(AuthIdentity) private readonly identities: Repository<AuthIdentity>,
    @InjectRepository(MfaRecoveryCode) private readonly recoveryCodes: Repository<MfaRecoveryCode>,
  ) {}

  // ---------------------------------------------------------------- login

  async login(email: string, password: string, ctx: RequestContext = {}): Promise<LoginOutcome> {
    const locked = this.attempts.lockedFor(email);
    if (locked) {
      throw new HttpException(
        `Muitas tentativas. Tente de novo em ${locked} min ou use "Esqueci minha senha".`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const teacher = await this.teachers.findByEmailWithPassword(email);
    const ok = await bcrypt.compare(password, teacher?.passwordHash ?? (await getDummyHash()));
    if (!teacher || !teacher.passwordHash || !ok) {
      const justLocked = this.attempts.fail(email);
      await this.events.record(justLocked ? Ev.LOGIN_LOCKED : Ev.LOGIN_FAIL, teacher?.id ?? null, ctx, teacher ? undefined : { email: maskEmail(email) });
      throw new UnauthorizedException('E-mail ou senha incorretos');
    }
    this.attempts.success(email);
    return this.afterPrimaryAuth(teacher, ctx);
  }

  /** Senha (ou social) ok: se tem 2FA, devolve o desafio; senão, a sessão. */
  private async afterPrimaryAuth(teacher: Teacher, ctx: RequestContext, via = 'password'): Promise<LoginOutcome> {
    if (teacher.mfaEnabledAt) {
      const mfaToken = await this.jwt.signAsync(
        { sub: teacher.id, email: teacher.email, purpose: 'mfa', jti: randomUUID() } satisfies JwtPayload & { jti: string },
        { expiresIn: MFA_TOKEN_TTL_S },
      );
      return { kind: 'mfa', mfaToken };
    }
    await this.events.record(Ev.LOGIN_OK, teacher.id, ctx, { via });
    return { kind: 'session', session: await this.issue(teacher, ctx) };
  }

  /** Segundo passo do login: código do app autenticador ou de recuperação. */
  async verifyMfaLogin(mfaToken: string, code: string, ctx: RequestContext = {}): Promise<IssuedSession> {
    let p: JwtPayload & { jti?: string };
    try {
      p = await this.jwt.verifyAsync(mfaToken, { algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedException('O tempo para o código acabou. Entre de novo.');
    }
    if (p.purpose !== 'mfa' || !p.jti || this.usedMfaTokens.has(p.jti)) {
      throw new UnauthorizedException('O tempo para o código acabou. Entre de novo.');
    }
    const key = `mfa:${p.sub}`;
    const locked = this.mfaAttempts.lockedFor(key);
    if (locked) throw new HttpException(`Muitas tentativas. Tente em ${locked} min.`, HttpStatus.TOO_MANY_REQUESTS);

    const teacher = await this.teachers.findById(p.sub);
    if (!(await this.checkSecondFactor(teacher.id, code, ctx))) {
      this.mfaAttempts.fail(key);
      await this.events.record(Ev.MFA_FAIL, teacher.id, ctx);
      throw new UnauthorizedException('Código inválido');
    }
    this.mfaAttempts.success(key);
    this.usedMfaTokens.set(p.jti, Date.now() + MFA_TOKEN_TTL_S * 1000);
    for (const [k, exp] of this.usedMfaTokens) if (exp < Date.now()) this.usedMfaTokens.delete(k);
    await this.events.record(Ev.LOGIN_OK, teacher.id, ctx, { via: 'mfa' });
    return this.issue(teacher, ctx);
  }

  // ---------------------------------------------------------------- cadastro e e-mail

  async register(name: string, email: string, password: string, ctx: RequestContext = {}): Promise<IssuedSession> {
    if (!this.config.get<boolean>('signupEnabled')) throw new BadRequestException('Cadastro fechado no momento');
    const existing = await this.teachers.findByEmail(email);
    if (existing) {
      // Não cria outra conta; avisa o dono do e-mail (pode não ter sido ele).
      await this.mail.sendExistingAccount(existing.email, `${this.webUrl()}/login`);
      throw new BadRequestException('Esse e-mail já tem conta. Entre ou recupere a senha.');
    }
    const teacher = await this.teachers.createWithPassword(name, email, password);
    await this.events.record(Ev.SIGNUP, teacher.id, ctx);
    await this.sendVerification(teacher);
    return this.issue(teacher, ctx);
  }

  async resendVerification(teacherId: string) {
    const t = await this.teachers.findById(teacherId);
    if (t.emailVerifiedAt) return;
    await this.sendVerification(t);
  }

  async verifyEmail(token: string, ctx: RequestContext = {}): Promise<void> {
    const row = await this.consume(token, 'VERIFY');
    await this.teachers.markEmailVerified(row.teacherId);
    await this.events.record(Ev.EMAIL_VERIFIED, row.teacherId, ctx);
  }

  /** Sempre responde igual, exista ou não a conta (não revela e-mails cadastrados). */
  async forgotPassword(email: string, ctx: RequestContext = {}): Promise<void> {
    const t = await this.teachers.findByEmail(email);
    if (!t) return;
    const token = await this.createToken(t.id, 'RESET', RESET_TTL_MS);
    await this.events.record(Ev.PASSWORD_RESET_REQUESTED, t.id, ctx);
    await this.mail.sendPasswordReset(t.email, `${this.webUrl()}/redefinir-senha?token=${token}`);
  }

  async resetPassword(token: string, password: string, ctx: RequestContext = {}): Promise<void> {
    const row = await this.consume(token, 'RESET');
    await this.teachers.setPassword(row.teacherId, password);
    // Quem recebeu o link no e-mail provou ser dono dele.
    await this.teachers.markEmailVerified(row.teacherId);
    await this.revokeEverything(row.teacherId);
    await this.events.record(Ev.PASSWORD_RESET, row.teacherId, ctx);
  }

  // ---------------------------------------------------------------- login social

  /** Acha pela identidade, depois pelo e-mail (liga as contas), senão cria. */
  async signInWithProvider(profile: ProviderProfile, ctx: RequestContext = {}): Promise<{ outcome: LoginOutcome; created: boolean }> {
    const identity = await this.identities.findOne({
      where: { provider: profile.provider, providerUserId: profile.providerUserId },
    });
    let teacher: Teacher | null = identity ? await this.teachers.findById(identity.teacherId) : null;
    let created = false;
    if (!teacher) {
      const byEmail = await this.teachers.findByEmail(profile.email);
      if (byEmail) {
        // Só liga a uma conta existente se o provedor garante o e-mail.
        if (!profile.emailVerified) throw new OAuthError('vincular');
        teacher = byEmail;
        if (!teacher.emailVerifiedAt) await this.teachers.markEmailVerified(teacher.id);
      } else {
        if (!this.config.get<boolean>('signupEnabled')) throw new OAuthError('fechado');
        teacher = await this.teachers.createFromProvider(profile.name || profile.email.split('@')[0], profile.email);
        created = true;
      }
      await this.identities.save(
        this.identities.create({ teacherId: teacher.id, provider: profile.provider, providerUserId: profile.providerUserId, email: profile.email }),
      );
      await this.events.record(created ? Ev.OAUTH_CREATED : Ev.OAUTH_LINKED, teacher.id, ctx, { provider: profile.provider });
    }
    return { outcome: await this.afterPrimaryAuth(teacher, ctx, profile.provider), created };
  }

  // ---------------------------------------------------------------- sessões

  async refresh(rawToken: string | undefined, ctx: RequestContext = {}): Promise<IssuedSession> {
    if (!rawToken) throw new UnauthorizedException('Sessão expirada');
    const stored = await this.refreshRepo.findOne({ where: { tokenHash: hashToken(rawToken) } });
    if (!stored) throw new UnauthorizedException('Sessão expirada');

    if (stored.revokedAt) {
      // Token já trocado sendo reutilizado enquanto a sessão segue viva (outro aparelho tem o sucessor):
      // possível roubo — derruba todas as sessões. Sessão encerrada (sair, aparelho removido, senha trocada)
      // é só expirada: não pode derrubar os outros aparelhos.
      const stillActive = await this.refreshRepo.exists({ where: { sessionId: stored.sessionId, revokedAt: IsNull() } });
      if (stillActive) {
        await this.events.record(Ev.TOKEN_REUSE, stored.teacherId, ctx);
        await this.revokeEverything(stored.teacherId);
      }
      throw new UnauthorizedException('Sessão expirada');
    }
    if (stored.expiresAt.getTime() < Date.now()) throw new UnauthorizedException('Sessão expirada');

    await this.refreshRepo.update(stored.id, { revokedAt: new Date() });
    const teacher = await this.teachers.findById(stored.teacherId);
    return this.issue(teacher, ctx, { sessionId: stored.sessionId, startedAt: stored.sessionStartedAt });
  }

  async logout(rawToken: string | undefined, ctx: RequestContext = {}): Promise<void> {
    if (!rawToken) return;
    const row = await this.refreshRepo.findOne({ where: { tokenHash: hashToken(rawToken) } });
    if (!row) return;
    await this.endSession(row.teacherId, row.sessionId);
    await this.events.record(Ev.LOGOUT, row.teacherId, ctx);
  }

  async listSessions(teacherId: string, currentSid?: string): Promise<SessionDto[]> {
    const rows = await this.refreshRepo.find({
      where: { teacherId, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      order: { createdAt: 'DESC' },
    });
    const seen = new Set<string>();
    return rows
      .filter((r) => (seen.has(r.sessionId) ? false : (seen.add(r.sessionId), true)))
      .map((r) => ({
        id: r.sessionId,
        device: deviceLabel(r.userAgent),
        ip: maskIp(r.ip),
        lastActiveAt: r.createdAt.toISOString(),
        startedAt: r.sessionStartedAt.toISOString(),
        current: r.sessionId === currentSid,
      }));
  }

  async revokeSession(teacherId: string, sessionId: string, ctx: RequestContext = {}) {
    await this.endSession(teacherId, sessionId);
    await this.events.record(Ev.SESSION_REVOKED, teacherId, ctx, { scope: 'one' });
  }

  async revokeOtherSessions(teacherId: string, currentSid: string | undefined, ctx: RequestContext = {}) {
    const rows = await this.refreshRepo.find({ where: { teacherId, revokedAt: IsNull() }, select: { sessionId: true } });
    for (const sid of new Set(rows.map((r) => r.sessionId))) {
      if (sid !== currentSid) await this.endSession(teacherId, sid);
    }
    await this.events.record(Ev.SESSION_REVOKED, teacherId, ctx, { scope: 'others' });
  }

  private async endSession(teacherId: string, sessionId: string) {
    await this.refreshRepo.update({ teacherId, sessionId, revokedAt: IsNull() }, { revokedAt: new Date() });
    this.revocation.revokeSession(sessionId);
  }

  /** Senha trocada/redefinida, reuso suspeito: nenhum token antigo vale mais. */
  private async revokeEverything(teacherId: string) {
    // O corte por professor é em segundos (iat do JWT); a revogação por sessão pega também
    // os tokens emitidos no mesmo segundo (ex.: o ladrão que acabou de renovar).
    const active = await this.refreshRepo.find({ where: { teacherId, revokedAt: IsNull() }, select: { sessionId: true } });
    for (const sid of new Set(active.map((r) => r.sessionId))) this.revocation.revokeSession(sid);
    await this.refreshRepo.update({ teacherId, revokedAt: IsNull() }, { revokedAt: new Date() });
    await this.revocation.revokeAllFor(teacherId);
  }

  /** Quem entrou só pelo Google etc. pode criar uma senha sem informar a atual. */
  async changePassword(teacherId: string, currentPassword: string | undefined, newPassword: string, ctx: RequestContext = {}) {
    const teacher = await this.teachers.findByIdWithPassword(teacherId);
    if (teacher.passwordHash && !(await bcrypt.compare(currentPassword ?? '', teacher.passwordHash))) {
      throw new UnauthorizedException('Senha atual incorreta');
    }
    await this.teachers.setPassword(teacherId, newPassword);
    await this.revokeEverything(teacherId);
    await this.events.record(Ev.PASSWORD_CHANGED, teacherId, ctx);
  }

  // ---------------------------------------------------------------- 2FA

  async mfaSetup(teacherId: string): Promise<MfaSetupDto> {
    const t = await this.teachers.findById(teacherId);
    if (t.mfaEnabledAt) throw new BadRequestException('A verificação em duas etapas já está ativa');
    const secret = generateSecret();
    await this.db.getRepository(Teacher).update(teacherId, { mfaPendingSecretEncrypted: encryptField(secret) });
    return { secret, otpauthUrl: otpauthUrl(secret, t.email) };
  }

  async mfaEnable(teacherId: string, code: string, ctx: RequestContext = {}): Promise<string[]> {
    const row = await this.db
      .getRepository(Teacher)
      .createQueryBuilder('t')
      .addSelect('t.mfaPendingSecretEncrypted')
      .where('t.id = :id', { id: teacherId })
      .getOne();
    if (!row?.mfaPendingSecretEncrypted) throw new BadRequestException('Comece a configuração de novo');
    const secret = decryptField(row.mfaPendingSecretEncrypted);
    const step = verifyTotp(secret, code.trim());
    if (step === null) throw new BadRequestException('Código inválido — confira o horário do celular e tente o código atual');
    await this.db.getRepository(Teacher).update(teacherId, {
      mfaSecretEncrypted: row.mfaPendingSecretEncrypted,
      mfaPendingSecretEncrypted: null,
      mfaEnabledAt: new Date(),
      mfaLastStep: String(step),
    });
    await this.events.record(Ev.MFA_ENABLED, teacherId, ctx);
    return this.newRecoveryCodes(teacherId);
  }

  async mfaDisable(teacherId: string, code: string, ctx: RequestContext = {}) {
    if (!(await this.checkSecondFactor(teacherId, code, ctx))) throw new BadRequestException('Código inválido');
    await this.db.getRepository(Teacher).update(teacherId, {
      mfaSecretEncrypted: null,
      mfaPendingSecretEncrypted: null,
      mfaEnabledAt: null,
      mfaLastStep: null,
    });
    await this.recoveryCodes.delete({ teacherId });
    await this.events.record(Ev.MFA_DISABLED, teacherId, ctx);
  }

  async regenerateRecoveryCodes(teacherId: string, code: string, ctx: RequestContext = {}): Promise<string[]> {
    if (!(await this.checkSecondFactor(teacherId, code, ctx))) throw new BadRequestException('Código inválido');
    return this.newRecoveryCodes(teacherId);
  }

  private async newRecoveryCodes(teacherId: string): Promise<string[]> {
    const codes = generateRecoveryCodes();
    await this.recoveryCodes.delete({ teacherId });
    await this.recoveryCodes.insert(codes.map((c) => ({ teacherId, codeHash: hashToken(normalizeRecoveryCode(c)), usedAt: null })));
    return codes;
  }

  /** Código TOTP (sem reuso do mesmo passo) ou código de recuperação (uso único). */
  async checkSecondFactor(teacherId: string, code: string, ctx: RequestContext = {}): Promise<boolean> {
    const row = await this.db
      .getRepository(Teacher)
      .createQueryBuilder('t')
      .addSelect(['t.mfaSecretEncrypted', 't.mfaLastStep'])
      .where('t.id = :id', { id: teacherId })
      .getOne();
    if (!row?.mfaSecretEncrypted) return false;
    const clean = code.trim();
    if (/^\d{6}$/.test(clean)) {
      const step = verifyTotp(decryptField(row.mfaSecretEncrypted), clean, Date.now(), Number(row.mfaLastStep ?? -1));
      if (step === null) return false;
      await this.db.getRepository(Teacher).update(teacherId, { mfaLastStep: String(step) });
      return true;
    }
    const hit = await this.recoveryCodes.findOne({ where: { teacherId, codeHash: hashToken(normalizeRecoveryCode(clean)), usedAt: IsNull() } });
    if (!hit) return false;
    await this.recoveryCodes.update(hit.id, { usedAt: new Date() });
    await this.events.record(Ev.RECOVERY_CODE_USED, teacherId, ctx);
    return true;
  }

  // ---------------------------------------------------------------- utilitários

  private async sendVerification(t: Teacher) {
    const token = await this.createToken(t.id, 'VERIFY', VERIFY_TTL_MS);
    await this.mail.sendVerification(t.email, t.name, `${this.webUrl()}/verificar-email?token=${token}`);
  }

  private async createToken(teacherId: string, type: EmailTokenType, ttl: number): Promise<string> {
    // Um link válido por vez de cada tipo.
    await this.emailTokens.update({ teacherId, type, usedAt: IsNull() }, { usedAt: new Date() });
    const token = randomBytes(32).toString('base64url');
    await this.emailTokens.save(
      this.emailTokens.create({ teacherId, type, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttl), usedAt: null }),
    );
    return token;
  }

  private async consume(token: string, type: EmailTokenType): Promise<EmailToken> {
    const row = await this.emailTokens.findOne({ where: { tokenHash: hashToken(token), type } });
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Link inválido ou expirado. Peça um novo.');
    }
    await this.emailTokens.update(row.id, { usedAt: new Date() });
    return row;
  }

  private webUrl() {
    return this.config.get<string>('publicWebUrl')!;
  }

  async issue(teacher: Teacher, ctx: RequestContext = {}, session?: { sessionId: string; startedAt: Date }): Promise<IssuedSession> {
    const { accessTtlSeconds } = this.config.get<AppConfig['jwt']>('jwt')!;
    const refreshTtlDays = this.config.get<number>('refreshTtlDays')!;
    const sessionId = session?.sessionId ?? randomUUID();

    const payload: JwtPayload = { sub: teacher.id, email: teacher.email, sid: sessionId };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: accessTtlSeconds });

    const refreshToken = randomBytes(48).toString('base64url');
    const refreshExpiresAt = new Date(Date.now() + refreshTtlDays * 86_400_000);
    await this.refreshRepo.save(
      this.refreshRepo.create({
        teacherId: teacher.id,
        sessionId,
        sessionStartedAt: session?.startedAt ?? new Date(),
        tokenHash: hashToken(refreshToken),
        expiresAt: refreshExpiresAt,
        userAgent: ctx.userAgent?.slice(0, 255) ?? null,
        ip: ctx.ip ?? null,
        revokedAt: null,
      }),
    );

    return {
      response: { accessToken, expiresIn: accessTtlSeconds, teacher: await this.teachers.toDto(teacher) },
      refreshToken,
      refreshExpiresAt,
    };
  }
}
