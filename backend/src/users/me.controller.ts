import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Put,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MAX_PROFILE_PHOTO_BYTES, type User, updateProfileBodySchema } from '@apniride/shared';
import type { Response } from 'express';
import type { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../auth/tokens.service.js';
import { AppException } from '../common/app-exception.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { UsersService } from './users.service.js';

/** What multer gives us with its default in-memory storage. */
interface UploadedPhoto {
  buffer: Buffer;
}

/** The signed-in person's own account, in either mode. */
@Controller('me')
@UseGuards(AuthGuard)
export class MeController {
  constructor(private readonly users: UsersService) {}

  @Get()
  get(@CurrentUser() me: AuthUser): Promise<User> {
    return this.users.get(me.userId, me.role);
  }

  @Patch()
  update(
    @CurrentUser() me: AuthUser,
    @Body(new ZodValidationPipe(updateProfileBodySchema))
    body: z.output<typeof updateProfileBodySchema>,
  ): Promise<User> {
    return this.users.updateName(me.userId, me.role, body.name);
  }

  /** Deletes the account. 409 go_offline_first / active_ride_exists while busy. Safe to repeat. */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() me: AuthUser): Promise<void> {
    await this.users.deleteAccount(me.userId);
  }

  /** Private: only the person themself gets it (with their access token). */
  @Get('photo')
  async photo(@CurrentUser() me: AuthUser, @Res() res: Response): Promise<void> {
    const photo = await this.users.getPhoto(me.userId);
    if (!photo) throw new AppException(HttpStatus.NOT_FOUND, 'not_found', 'No profile photo');
    res.setHeader('Content-Type', photo.contentType);
    // The app adds ?v=<photoUpdatedAt>, so a private cache on the phone is safe and saves data.
    res.setHeader('Cache-Control', 'private, max-age=604800');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(photo.data);
  }

  /** multipart/form-data with the photo in the "file" field. */
  @Put('photo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_PROFILE_PHOTO_BYTES, files: 1, fields: 5 } }))
  setPhoto(@CurrentUser() me: AuthUser, @UploadedFile() file: UploadedPhoto | undefined): Promise<User> {
    return this.users.setPhoto(me.userId, me.role, file?.buffer);
  }

  @Delete('photo')
  removePhoto(@CurrentUser() me: AuthUser): Promise<User> {
    return this.users.removePhoto(me.userId, me.role);
  }
}
