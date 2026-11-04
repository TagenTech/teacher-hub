import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Teacher } from '../professor/entities/teacher.entity';
import { EntitlementsWebhookController } from './entitlements-webhook.controller';
import { EntitlementsWebhookService } from './entitlements-webhook.service';
import { WebhookEvent } from './entities/webhook-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WebhookEvent, Teacher])],
  controllers: [EntitlementsWebhookController],
  providers: [EntitlementsWebhookService],
})
export class WebhooksModule {}
