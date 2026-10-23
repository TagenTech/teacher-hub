import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload';
import { ExportQueryDto, ReportQueryDto, SaveFilterDto, UpdateFilterDto } from './dto/reports.dto';
import { ReportsService } from './reports.service';

@ApiTags('relatorios')
@ApiBearerAuth()
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('reports/summary')
  summary(@CurrentUser() u: JwtPayload, @Query() q: ReportQueryDto) {
    return this.reports.summary(u.sub, q);
  }

  @Get('reports/late-payers')
  latePayers(@CurrentUser() u: JwtPayload, @Query() q: ReportQueryDto) {
    return this.reports.latePayers(u.sub, q);
  }

  @Get('reports/attendance')
  attendance(@CurrentUser() u: JwtPayload, @Query() q: ReportQueryDto) {
    return this.reports.attendance(u.sub, q);
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Get('reports/export.csv')
  async export(@CurrentUser() u: JwtPayload, @Query() q: ExportQueryDto, @Res() res: Response) {
    const { filename, body } = await this.reports.csv(u.sub, q.type, q);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(body);
  }

  @Get('saved-filters')
  listFilters(@CurrentUser() u: JwtPayload) {
    return this.reports.listFilters(u.sub);
  }

  @Post('saved-filters')
  saveFilter(@CurrentUser() u: JwtPayload, @Body() dto: SaveFilterDto) {
    return this.reports.saveFilter(u.sub, dto);
  }

  @Patch('saved-filters/:id')
  updateFilter(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFilterDto) {
    return this.reports.updateFilter(u.sub, id, dto);
  }

  @Delete('saved-filters/:id')
  @HttpCode(204)
  removeFilter(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.reports.removeFilter(u.sub, id);
  }
}
