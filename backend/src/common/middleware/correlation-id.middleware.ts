import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

// X-Correlation-ID xuyên suốt request/job (Observable system, truy nguyên).
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.headers['x-correlation-id'];
    const correlationId =
      typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();
    (req as Request & { correlationId: string }).correlationId = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);
    next();
  }
}
