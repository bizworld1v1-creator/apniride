import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { maskPhone, MAX_PROFILE_PHOTO_BYTES, type User, type UserRole } from '@apniride/shared';
import type { Redis } from 'ioredis';
import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import { AppException } from '../common/app-exception.js';
import { assertNotBusy } from '../common/assert-not-busy.js';
import { PG_POOL } from '../database/database.module.js';
import { detectImageType, IMAGE_EXTENSIONS } from '../drivers/image-type.js';
import { REDIS } from '../redis/redis.module.js';
import { FileStorage } from '../storage/file-storage.js';

type UserRow = { id: string; name: string | null; phone: string | null; photo_updated_at: Date | null };

const USER_COLUMNS = 'id, name, phone, photo_updated_at';

/** Signed-in requests from an account that no longer exists (deleted, or tokens from before deletion). */
const gone = () => new AppException(HttpStatus.UNAUTHORIZED, 'unauthorized', 'Account not found');

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: pg.Pool,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly storage: FileStorage,
  ) {}

  async get(userId: string, role: UserRole): Promise<User> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT ${USER_COLUMNS} FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId],
    );
    return this.toUser(rows[0], role);
  }

  async updateName(userId: string, role: UserRole, name: string): Promise<User> {
    const { rows } = await this.pool.query<UserRow>(
      `UPDATE users SET name = $2, updated_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING ${USER_COLUMNS}`,
      [userId, name],
    );
    return this.toUser(rows[0], role);
  }

  /** Stores (or replaces) the profile photo. JPEG / PNG only, checked from the bytes. */
  async setPhoto(userId: string, role: UserRole, data: Buffer | undefined): Promise<User> {
    if (!data || data.length === 0) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'invalid_image', 'Attach a photo in the "file" field');
    }
    if (data.length > MAX_PROFILE_PHOTO_BYTES) {
      throw new AppException(HttpStatus.PAYLOAD_TOO_LARGE, 'file_too_large', 'Photo is too large');
    }
    const contentType = detectImageType(data);
    if (!contentType) throw new AppException(HttpStatus.BAD_REQUEST, 'invalid_image', 'Only JPEG or PNG photos');

    // A new key per upload, so a slow earlier upload can never overwrite a newer photo.
    const key = `users/${userId}/photo-${randomBytes(8).toString('hex')}.${IMAGE_EXTENSIONS[contentType]}`;
    await this.storage.put(key, data);
    let result: { row: UserRow | undefined; previous: string | null };
    try {
      const { rows } = await this.pool.query<UserRow & { previous_key: string | null }>(
        `WITH previous AS (SELECT photo_key FROM users WHERE id = $1)
         UPDATE users SET photo_key = $2, photo_updated_at = now(), updated_at = now()
          WHERE id = $1 AND deleted_at IS NULL
         RETURNING ${USER_COLUMNS}, (SELECT photo_key FROM previous) AS previous_key`,
        [userId, key],
      );
      result = { row: rows[0], previous: rows[0]?.previous_key ?? null };
    } catch (err) {
      await this.storage.delete(key).catch(() => undefined);
      throw err;
    }
    if (!result.row) {
      await this.storage.delete(key).catch(() => undefined);
      throw gone();
    }
    if (result.previous) await this.deleteFile(result.previous);
    return this.toUser(result.row, role);
  }

  async removePhoto(userId: string, role: UserRole): Promise<User> {
    const { rows } = await this.pool.query<UserRow & { previous_key: string | null }>(
      `WITH previous AS (SELECT photo_key FROM users WHERE id = $1)
       UPDATE users SET photo_key = NULL, photo_updated_at = NULL, updated_at = now()
        WHERE id = $1 AND deleted_at IS NULL
       RETURNING ${USER_COLUMNS}, (SELECT photo_key FROM previous) AS previous_key`,
      [userId],
    );
    const row = rows[0];
    if (row?.previous_key) await this.deleteFile(row.previous_key);
    return this.toUser(row, role);
  }

  /** The user's own photo, or null if they have none. Only ever served to the user themself. */
  async getPhoto(userId: string): Promise<{ data: Buffer; contentType: string } | null> {
    const { rows } = await this.pool.query<{ photo_key: string | null }>(
      'SELECT photo_key FROM users WHERE id = $1 AND deleted_at IS NULL',
      [userId],
    );
    const key = rows[0]?.photo_key;
    if (!key) return null;
    const data = await this.storage.get(key);
    if (!data) return null;
    return { data, contentType: key.endsWith('.png') ? 'image/png' : 'image/jpeg' };
  }

  /**
   * Deletes the account (Play Store requires this to be possible in the app). Removes the phone number, name,
   * profile photo, saved places, driver document photos and every session. Ride records stay, without the
   * person's number, for safety and complaints. The driver row (CNIC, licence, vehicle) also stays, marked
   * suspended, so a removed driver can't simply sign up again with the same CNIC.
   */
  async deleteAccount(userId: string): Promise<void> {
    await assertNotBusy(this.pool, this.redis, userId);
    const isAdmin = await this.pool.query('SELECT 1 FROM admins WHERE user_id = $1', [userId]);
    if (isAdmin.rowCount) {
      throw new AppException(HttpStatus.FORBIDDEN, 'wrong_app', 'Admins are removed with pnpm admins, not in the app');
    }

    const client = await this.pool.connect();
    const files: string[] = [];
    try {
      await client.query('BEGIN');
      const user = await client.query<{ photo_key: string | null }>(
        'SELECT photo_key FROM users WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
        [userId],
      );
      if (!user.rows[0]) {
        // Already deleted (e.g. a retry after a lost response).
        await client.query('ROLLBACK');
        return;
      }
      if (user.rows[0].photo_key) files.push(user.rows[0].photo_key);
      const docs = await client.query<{ storage_key: string }>(
        'DELETE FROM driver_documents WHERE driver_id = $1 RETURNING storage_key',
        [userId],
      );
      files.push(...docs.rows.map((r) => r.storage_key));
      await client.query(
        `UPDATE drivers SET approval_status = 'suspended', review_note = 'Account deleted by the user', updated_at = now()
          WHERE user_id = $1`,
        [userId],
      );
      await client.query('DELETE FROM saved_places WHERE user_id = $1', [userId]);
      await client.query('UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [
        userId,
      ]);
      await client.query(
        `UPDATE users SET phone = NULL, name = NULL, photo_key = NULL, photo_updated_at = NULL,
                deleted_at = now(), updated_at = now()
          WHERE id = $1`,
        [userId],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
    for (const key of files) await this.deleteFile(key);
  }

  private async deleteFile(key: string) {
    await this.storage.delete(key).catch((err: Error) => this.logger.warn(`could not delete file: ${err.message}`));
  }

  private toUser(row: UserRow | undefined, role: UserRole): User {
    if (!row?.phone) throw gone();
    // The user's own number, still masked: apps never need the full number.
    return {
      id: row.id,
      role,
      name: row.name,
      phoneMasked: maskPhone(row.phone),
      photoUpdatedAt: row.photo_updated_at?.toISOString() ?? null,
    };
  }
}
