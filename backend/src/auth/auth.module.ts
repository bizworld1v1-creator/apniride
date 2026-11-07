import { Module } from '@nestjs/common';
import { AdminLoginService } from './admin-login.service.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { OtpService } from './otp.service.js';
import { ConsoleSmsSender, SmsSender } from './sms.sender.js';
import { TokensService } from './tokens.service.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    AdminLoginService,
    OtpService,
    TokensService,
    AuthGuard,
    // SMS_PROVIDER=console is the only option for now; plug a real SMS gateway in here later.
    { provide: SmsSender, useClass: ConsoleSmsSender },
  ],
  exports: [TokensService, AuthGuard, AdminLoginService],
})
export class AuthModule {}
