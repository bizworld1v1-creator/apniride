import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { type FareEstimateBody, fareEstimateBodySchema, type FareEstimateResponse } from '@apniride/shared';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../auth/tokens.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { FaresService } from './fares.service.js';

@Controller('fares')
@UseGuards(AuthGuard)
export class FaresController {
  constructor(private readonly fares: FaresService) {}

  /** Fixed fares for bike and car between two points. The quote is held for 10 minutes. */
  @Post('estimate')
  @HttpCode(HttpStatus.OK)
  estimate(
    @CurrentUser() me: AuthUser,
    @Body(new ZodValidationPipe(fareEstimateBodySchema)) body: FareEstimateBody,
  ): Promise<FareEstimateResponse> {
    return this.fares.estimate(me.userId, body);
  }
}
