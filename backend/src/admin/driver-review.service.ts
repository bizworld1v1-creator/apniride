import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  type AdminDriverDetail,
  type AdminDriverSummary,
  cnicGender,
  type DriverApprovalStatus,
  type Gender,
  SOCKET_EVENTS,
  type VehicleType,
} from '@apniride/shared';
import type pg from 'pg';
import { AppException } from '../common/app-exception.js';
import { PG_POOL } from '../database/database.module.js';
import { DriversService } from '../drivers/drivers.service.js';
import { OnboardingService } from '../drivers/onboarding.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { AuditService } from './audit.service.js';

/** Which statuses each admin action may start from. */
const TRANSITIONS = {
  approve: { from: ['pending', 'suspended'], to: 'approved' },
  reject: { from: ['pending'], to: 'rejected' },
  suspend: { from: ['approved'], to: 'suspended' },
} as const satisfies Record<string, { from: readonly DriverApprovalStatus[]; to: DriverApprovalStatus }>;

export type ReviewAction = keyof typeof TRANSITIONS;

interface SummaryRow {
  user_id: string;
  name: string | null;
  phone: string;
  approval_status: DriverApprovalStatus;
  vehicle_type: VehicleType;
  gender: Gender | null;
  submitted_at: Date | null;
  created_at: Date;
}

/** The admin side of onboarding: review queue, approve / reject / suspend. */
@Injectable()
export class DriverReviewService {
  constructor(
    @Inject(PG_POOL) private readonly pool: pg.Pool,
    private readonly onboarding: OnboardingService,
    private readonly drivers: DriversService,
    private readonly realtime: RealtimeGateway,
    private readonly audit: AuditService,
  ) {}

  /** Pending applications oldest first (first come, first served); otherwise newest first. */
  async list(status?: DriverApprovalStatus): Promise<AdminDriverSummary[]> {
    const { rows } = await this.pool.query<SummaryRow>(
      `SELECT d.user_id, u.name, COALESCE(u.phone, 'deleted account') AS phone, d.approval_status, d.vehicle_type, d.gender, d.submitted_at, d.created_at
       FROM drivers d JOIN users u ON u.id = d.user_id
       WHERE $1::text IS NULL OR d.approval_status = $1
       ORDER BY CASE WHEN $1 = 'pending' THEN d.submitted_at END ASC NULLS LAST, d.created_at DESC
       LIMIT 200`,
      [status ?? null],
    );
    return rows.map(toSummary);
  }

  async get(driverId: string): Promise<AdminDriverDetail> {
    const { rows } = await this.pool.query<{ name: string | null; phone: string }>(
      "SELECT name, COALESCE(phone, 'deleted account') AS phone FROM users u JOIN drivers d ON d.user_id = u.id WHERE u.id = $1",
      [driverId],
    );
    const user = rows[0];
    if (!user) throw notFound();
    const app = await this.onboarding.load(driverId);
    const { row, details } = app;
    const hint = details ? cnicGender(details.cnic) : null;
    return {
      ...toSummary({ ...row, name: user.name, phone: user.phone }),
      details,
      documents: app.documents,
      missingDocuments: app.missingDocuments,
      cnicGenderMatches: details && hint && details.gender !== 'other' ? hint === details.gender : null,
      reviewNote: row.review_note,
      reviewedAt: row.reviewed_at?.toISOString() ?? null,
      history: await this.audit.history('driver', driverId),
    };
  }

  /**
   * Moves the driver to the action's status. Repeating an action that already happened returns the driver
   * unchanged (double click in the admin panel). A reason is required for reject and suspend.
   */
  async review(
    adminId: string,
    driverId: string,
    action: ReviewAction,
    reason: string | null,
  ): Promise<AdminDriverDetail> {
    const { from, to } = TRANSITIONS[action];
    const { rowCount } = await this.pool.query(
      `UPDATE drivers SET approval_status = $2, review_note = $3, reviewed_at = now(), updated_at = now()
       WHERE user_id = $1 AND approval_status = ANY($4)`,
      [driverId, to, reason, from],
    );
    if (rowCount === 0) {
      const current = await this.get(driverId); // 404 if there's no such driver
      if (current.status === to) return current;
      throw new AppException(
        HttpStatus.CONFLICT,
        'invalid_driver_state',
        `Can't ${action} a driver who is ${current.status}`,
      );
    }
    await this.audit.record(adminId, `driver.${action}`, 'driver', driverId, reason ? { reason } : {});
    // A suspended driver stops getting offers at once. A ride already under way can still be finished.
    if (to === 'suspended') await this.drivers.goOffline(driverId);
    this.realtime.toDriver(driverId, SOCKET_EVENTS.driverReviewed, { status: to });
    return this.get(driverId);
  }

  async document(driverId: string, type: Parameters<OnboardingService['readDocument']>[1]) {
    const doc = await this.onboarding.readDocument(driverId, type);
    if (!doc) throw new AppException(HttpStatus.NOT_FOUND, 'document_not_found', 'No such document');
    return doc;
  }
}

const notFound = () => new AppException(HttpStatus.NOT_FOUND, 'driver_not_found', 'No such driver');

function toSummary(r: SummaryRow): AdminDriverSummary {
  return {
    id: r.user_id,
    name: r.name,
    phone: r.phone,
    status: r.approval_status,
    vehicleType: r.vehicle_type,
    gender: r.gender,
    submittedAt: r.submitted_at?.toISOString() ?? null,
    createdAt: r.created_at.toISOString(),
  };
}
