import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { type SavedPlace, savedPlaceBodySchema, type SavedPlacesResponse } from '@apniride/shared';
import type { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../auth/tokens.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { PlacesService } from './places.service.js';

type PlaceBody = z.output<typeof savedPlaceBodySchema>;

/** Saved places belong to the person, not the mode (but the app only shows them in passenger mode). */
@Controller('me/places')
@UseGuards(AuthGuard)
export class PlacesController {
  constructor(private readonly places: PlacesService) {}

  @Get()
  async list(@CurrentUser() me: AuthUser): Promise<SavedPlacesResponse> {
    return { places: await this.places.list(me.userId) };
  }

  @Post()
  create(
    @CurrentUser() me: AuthUser,
    @Body(new ZodValidationPipe(savedPlaceBodySchema)) body: PlaceBody,
  ): Promise<SavedPlace> {
    return this.places.create(me.userId, body);
  }

  @Put(':id')
  update(
    @CurrentUser() me: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(savedPlaceBodySchema)) body: PlaceBody,
  ): Promise<SavedPlace> {
    return this.places.update(me.userId, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.places.remove(me.userId, id);
  }
}
