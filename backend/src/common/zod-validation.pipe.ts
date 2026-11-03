import { HttpStatus, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { AppException } from './app-exception.js';

/** Codes we put in Zod issue messages (see packages/shared/src/auth.ts) that are worth surfacing as-is. */
const SURFACED_CODES = new Set(['invalid_phone', 'invalid_code', 'name_too_short', 'name_too_long']);

/** Validates (and transforms, e.g. phone → E.164) a request body with a shared Zod schema. */
export class ZodValidationPipe<S extends z.ZodType> implements PipeTransform<unknown, z.output<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.output<S> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    const issue = result.error.issues[0];
    const code = issue && SURFACED_CODES.has(issue.message) ? issue.message : 'validation_failed';
    const where = issue?.path.length ? `${issue.path.join('.')}: ` : '';
    throw new AppException(HttpStatus.BAD_REQUEST, code, `${where}${issue?.message ?? 'invalid body'}`);
  }
}
