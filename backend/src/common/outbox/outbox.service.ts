import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { OutboxEvent, OutboxStatus } from './outbox-event.entity';

export interface OutboxMessage {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload?: Record<string, unknown>;
  correlationId?: string | null;
}

// Ghi sự kiện vào outbox. Ưu tiên gọi enqueue(manager, msg) BÊN TRONG transaction
// nghiệp vụ để đảm bảo nguyên tử (Sprint 0 §1 GAP-7 DoD: ghi outbox cùng transaction).
@Injectable()
export class OutboxService {
  constructor(
    @InjectRepository(OutboxEvent)
    private readonly repo: Repository<OutboxEvent>,
  ) {}

  // Trong transaction: dùng EntityManager của transaction đó.
  async enqueue(manager: EntityManager, msg: OutboxMessage): Promise<OutboxEvent> {
    const repo = manager.getRepository(OutboxEvent);
    const event = repo.create({
      aggregateType: msg.aggregateType,
      aggregateId: msg.aggregateId,
      eventType: msg.eventType,
      payload: msg.payload ?? {},
      correlationId: msg.correlationId ?? null,
      status: OutboxStatus.PENDING,
      attempts: 0,
    });
    return repo.save(event);
  }

  // Ngoài transaction (best-effort): dùng repository mặc định.
  async emit(msg: OutboxMessage): Promise<OutboxEvent> {
    return this.enqueue(this.repo.manager, msg);
  }
}
