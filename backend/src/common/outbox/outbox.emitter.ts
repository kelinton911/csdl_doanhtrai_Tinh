import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';
import { OutboxEvent } from './outbox-event.entity';

export type OutboxHandler = (event: OutboxEvent) => void | Promise<void>;

// Kênh phát sự kiện in-process cho subscriber trong monolith (DT-06/DT-12…).
// Lộ trình: thay bằng Redis/queue thật khi tách dịch vụ, không đổi hợp đồng subscriber.
@Injectable()
export class OutboxEmitter {
  private readonly emitter = new EventEmitter();

  constructor() {
    // Nhiều phân hệ có thể lắng nghe cùng một loại sự kiện.
    this.emitter.setMaxListeners(100);
  }

  // Đăng ký theo eventType cụ thể, hoặc '*' để nhận mọi sự kiện.
  on(eventType: string, handler: OutboxHandler): void {
    this.emitter.on(eventType, handler);
  }

  async publish(event: OutboxEvent): Promise<void> {
    // Phát cho listener theo loại và listener '*' (giám sát/log/lineage).
    this.emitter.emit(event.eventType, event);
    this.emitter.emit('*', event);
  }
}
