import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload';
import { CreateBillingPlanDto } from './dto/billing-plan.dto';
import {
  ChangeStudentStatusDto,
  CreateStudentDto,
  ListStudentsQueryDto,
  UpdateStudentDto,
} from './dto/student.dto';
import { StudentsService } from './students.service';

@ApiTags('alunos')
@ApiBearerAuth()
@Controller('students')
export class StudentsController {
  constructor(private readonly service: StudentsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: ListStudentsQueryDto) {
    return this.service.list(user.sub, query);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateStudentDto) {
    return this.service.create(user.sub, dto);
  }

  @Get(':id')
  detail(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.detail(user.sub, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStudentDto) {
    return this.service.update(user.sub, id, dto);
  }

  @Post(':id/status')
  @HttpCode(200)
  changeStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStudentStatusDto,
  ) {
    return this.service.changeStatus(user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(user.sub, id);
  }

  @Post(':id/plans')
  addPlan(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateBillingPlanDto,
  ) {
    return this.service.addPlan(user.sub, id, dto);
  }

  @Delete(':id/plans/:planId')
  removeLatestPlan(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('planId', ParseUUIDPipe) planId: string,
  ) {
    return this.service.removeLatestPlan(user.sub, id, planId);
  }
}
