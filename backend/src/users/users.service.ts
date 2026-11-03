import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { maskPhone, type User, type UserRole } from '@apniride/shared';
import type pg from 'pg';
import { AppException } from '../common/app-exception.js';
import { PG_POOL } from '../database/database.module.js';

type UserRow = { id: string; name: string | null; phone: string };

@Injectable()
export class UsersService {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  async get(userId: string, role: UserRole): Promise<User> {
    const { rows } = await this.pool.query<UserRow>(
      'SELECT id, name, phone FROM users WHERE id = $1',
      [userId],
    );
    return this.toUser(rows[0], role);
  }

  async updateName(userId: string, role: UserRole, name: string): Promise<User> {
    const { rows } = await this.pool.query<UserRow>(
      'UPDATE users SET name = $2, updated_at = now() WHERE id = $1 RETURNING id, name, phone',
      [userId, name],
    );
    return this.toUser(rows[0], role);
  }

  private toUser(row: UserRow | undefined, role: UserRole): User {
    if (!row) throw new AppException(HttpStatus.UNAUTHORIZED, 'unauthorized', 'Account not found');
    // The user's own number, still masked: apps never need the full number.
    return { id: row.id, role, name: row.name, phoneMasked: maskPhone(row.phone) };
  }
}
