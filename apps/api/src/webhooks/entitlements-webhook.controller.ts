import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { EntitlementsWebhookService } from './entitlements-webhook.service';

/** POST /v1/webhooks/entitlements — chamado pelo backoffice Tagen. */
@Public()
@Controller('webhooks')
export class EntitlementsWebhookController {
  constructor(private readonly service: EntitlementsWebhookService) {}

  @Post('entitlements')
  @HttpCode(200)
  entitlements(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-tagen-timestamp') timestamp?: string,
    @Headers('x-tagen-signature') signature?: string,
  ) {
    return this.service.handle(req.rawBody, timestamp, signature);
  }
}
