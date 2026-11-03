import { HttpException, HttpStatus } from '@nestjs/common';
import type { ApiErrorBody } from '@apniride/shared';

/**
 * Error with a machine-readable `code` the apps translate (English/Urdu).
 * Serialised by AllExceptionsFilter as ApiErrorBody.
 */
export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    public readonly code: string,
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    const body: ApiErrorBody = {
      statusCode: status,
      code,
      message,
      ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
    };
    super(body, status);
  }
}
