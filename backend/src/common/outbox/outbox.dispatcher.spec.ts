import { Repository } from 'typeorm';
import { OutboxDispatcher } from './outbox.dispatcher';
import { OutboxEmitter } from './outbox.emitter';
import { OutboxEvent, OutboxStatus } from './outbox-event.entity';
import { OutboxService } from './outbox.service';

function makeEvent(over: Partial<OutboxEvent> = {}): OutboxEvent {
  return {
    id: 'e1',
    aggregateType: 'inventory',
    aggregateId: 'a1',
    eventType: 'inventory.posted',
    payload: {},
    status: OutboxStatus.PENDING,
    attempts: 0,
    correlationId: null,
    occurredAt: new Date(),
    publishedAt: null,
    lastError: null,
    ...over,
  };
}

describe('OutboxService.enqueue (ghi trong transaction — GAP-7 DoD)', () => {
  it('dùng repository của EntityManager transaction để lưu', async () => {
    const saved = makeEvent();
    const txRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(async () => saved),
    };
    const manager = { getRepository: jest.fn(() => txRepo) } as any;
    const svc = new OutboxService({ manager } as any);

    const result = await svc.enqueue(manager, {
      aggregateType: 'inventory',
      aggregateId: 'a1',
      eventType: 'inventory.posted',
      correlationId: 'corr-1',
    });

    expect(manager.getRepository).toHaveBeenCalledWith(OutboxEvent);
    expect(txRepo.save).toHaveBeenCalled();
    expect(result).toBe(saved);
  });
});

describe('OutboxDispatcher.dispatchPending', () => {
  it('phát sự kiện PENDING → PUBLISHED + set publishedAt', async () => {
    const event = makeEvent();
    const repo = {
      find: jest.fn(async () => [event]),
      save: jest.fn(async (e) => e),
    } as unknown as Repository<OutboxEvent>;
    const emitter = new OutboxEmitter();
    const received: OutboxEvent[] = [];
    emitter.on('*', (e) => {
      received.push(e);
    });

    const dispatcher = new OutboxDispatcher(repo, emitter);
    const count = await dispatcher.dispatchPending();

    expect(count).toBe(1);
    expect(event.status).toBe(OutboxStatus.PUBLISHED);
    expect(event.publishedAt).toBeInstanceOf(Date);
    expect(received).toHaveLength(1);
    expect(received[0].eventType).toBe('inventory.posted');
  });

  it('lỗi phát → tăng attempts, giữ PENDING đến khi vượt ngưỡng', async () => {
    const event = makeEvent({ attempts: 4 });
    const repo = {
      find: jest.fn(async () => [event]),
      save: jest.fn(async (e) => e),
    } as unknown as Repository<OutboxEvent>;
    const emitter = {
      publish: jest.fn(async () => {
        throw new Error('bus down');
      }),
    } as unknown as OutboxEmitter;

    const dispatcher = new OutboxDispatcher(repo, emitter);
    await dispatcher.dispatchPending();

    expect(event.attempts).toBe(5);
    expect(event.status).toBe(OutboxStatus.FAILED);
    expect(event.lastError).toBe('bus down');
  });

  it('subscriber theo eventType nhận đúng loại', async () => {
    const emitter = new OutboxEmitter();
    const hit: string[] = [];
    emitter.on('inventory.posted', () => {
      hit.push('ok');
    });
    await emitter.publish(makeEvent());
    await emitter.publish(makeEvent({ eventType: 'other.event' }));
    expect(hit).toEqual(['ok']);
  });
});
