import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import {
  type AdminDriverDetail,
  adminDriverListQuerySchema,
  type AdminDriverSummary,
  type DriverDocumentType,
  driverDocumentTypeSchema,
  reviewNoteBodySchema,
} from '@apniride/shared';
import type { Response } from 'express';
import type { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../auth/tokens.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AdminGuard } from './admin.guard.js';
import { DriverReviewService } from './driver-review.service.js';

type Reason = z.output<typeof reviewNoteBodySchema>;

/** Driver review for the admin panel. Every action is written to the audit log. */
@Controller('admin/drivers')
@UseGuards(AdminGuard)
export class AdminDriversController {
  constructor(private readonly review: DriverReviewService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(adminDriverListQuerySchema)) query: z.output<typeof adminDriverListQuerySchema>,
  ): Promise<AdminDriverSummary[]> {
    return this.review.list(query.status);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<AdminDriverDetail> {
    return this.review.get(id);
  }

  /** The photo itself. Personal data: never cached by browsers or proxies. */
  @Get(':id/documents/:type')
  async document(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('type', new ZodValidationPipe(driverDocumentTypeSchema)) type: DriverDocumentType,
    @Res() res: Response,
  ): Promise<void> {
    const doc = await this.review.document(id, type);
    res.setHeader('Content-Type', doc.contentType);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(doc.data);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  approve(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<AdminDriverDetail> {
    return this.review.review(me.userId, id, 'approve', null);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @CurrentUser() me: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(reviewNoteBodySchema)) body: Reason,
  ): Promise<AdminDriverDetail> {
    return this.review.review(me.userId, id, 'reject', body.reason);
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  suspend(
    @CurrentUser() me: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(reviewNoteBodySchema)) body: Reason,
  ): Promise<AdminDriverDetail> {
    return this.review.review(me.userId, id, 'suspend', body.reason);
  }
}
