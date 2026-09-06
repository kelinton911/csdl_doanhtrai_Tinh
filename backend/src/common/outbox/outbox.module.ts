import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxEvent } from './outbox-event.entity';
import { OutboxService } from './outbox.service';
import { OutboxEmitter } from './outbox.emitter';
import { OutboxDispatcher } from './outbox.dispatcher';

// Nền tảng outbox dùng chung (Global) — mọi phân hệ inject OutboxService để ghi
// sự kiện trong transaction; OutboxEmitter để đăng ký subscriber in-process.
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([OutboxEvent])],
  providers: [OutboxService, OutboxEmitter, OutboxDispatcher],
  exports: [OutboxService, OutboxEmitter],
})
export class OutboxModule {}
