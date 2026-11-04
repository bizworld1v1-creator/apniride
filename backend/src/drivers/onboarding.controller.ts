import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  type DriverDocumentType,
  driverDetailsBodySchema,
  driverDocumentTypeSchema,
  type DriverOnboarding,
  MAX_DOCUMENT_BYTES,
} from '@apniride/shared';
import type { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { assertRole } from '../auth/roles.js';
import type { AuthUser } from '../auth/tokens.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { OnboardingService } from './onboarding.service.js';

/** What multer gives us with its default in-memory storage. */
interface UploadedPhoto {
  buffer: Buffer;
  size: number;
}

@Controller('driver/onboarding')
@UseGuards(AuthGuard)
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get()
  get(@CurrentUser() me: AuthUser): Promise<DriverOnboarding> {
    assertRole(me, 'driver');
    return this.onboarding.get(me.userId);
  }

  @Put('details')
  saveDetails(
    @CurrentUser() me: AuthUser,
    @Body(new ZodValidationPipe(driverDetailsBodySchema)) body: z.output<typeof driverDetailsBodySchema>,
  ): Promise<DriverOnboarding> {
    assertRole(me, 'driver');
    return this.onboarding.saveDetails(me.userId, body);
  }

  /** multipart/form-data with the photo in the "file" field. Kept in memory: photos are small (≤ 5 MB). */
  @Put('documents/:type')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1, fields: 5 } }))
  upload(
    @CurrentUser() me: AuthUser,
    @Param('type', new ZodValidationPipe(driverDocumentTypeSchema)) type: DriverDocumentType,
    @UploadedFile() file: UploadedPhoto | undefined,
  ): Promise<DriverOnboarding> {
    assertRole(me, 'driver');
    return this.onboarding.uploadDocument(me.userId, type, file?.buffer);
  }

  @Post('submit')
  @HttpCode(HttpStatus.OK)
  submit(@CurrentUser() me: AuthUser): Promise<DriverOnboarding> {
    assertRole(me, 'driver');
    return this.onboarding.submit(me.userId);
  }
}
