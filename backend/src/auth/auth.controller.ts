import { Body, Controller, HttpCode, HttpStatus, Ip, Post, UseGuards } from '@nestjs/common';
import {
  type AdminLoginBody,
  adminLoginBodySchema,
  type AuthSession,
  type AuthTokens,
  type RefreshBody,
  refreshBodySchema,
  type RequestOtpResponse,
  requestOtpBodySchema,
  type SwitchRoleBody,
  switchRoleBodySchema,
  verifyOtpBodySchema,
} from '@apniride/shared';
import type { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AuthGuard } from './auth.guard.js';
import { AdminLoginService } from './admin-login.service.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { OtpService } from './otp.service.js';
import { type AuthUser, TokensService } from './tokens.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly otp: OtpService,
    private readonly auth: AuthService,
    private readonly tokens: TokensService,
    private readonly adminLogin: AdminLoginService,
  ) {}

  /** Sends a 6-digit code by SMS (passenger / driver mode). Same response whether or not the number has an account. */
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  request(
    @Body(new ZodValidationPipe(requestOtpBodySchema)) body: z.output<typeof requestOtpBodySchema>,
    @Ip() ip: string,
  ): Promise<RequestOtpResponse> {
    return this.otp.request(body.phone, body.role, ip);
  }

  /** Exchanges a valid code for tokens. Creates the account on first sign-in. */
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  verify(
    @Body(new ZodValidationPipe(verifyOtpBodySchema)) body: z.output<typeof verifyOtpBodySchema>,
  ): Promise<AuthSession> {
    return this.auth.verifyOtp(body.phone, body.role, body.code);
  }

  /** The admin panel: ADMIN_USERNAME + ADMIN_PASSWORD from backend/.env. */
  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  adminSignIn(
    @Body(new ZodValidationPipe(adminLoginBodySchema)) body: AdminLoginBody,
    @Ip() ip: string,
  ): Promise<AuthSession> {
    return this.adminLogin.login(body.username, body.password, ip);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body(new ZodValidationPipe(refreshBodySchema)) body: RefreshBody): Promise<AuthTokens> {
    return this.tokens.refresh(body.refreshToken);
  }

  /** Passenger ↔ driver mode in the mobile app. Returns a new session; the old one stops working. */
  @Post('switch-role')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  switchRole(
    @CurrentUser() me: AuthUser,
    @Body(new ZodValidationPipe(switchRoleBodySchema)) body: SwitchRoleBody,
  ): Promise<AuthSession> {
    return this.auth.switchRole(me, body.role, body.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body(new ZodValidationPipe(refreshBodySchema)) body: RefreshBody): Promise<void> {
    await this.tokens.revoke(body.refreshToken);
  }
}
