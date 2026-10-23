import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  normalizePlanInput,
  previousPlanEnd,
  resolvePlans,
  searchable,
  StudentStatus,
  todayIn,
  type BillingPlanDto,
  type BillingPlanInput,
  type StudentDetailDto,
  type StudentDto,
  type StudentListItemDto,
} from '@aulinha/contracts';
import { Events, type PlanChangedEvent, type StudentStatusChangedEvent } from '../common/events';
import { TeachersService } from '../professor/teachers.service';
import { CreateBillingPlanDto } from './dto/billing-plan.dto';
import {
  ChangeStudentStatusDto,
  CreateStudentDto,
  ListStudentsQueryDto,
  UpdateStudentDto,
} from './dto/student.dto';
import { BillingPlan } from './entities/billing-plan.entity';
import { Student } from './entities/student.entity';

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(
    @InjectRepository(Student) private readonly students: Repository<Student>,
    @InjectRepository(BillingPlan) private readonly plans: Repository<BillingPlan>,
    private readonly teachers: TeachersService,
    private readonly db: DataSource,
    private readonly events: EventEmitter2,
  ) {}

  async list(teacherId: string, query: ListStudentsQueryDto): Promise<StudentListItemDto[]> {
    const qb = this.students
      .createQueryBuilder('s')
      .where('s.teacherId = :teacherId', { teacherId })
      .orderBy('s.name', 'ASC')
      .take(2000);
    if (query.status) qb.andWhere('s.status = :status', { status: query.status });
    const term = query.q ? searchable(query.q) : '';
    if (term) {
      const digits = term.replace(/\D/g, '');
      qb.andWhere(
        digits.length >= 3 ? '(s.searchText LIKE :term OR s.searchText LIKE :digits)' : 's.searchText LIKE :term',
        { term: `%${term}%`, digits: `%${digits}%` },
      );
    }
    const students = await qb.getMany();
    if (!students.length) return [];

    const today = await this.today(teacherId);
    const plans = await this.plans.find({ where: { studentId: In(students.map((s) => s.id)) } });
    const byStudent = new Map<string, BillingPlan[]>();
    for (const p of plans) byStudent.set(p.studentId, [...(byStudent.get(p.studentId) ?? []), p]);

    return students.map((s) => {
      const { current } = resolvePlans(byStudent.get(s.id) ?? [], today);
      return { ...this.toDto(s), currentPlan: current ? this.planDto(current) : null };
    });
  }

  async detail(teacherId: string, id: string): Promise<StudentDetailDto> {
    const student = await this.findOwned(teacherId, id);
    const plans = await this.plans.find({ where: { studentId: id }, order: { validFrom: 'DESC' } });
    const { current, upcoming } = resolvePlans(plans, await this.today(teacherId));
    return {
      ...this.toDto(student),
      currentPlan: current ? this.planDto(current) : null,
      upcomingPlan: upcoming ? this.planDto(upcoming) : null,
      plans: plans.map((p) => this.planDto(p)),
    };
  }

  async create(teacherId: string, dto: CreateStudentDto): Promise<StudentDetailDto> {
    const plan = this.validatePlan(dto.plan);
    const { plan: _ignored, ...fields } = dto;
    const startDate = fields.startDate ?? (await this.today(teacherId));

    const id = await this.db.transaction(async (em) => {
      const student = em.create(Student, {
        ...this.cleanGuardian(fields),
        teacherId,
        startDate,
        tags: fields.tags ?? [],
        status: StudentStatus.ATIVO,
      });
      student.searchText = this.searchText(student);
      const saved = await em.save(student);
      await em.save(
        em.create(BillingPlan, { ...plan, teacherId, studentId: saved.id, validFrom: startDate, validTo: null }),
      );
      return saved.id;
    });
    await this.events.emitAsync(Events.PLAN_CHANGED, { teacherId, studentId: id } satisfies PlanChangedEvent);
    return this.detail(teacherId, id);
  }

  async update(teacherId: string, id: string, dto: UpdateStudentDto): Promise<StudentDetailDto> {
    const student = await this.findOwned(teacherId, id);
    const changes = Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined));
    Object.assign(student, this.cleanGuardian({ ...student, ...changes }));
    student.searchText = this.searchText(student);
    await this.students.save(student);
    return this.detail(teacherId, id);
  }

  async changeStatus(teacherId: string, id: string, dto: ChangeStudentStatusDto): Promise<StudentDetailDto> {
    const student = await this.findOwned(teacherId, id);
    const today = await this.today(teacherId);
    if (dto.status === StudentStatus.PAUSADO && dto.pausedUntil && dto.pausedUntil < today) {
      throw new BadRequestException('A data de volta precisa ser hoje ou depois');
    }
    student.status = dto.status;
    student.pausedUntil = dto.status === StudentStatus.PAUSADO ? (dto.pausedUntil ?? null) : null;
    await this.students.save(student);
    await this.events.emitAsync(Events.STUDENT_STATUS_CHANGED, {
      teacherId,
      studentId: id,
      status: student.status,
      pausedUntil: student.pausedUntil,
    } satisfies StudentStatusChangedEvent);
    return this.detail(teacherId, id);
  }

  /** Exclusão definitiva (LGPD). Os planos vão junto (cascade). */
  async remove(teacherId: string, id: string): Promise<void> {
    const student = await this.findOwned(teacherId, id);
    await this.students.remove(student);
  }

  /**
   * Reajuste / troca de plano a partir de `validFrom`. O plano mais recente termina no dia anterior.
   * Pode ser retroativo, mas sempre depois do início do plano mais recente.
   */
  async addPlan(teacherId: string, studentId: string, dto: CreateBillingPlanDto): Promise<StudentDetailDto> {
    await this.findOwned(teacherId, studentId);
    const plan = this.validatePlan(dto);

    await this.db.transaction(async (em) => {
      const latest = await em.findOne(BillingPlan, {
        where: { studentId },
        order: { validFrom: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (latest && dto.validFrom <= latest.validFrom) {
        throw new BadRequestException(
          'O novo plano precisa começar depois do início do plano atual',
        );
      }
      if (latest) {
        latest.validTo = previousPlanEnd(dto.validFrom);
        await em.save(latest);
      }
      await em.save(
        em.create(BillingPlan, { ...plan, teacherId, studentId, validFrom: dto.validFrom, validTo: null }),
      );
    });
    await this.events.emitAsync(Events.PLAN_CHANGED, { teacherId, studentId } satisfies PlanChangedEvent);
    return this.detail(teacherId, studentId);
  }

  /** Desfaz o último reajuste: apaga o plano mais recente e reabre o anterior. */
  async removeLatestPlan(teacherId: string, studentId: string, planId: string): Promise<StudentDetailDto> {
    await this.findOwned(teacherId, studentId);
    await this.db.transaction(async (em) => {
      const [latest, previous] = await em.find(BillingPlan, {
        where: { studentId },
        order: { validFrom: 'DESC' },
        take: 2,
      });
      if (!latest || latest.id !== planId) {
        throw new BadRequestException('Só dá para desfazer o reajuste mais recente');
      }
      if (!previous) throw new BadRequestException('O aluno precisa ter pelo menos um plano');
      await em.remove(latest);
      previous.validTo = null;
      await em.save(previous);
    });
    await this.events.emitAsync(Events.PLAN_CHANGED, { teacherId, studentId } satisfies PlanChangedEvent);
    return this.detail(teacherId, studentId);
  }

  /** Alunos pausados com data de volta vencida voltam a ATIVO (no fuso de cada professor). */
  @Cron(CronExpression.EVERY_HOUR)
  async resumeExpiredPauses(): Promise<void> {
    const result = await this.db.query(
      `UPDATE students s SET status = $1, paused_until = NULL, updated_at = now()
         FROM teachers t
        WHERE s.teacher_id = t.id AND s.status = $2 AND s.paused_until IS NOT NULL
          AND s.paused_until < (now() AT TIME ZONE t.timezone)::date
        RETURNING s.id, s.teacher_id`,
      [StudentStatus.ATIVO, StudentStatus.PAUSADO],
    );
    const rows: { id: string; teacher_id: string }[] = Array.isArray(result) ? result[0] : [];
    for (const r of rows) {
      await this.events.emitAsync(Events.STUDENT_STATUS_CHANGED, {
        teacherId: r.teacher_id,
        studentId: r.id,
        status: StudentStatus.ATIVO,
        pausedUntil: null,
      } satisfies StudentStatusChangedEvent);
    }
    if (rows.length) this.logger.log(`${rows.length} aluno(s) voltaram da pausa`);
  }

  private async findOwned(teacherId: string, id: string): Promise<Student> {
    const student = await this.students.findOne({ where: { id, teacherId } });
    if (!student) throw new NotFoundException('Aluno não encontrado');
    return student;
  }

  private async today(teacherId: string) {
    return todayIn((await this.teachers.findById(teacherId)).timezone);
  }

  private validatePlan(input: BillingPlanInput) {
    const { plan, errors } = normalizePlanInput(input);
    if (errors.length) throw new BadRequestException(errors.map((e) => e.message));
    return plan;
  }

  /** Sem nome de responsável não faz sentido "responsável paga". */
  private cleanGuardian<T extends { guardianName?: string | null; payerIsGuardian?: boolean }>(s: T): T {
    return s.guardianName ? s : { ...s, payerIsGuardian: false };
  }

  private searchText(s: Student): string {
    return searchable(
      [s.name, s.nickname, s.phone, s.guardianName, s.guardianPhone, ...(s.tags ?? [])].filter(Boolean).join(' '),
    );
  }

  private toDto(s: Student): StudentDto {
    return {
      id: s.id,
      name: s.name,
      nickname: s.nickname,
      phone: s.phone,
      email: s.email,
      birthDate: s.birthDate,
      guardianName: s.guardianName,
      guardianPhone: s.guardianPhone,
      payerIsGuardian: s.payerIsGuardian,
      color: s.color,
      emoji: s.emoji,
      status: s.status,
      pausedUntil: s.pausedUntil,
      startDate: s.startDate,
      tags: s.tags ?? [],
      notes: s.notes,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  }

  private planDto(p: BillingPlan): BillingPlanDto {
    return {
      id: p.id,
      type: p.type,
      monthlyFeeCents: p.monthlyFeeCents,
      lessonPriceCents: p.lessonPriceCents,
      packageLessons: p.packageLessons,
      packagePriceCents: p.packagePriceCents,
      dueDay: p.dueDay,
      note: p.note,
      validFrom: p.validFrom,
      validTo: p.validTo,
      createdAt: p.createdAt.toISOString(),
    };
  }
}
