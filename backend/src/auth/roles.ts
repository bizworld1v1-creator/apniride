import { HttpStatus } from '@nestjs/common';
import type { UserRole } from '@apniride/shared';
import { AppException } from '../common/app-exception.js';
import type { AuthUser } from './tokens.service.js';

/** Passenger routes need a passenger-app token, driver routes a driver-app token. */
export function assertRole(user: AuthUser, role: UserRole): void {
  if (user.role !== role) {
    throw new AppException(HttpStatus.FORBIDDEN, 'wrong_app', `Only available in the ${role} app`);
  }
}
