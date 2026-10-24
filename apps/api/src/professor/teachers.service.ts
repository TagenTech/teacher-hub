import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import {
  maskCpf,
  type AuthProvider,
  type CompleteProfileRequest,
  type TeacherDto,
  type UpdateSettingsRequest,
} from '@turmei/contracts';
import { AuthIdentity } from '../auth/entities/auth-identity.entity';
import { blindIndex, encryptField } from '../common/crypto/field-crypto';
import { Teacher } from './entities/teacher.entity';

export const BCRYPT_ROUNDS = 12;

@Injectable()
export class TeachersService {
  constructor(
    @InjectRepository(Teacher) private readonly repo: Repository<Teacher>,
    @InjectRepository(AuthIdentity) private readonly identities: Repository<AuthIdentity>,
  ) {}

  async findById(id: string): Promise<Teacher> {
    const teacher = await this.repo.findOne({ where: { id } });
    if (!teacher) throw new NotFoundException('Professor não encontrado');
    return teacher;
  }

  findByEmail(email: string): Promise<Teacher | null> {
    return this.repo.createQueryBuilder('t').where('LOWER(t.email) = LOWER(:email)', { email }).getOne();
  }

  /** Inclui o hash da senha — uso exclusivo do fluxo de autenticação. */
  findByEmailWithPassword(email: string): Promise<Teacher | null> {
    return this.repo
      .createQueryBuilder('t')
      .addSelect('t.passwordHash')
      .where('LOWER(t.email) = LOWER(:email)', { email })
      .getOne();
  }

  async findByIdWithPassword(id: string): Promise<Teacher> {
    const teacher = await this.repo
      .createQueryBuilder('t')
      .addSelect('t.passwordHash')
      .where('t.id = :id', { id })
      .getOne();
    if (!teacher) throw new NotFoundException('Professor não encontrado');
    return teacher;
  }

  async setPassword(id: string, password: string): Promise<void> {
    await this.repo.update(id, { passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) });
  }

  /** Cadastro público por e-mail e senha. */
  async createWithPassword(name: string, email: string, password: string): Promise<Teacher> {
    if (await this.findByEmail(email)) throw new ConflictException('Esse e-mail já tem conta');
    return this.repo.save(
      this.repo.create({
        name,
        email: email.toLowerCase(),
        passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
        termsAcceptedAt: new Date(),
      }),
    );
  }

  /** Conta criada pelo login social: e-mail já confirmado pelo provedor, sem senha. */
  createFromProvider(name: string, email: string): Promise<Teacher> {
    return this.repo.save(
      this.repo.create({ name, email: email.toLowerCase(), passwordHash: null, emailVerifiedAt: new Date(), termsAcceptedAt: new Date() }),
    );
  }

  async markEmailVerified(id: string) {
    await this.repo.update(id, { emailVerifiedAt: new Date() });
  }

  /** Cria ou atualiza o professor (usado pelo script `create-teacher`). */
  async upsert(name: string, email: string, password: string): Promise<{ teacher: Teacher; created: boolean }> {
    const existing = await this.findByEmailWithPassword(email);
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    if (existing) {
      await this.repo.update(existing.id, { name, passwordHash, emailVerifiedAt: existing.emailVerifiedAt ?? new Date() });
      return { teacher: await this.findById(existing.id), created: false };
    }
    const teacher = await this.repo.save(
      this.repo.create({ name, email: email.toLowerCase(), passwordHash, emailVerifiedAt: new Date(), termsAcceptedAt: new Date() }),
    );
    return { teacher, created: true };
  }

  async updateSettings(id: string, dto: UpdateSettingsRequest): Promise<Teacher> {
    const changes = Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined));
    if (Object.keys(changes).length) await this.repo.update(id, changes);
    return this.findById(id);
  }

  /** "Finalizar cadastro": nome completo, CPF e celular (base para a cobrança da licença no futuro). */
  async completeProfile(id: string, dto: CompleteProfileRequest): Promise<Teacher> {
    const cpfHash = blindIndex(dto.cpf, 'cpf');
    const taken = await this.repo.count({ where: { cpfHash, id: Not(id) } });
    if (taken) throw new ConflictException('Esse CPF já está em outra conta');
    await this.repo.update(id, {
      name: dto.name,
      cpfEncrypted: encryptField(dto.cpf),
      cpfHash,
      cpfMasked: maskCpf(dto.cpf),
      phone: dto.phone,
      city: dto.city ?? null,
      state: dto.state ?? null,
      profileCompletedAt: new Date(),
    });
    return this.findById(id);
  }

  findAll(): Promise<Teacher[]> {
    return this.repo.find();
  }

  async findByIcsToken(token: string): Promise<Teacher | null> {
    return this.repo.findOne({ where: { icsToken: token } });
  }

  async rotateIcsToken(id: string): Promise<string> {
    const token = randomBytes(24).toString('base64url');
    await this.repo.update(id, { icsToken: token });
    return token;
  }

  async toDto(t: Teacher): Promise<TeacherDto> {
    const [withHash, ids] = await Promise.all([
      this.repo.createQueryBuilder('t').addSelect('t.passwordHash').where('t.id = :id', { id: t.id }).getOne(),
      this.identities.find({ where: { teacherId: t.id }, select: { provider: true } }),
    ]);
    return {
      id: t.id,
      name: t.name,
      email: t.email,
      emailVerified: !!t.emailVerifiedAt,
      cpfMasked: t.cpfMasked,
      phone: t.phone,
      city: t.city,
      state: t.state,
      profileComplete: !!t.profileCompletedAt,
      hasPassword: !!withHash?.passwordHash,
      providers: [...new Set(ids.map((i) => i.provider as AuthProvider))],
      mfaEnabled: !!t.mfaEnabledAt,
      timezone: t.timezone,
      pixKey: t.pixKey,
      pixKeyType: t.pixKeyType,
      lessonReminderMinutes: t.lessonReminderMinutes,
      paymentReminderHour: t.paymentReminderHour,
      defaultLessonMinutes: t.defaultLessonMinutes,
      whatsappTemplate: t.whatsappTemplate,
    };
  }
}
