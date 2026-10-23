import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { monthOf, todayIn } from '@aulinha/contracts';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload';
import { BillingService } from './billing.service';
import { ChargesService } from './charges.service';
import {
  CloseMonthDto,
  CreateChargeDto,
  ListChargesQueryDto,
  MonthQueryDto,
  RegisterPaymentDto,
  UpdateChargeDto,
} from './dto/finance.dto';

@ApiTags('financeiro')
@ApiBearerAuth()
@Controller()
export class FinanceController {
  constructor(
    private readonly charges: ChargesService,
    private readonly billing: BillingService,
  ) {}

  @Get('charges')
  list(@CurrentUser() u: JwtPayload, @Query() q: ListChargesQueryDto) {
    return this.charges.list(u.sub, q);
  }

  @Get('finance/summary')
  summary(@CurrentUser() u: JwtPayload, @Query() q: MonthQueryDto) {
    return this.charges.summary(u.sub, q.month);
  }

  @Get('finance/highlights')
  highlights(@CurrentUser() u: JwtPayload) {
    return this.charges.highlights(u.sub);
  }

  @Get('students/:id/billing-preview')
  preview(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.billing.preview(u.sub, id, monthOf(todayIn()));
  }

  @Post('charges/close-month')
  async closeMonth(@CurrentUser() u: JwtPayload, @Body() dto: CloseMonthDto) {
    return { created: await this.billing.closeMonth(u.sub, dto.studentId, dto.month) };
  }

  @Post('charges')
  create(@CurrentUser() u: JwtPayload, @Body() dto: CreateChargeDto) {
    return this.charges.create(u.sub, dto);
  }

  @Get('charges/:id')
  get(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.charges.get(u.sub, id);
  }

  @Patch('charges/:id')
  update(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateChargeDto) {
    return this.charges.update(u.sub, id, dto);
  }

  @Post('charges/:id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.charges.cancel(u.sub, id);
  }

  @Post('charges/:id/reopen')
  @HttpCode(200)
  reopen(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.charges.reopen(u.sub, id);
  }

  @Delete('charges/:id')
  @HttpCode(204)
  remove(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.charges.remove(u.sub, id);
  }

  @Get('charges/:id/whatsapp')
  whatsapp(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.charges.whatsapp(u.sub, id);
  }

  @Post('charges/:id/payments')
  pay(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RegisterPaymentDto) {
    return this.charges.registerPayment(u.sub, id, dto);
  }

  @Delete('payments/:id')
  removePayment(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.charges.removePayment(u.sub, id);
  }

  @Get('payments/:id/receipt')
  receipt(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.charges.receipt(u.sub, id);
  }
}
