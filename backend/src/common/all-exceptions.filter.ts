import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiErrorBody } from '@apniride/shared';
import type { Response } from 'express';
import { AppException } from './app-exception.js';

const DEFAULT_CODES: Partial<Record<number, string>> = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  // Multer's upload size limit.
  413: 'file_too_large',
  429: 'rate_limited',
};

/** Every error leaves the API in the same shape: { statusCode, code, message, retryAfterSeconds? }. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let body: ApiErrorBody;

    if (exception instanceof AppException) {
      body = exception.getResponse() as ApiErrorBody;
    } else if (exception instanceof HttpException) {
      const status = exception.getStatus();
      body = {
        statusCode: status,
        code: DEFAULT_CODES[status] ?? 'error',
        message: exception.message,
      };
    } else {
      // Don't leak internals (SQL, stack traces) to clients.
      this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
      body = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'internal_error',
        message: 'Something went wrong',
      };
    }

    if (body.retryAfterSeconds !== undefined) res.setHeader('Retry-After', String(body.retryAfterSeconds));
    res.status(body.statusCode).json(body);
  }
}
