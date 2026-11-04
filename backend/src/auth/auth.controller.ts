import { Body, Controller, HttpCode, HttpStatus, Ip, Post } from '@nestjs/common';
import {
  type AuthSession,
  type AuthTokens,
  type RefreshBody,
  refreshBodySchema,
  type RequestOtpResponse,
  requestOtpBodySchema,
  verifyOtpBodySchema,
} from '@apniride/shared';
import type { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AuthService } from './auth.service.js';
import { OtpService } from './otp.service.js';
import { TokensService } from './tokens.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly otp: OtpService,
    private readonly auth: AuthService,
    private readonly tokens: TokensService,
  ) {}

  /** Sends a 6-digit code by SMS. Same response whether or not the number has an account (or is an admin). */
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  async request(
    @Body(new ZodValidationPipe(requestOtpBodySchema)) body: z.output<typeof requestOtpBodySchema>,
    @Ip() ip: string,
  ): Promise<RequestOtpResponse> {
    const deliver = body.role !== 'admin' || (await this.auth.activeAdminId(body.phone)) !== null;
    return this.otp.request(body.phone, body.role, ip, deliver);
  }

  /** Exchanges a valid code for tokens. Creates the account on first sign-in. */
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  verify(
    @Body(new ZodValidationPipe(verifyOtpBodySchema)) body: z.output<typeof verifyOtpBodySchema>,
  ): Promise<AuthSession> {
    return this.auth.verifyOtp(body.phone, body.role, body.code);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body(new ZodValidationPipe(refreshBodySchema)) body: RefreshBody): Promise<AuthTokens> {
    return this.tokens.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body(new ZodValidationPipe(refreshBodySchema)) body: RefreshBody): Promise<void> {
    await this.tokens.revoke(body.refreshToken);
  }
}
