import { Inject, Injectable } from '@nestjs/common';
import type { AuditEntry } from '@apniride/shared';
import type pg from 'pg';
import { PG_POOL } from '../database/database.module.js';

export type AuditTarget = 'driver' | 'fare_rate';

/** Who changed what. Write an entry for every admin change; never put CNIC numbers or photos in details. */
@Injectable()
export class AuditService {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  async record(
    adminId: string,
    action: string,
    targetType: AuditTarget,
    targetId: string,
    details: Record<string, unknown> = {},
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5)`,
      [adminId, action, targetType, targetId, JSON.stringify(details)],
    );
  }

  /** Newest first. */
  async history(targetType: AuditTarget, targetId: string, limit = 50): Promise<AuditEntry[]> {
    const { rows } = await this.pool.query<{
      action: string;
      name: string | null;
      details: Record<string, unknown>;
      created_at: Date;
    }>(
      `SELECT l.action, u.name, l.details, l.created_at
         FROM admin_audit_log l JOIN users u ON u.id = l.admin_id
        WHERE l.target_type = $1 AND l.target_id = $2
        ORDER BY l.created_at DESC, l.id DESC
        LIMIT $3`,
      [targetType, targetId, limit],
    );
    return rows.map((r) => ({ action: r.action, adminName: r.name, details: r.details, at: r.created_at.toISOString() }));
  }
}
