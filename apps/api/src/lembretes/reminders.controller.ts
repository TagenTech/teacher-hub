import { Body, Controller, Delete, Get, Header, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { JwtPayload } from '../common/types/jwt-payload';
import { CalendarService } from './calendar.service';
import { SubscribeDto, UnsubscribeDto } from './dto/push.dto';
import { PushService } from './push.service';
import { RemindersService } from './reminders.service';

@ApiTags('lembretes')
@Controller()
export class RemindersController {
  constructor(
    private readonly push: PushService,
    private readonly reminders: RemindersService,
    private readonly calendar: CalendarService,
  ) {}

  @ApiBearerAuth()
  @Get('push/status')
  status(@CurrentUser() u: JwtPayload) {
    return this.push.status(u.sub);
  }

  @ApiBearerAuth()
  @Post('push/subscribe')
  @HttpCode(204)
  subscribe(@CurrentUser() u: JwtPayload, @Body() dto: SubscribeDto) {
    return this.push.subscribe(u.sub, dto);
  }

  @ApiBearerAuth()
  @Delete('push/subscribe')
  @HttpCode(204)
  unsubscribe(@CurrentUser() u: JwtPayload, @Body() dto: UnsubscribeDto) {
    return this.push.unsubscribe(u.sub, dto.endpoint);
  }

  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('push/test')
  async test(@CurrentUser() u: JwtPayload) {
    return { delivered: await this.reminders.test(u.sub) };
  }

  @ApiBearerAuth()
  @Get('calendar/feed')
  feed(@CurrentUser() u: JwtPayload) {
    return this.calendar.feedInfo(u.sub);
  }

  @ApiBearerAuth()
  @Post('calendar/rotate')
  rotate(@CurrentUser() u: JwtPayload) {
    return this.calendar.feedInfo(u.sub, true);
  }

  /** Público: o calendário do celular busca sem login. O token secreto na URL é a credencial. */
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get('calendar/:file')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Cache-Control', 'private, max-age=300')
  ics(@Param('file') file: string) {
    return this.calendar.ics(file.replace(/\.ics$/, ''));
  }
}
