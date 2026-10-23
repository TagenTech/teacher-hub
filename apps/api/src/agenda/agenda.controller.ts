import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload';
import { BlocksService } from './blocks.service';
import {
  AttendanceDto,
  CreateLessonDto,
  CreateScheduleBlockDto,
  CreateSlotDto,
  EndSlotQueryDto,
  ListLessonsQueryDto,
  ListMakeupQueryDto,
  RescheduleDto,
  UpdateLessonDto,
  UpdateSlotDto,
} from './dto/agenda.dto';
import { LessonsService } from './lessons.service';
import { SlotsService } from './slots.service';

@ApiTags('agenda')
@ApiBearerAuth()
@Controller()
export class AgendaController {
  constructor(
    private readonly slots: SlotsService,
    private readonly lessons: LessonsService,
    private readonly blocks: BlocksService,
  ) {}

  // Horários fixos
  @Get('students/:id/slots')
  listSlots(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.slots.listForStudent(u.sub, id);
  }

  @Post('students/:id/slots')
  createSlot(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateSlotDto) {
    return this.slots.create(u.sub, id, dto);
  }

  @Patch('slots/:id')
  updateSlot(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSlotDto) {
    return this.slots.update(u.sub, id, dto);
  }

  @Delete('slots/:id')
  @HttpCode(204)
  endSlot(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Query() q: EndSlotQueryDto) {
    return this.slots.end(u.sub, id, q.from);
  }

  // Aulas
  @Get('lessons')
  listLessons(@CurrentUser() u: JwtPayload, @Query() q: ListLessonsQueryDto) {
    return this.lessons.list(u.sub, q);
  }

  @Get('lessons/pending')
  pending(@CurrentUser() u: JwtPayload) {
    return this.lessons.pending(u.sub);
  }

  @Get('lessons/:id')
  getLesson(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.lessons.get(u.sub, id);
  }

  @Post('lessons')
  createLesson(@CurrentUser() u: JwtPayload, @Body() dto: CreateLessonDto) {
    return this.lessons.create(u.sub, dto);
  }

  @Patch('lessons/:id')
  updateLesson(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLessonDto) {
    return this.lessons.update(u.sub, id, dto);
  }

  @Post('lessons/:id/attendance')
  @HttpCode(200)
  attendance(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AttendanceDto) {
    return this.lessons.attendance(u.sub, id, dto);
  }

  @Post('lessons/:id/reschedule')
  @HttpCode(200)
  reschedule(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RescheduleDto) {
    return this.lessons.reschedule(u.sub, id, dto);
  }

  @Delete('lessons/:id')
  @HttpCode(204)
  removeLesson(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.lessons.remove(u.sub, id);
  }

  // Reposições
  @Get('makeup-credits')
  listMakeups(@CurrentUser() u: JwtPayload, @Query() q: ListMakeupQueryDto) {
    return this.lessons.listMakeups(u.sub, q);
  }

  @Delete('makeup-credits/:id')
  @HttpCode(204)
  cancelMakeup(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.lessons.cancelMakeup(u.sub, id);
  }

  // Bloqueios
  @Get('schedule-blocks')
  listBlocks(@CurrentUser() u: JwtPayload) {
    return this.blocks.list(u.sub);
  }

  @Post('schedule-blocks')
  createBlock(@CurrentUser() u: JwtPayload, @Body() dto: CreateScheduleBlockDto) {
    return this.blocks.create(u.sub, dto);
  }

  @Delete('schedule-blocks/:id')
  @HttpCode(204)
  removeBlock(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.blocks.remove(u.sub, id);
  }
}
