import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

// Chuẩn hóa lỗi theo application/problem+json với `code` ổn định
// (Tài liệu mô tả Backend §8). Mọi lỗi đều có correlationId để truy nguyên.
@Catch()
export class ProblemExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  // Ánh xạ HTTP status → mã lỗi nghiệp vụ mặc định (Hồ sơ TKKT §6.4).
  private codeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return 'AUTH-001';
      case HttpStatus.FORBIDDEN:
        return 'AUTH-003';
      case HttpStatus.NOT_FOUND:
        return 'DATA-001';
      case HttpStatus.CONFLICT:
        return 'DATA-003';
      case HttpStatus.UNPROCESSABLE_ENTITY:
      case HttpStatus.BAD_REQUEST:
        return 'VAL-001';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'SYS-003';
      default:
        return 'SYS-001';
    }
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { correlationId?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Lỗi nội bộ';
    let errors: unknown[] | undefined;
    let explicitCode: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        const rawMsg = b.message;
        if (Array.isArray(rawMsg)) {
          errors = rawMsg; // Lỗi validation từ class-validator.
          message = 'Dữ liệu không hợp lệ';
        } else if (typeof rawMsg === 'string') {
          message = rawMsg;
        }
      }
    } else if (exception instanceof Error) {
      message = 'Lỗi nội bộ';
      this.logger.error(exception.message, exception.stack);
    }

    // Nếu message có tiền tố mã (ví dụ "AUTH-001: ..."), dùng làm code chính thức.
    const prefixMatch = /^([A-Z]{2,5}-\d{3}):\s*(.*)$/.exec(message);
    if (prefixMatch) {
      explicitCode = prefixMatch[1];
      message = prefixMatch[2];
    }

    const problem = {
      type: 'about:blank',
      title: message,
      status,
      code: explicitCode ?? this.codeForStatus(status),
      correlationId: req.correlationId ?? null,
      instance: req.originalUrl,
      ...(errors ? { errors } : {}),
    };

    res
      .status(status)
      .setHeader('Content-Type', 'application/problem+json; charset=utf-8');
    res.json(problem);
  }
}
