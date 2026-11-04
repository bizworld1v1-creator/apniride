import { randomBytes } from 'node:crypto';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import {
  canEditDriverApplication,
  type DriverApprovalStatus,
  type DriverDetails,
  type DriverDocument,
  type DriverDocumentType,
  type DriverOnboarding,
  driverDetailsBodySchema,
  EDITABLE_DRIVER_STATUSES,
  type Gender,
  MAX_DOCUMENT_BYTES,
  REQUIRED_DRIVER_DOCUMENTS,
  type VehicleType,
} from '@apniride/shared';
import type pg from 'pg';
import type { z } from 'zod';
import { AppException } from '../common/app-exception.js';
import { PG_POOL } from '../database/database.module.js';
import { FileStorage } from '../storage/file-storage.js';
import { detectImageType, IMAGE_EXTENSIONS } from './image-type.js';

type DetailsInput = z.output<typeof driverDetailsBodySchema>;

export interface DriverRow {
  user_id: string;
  vehicle_type: VehicleType;
  approval_status: DriverApprovalStatus;
  gender: Gender | null;
  cnic: string | null;
  licence_number: string | null;
  licence_expiry: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  vehicle_colour: string | null;
  vehicle_plate: string | null;
  submitted_at: Date | null;
  reviewed_at: Date | null;
  review_note: string | null;
  created_at: Date;
}

/** A driver's application as stored: the row and their current documents. */
export interface Application {
  row: DriverRow;
  details: DriverDetails | null;
  documents: DriverDocument[];
  missingDocuments: DriverDocumentType[];
}

/** Dates as text, so a date never shifts by the server's time zone. */
export const DRIVER_COLUMNS = `d.user_id, d.vehicle_type, d.approval_status, d.gender, d.cnic, d.licence_number,
  to_char(d.licence_expiry, 'YYYY-MM-DD') AS licence_expiry, d.vehicle_make, d.vehicle_model, d.vehicle_year,
  d.vehicle_colour, d.vehicle_plate, d.submitted_at, d.reviewed_at, d.review_note, d.created_at`;

const EDITABLE = EDITABLE_DRIVER_STATUSES as readonly string[];

const isUniqueViolation = (err: unknown, constraint: string) =>
  (err as { code?: string; constraint?: string }).code === '23505' &&
  (err as { constraint?: string }).constraint === constraint;

/** The driver's side of onboarding: fill in details, upload photos, submit for review. */
@Injectable()
export class OnboardingService {
  private readonly logger = new Logger('Onboarding');

  constructor(
    @Inject(PG_POOL) private readonly pool: pg.Pool,
    private readonly storage: FileStorage,
  ) {}

  async get(driverId: string): Promise<DriverOnboarding> {
    return this.toOnboarding(await this.load(driverId));
  }

  /** Creates the driver profile on first save. Only while the application is editable. */
  async saveDetails(driverId: string, d: DetailsInput): Promise<DriverOnboarding> {
    try {
      const { rowCount } = await this.pool.query(
        `INSERT INTO drivers AS dr (user_id, vehicle_type, gender, cnic, licence_number, licence_expiry,
           vehicle_make, vehicle_model, vehicle_year, vehicle_colour, vehicle_plate)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (user_id) DO UPDATE SET
           vehicle_type = EXCLUDED.vehicle_type, gender = EXCLUDED.gender, cnic = EXCLUDED.cnic,
           licence_number = EXCLUDED.licence_number, licence_expiry = EXCLUDED.licence_expiry,
           vehicle_make = EXCLUDED.vehicle_make, vehicle_model = EXCLUDED.vehicle_model,
           vehicle_year = EXCLUDED.vehicle_year, vehicle_colour = EXCLUDED.vehicle_colour,
           vehicle_plate = EXCLUDED.vehicle_plate, updated_at = now()
         WHERE dr.approval_status = ANY($12)`,
        [
          driverId,
          d.vehicle.type,
          d.gender,
          d.cnic,
          d.licenceNumber,
          d.licenceExpiry,
          d.vehicle.make,
          d.vehicle.model,
          d.vehicle.year,
          d.vehicle.colour,
          d.vehicle.plate,
          EDITABLE,
        ],
      );
      if (rowCount === 0) throw locked();
    } catch (err) {
      if (isUniqueViolation(err, 'drivers_cnic_unique')) {
        throw new AppException(HttpStatus.CONFLICT, 'cnic_taken', 'Another driver account already uses this CNIC');
      }
      throw err;
    }
    return this.get(driverId);
  }

  /** Stores (or replaces) one document photo. */
  async uploadDocument(driverId: string, type: DriverDocumentType, data: Buffer | undefined): Promise<DriverOnboarding> {
    if (!data || data.length === 0) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'invalid_image', 'Attach a photo in the "file" field');
    }
    if (data.length > MAX_DOCUMENT_BYTES) {
      throw new AppException(HttpStatus.PAYLOAD_TOO_LARGE, 'file_too_large', 'Photo is too large');
    }
    const contentType = detectImageType(data);
    if (!contentType) throw new AppException(HttpStatus.BAD_REQUEST, 'invalid_image', 'Only JPEG or PNG photos');

    const app = await this.load(driverId);
    if (!app.details) throw detailsRequired();
    if (!canEditDriverApplication(app.row.approval_status)) throw locked();

    // A new key per upload: a retry or a slow earlier upload can never overwrite the newer file.
    const key = `drivers/${driverId}/${type}-${randomBytes(8).toString('hex')}.${IMAGE_EXTENSIONS[contentType]}`;
    await this.storage.put(key, data);

    let previousKey: string | null = null;
    try {
      const { rows } = await this.pool.query<{ previous_key: string | null }>(
        `WITH previous AS (SELECT storage_key FROM driver_documents WHERE driver_id = $1 AND type = $2)
         INSERT INTO driver_documents AS dd (driver_id, type, storage_key, content_type, size_bytes)
         SELECT $1, $2, $3, $4, $5 FROM drivers WHERE user_id = $1 AND approval_status = ANY($6)
         ON CONFLICT (driver_id, type) DO UPDATE SET
           storage_key = EXCLUDED.storage_key, content_type = EXCLUDED.content_type,
           size_bytes = EXCLUDED.size_bytes, uploaded_at = now()
         RETURNING (SELECT storage_key FROM previous) AS previous_key`,
        [driverId, type, key, contentType, data.length, EDITABLE],
      );
      // Submitted in the meantime (another request): keep what was submitted.
      if (rows.length === 0) throw locked();
      previousKey = rows[0]!.previous_key;
    } catch (err) {
      await this.storage.delete(key).catch(() => undefined);
      throw err;
    }
    if (previousKey) {
      await this.storage
        .delete(previousKey)
        .catch((err: Error) => this.logger.warn(`could not delete old document: ${err.message}`));
    }
    return this.get(driverId);
  }

  /** Sends the application for review. Repeating it while pending is fine (lost response on weak internet). */
  async submit(driverId: string): Promise<DriverOnboarding> {
    const app = await this.load(driverId);
    const status = app.row.approval_status;
    if (status === 'pending') return this.toOnboarding(app);
    if (!app.details) throw detailsRequired();
    if (!canEditDriverApplication(status)) throw locked();
    if (app.missingDocuments.length > 0) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'documents_missing',
        `Missing documents: ${app.missingDocuments.join(', ')}`,
      );
    }
    await this.pool.query(
      `UPDATE drivers SET approval_status = 'pending', submitted_at = now(), review_note = NULL, updated_at = now()
       WHERE user_id = $1 AND approval_status = ANY($2)`,
      [driverId, EDITABLE],
    );
    return this.get(driverId);
  }

  /** The driver's row and documents. A driver who hasn't saved details yet gets an empty "incomplete" one. */
  async load(driverId: string): Promise<Application> {
    const [driver, docs] = await Promise.all([
      this.pool.query<DriverRow>(`SELECT ${DRIVER_COLUMNS} FROM drivers d WHERE d.user_id = $1`, [driverId]),
      this.pool.query<{ type: DriverDocumentType; uploaded_at: Date; size_bytes: number }>(
        'SELECT type, uploaded_at, size_bytes FROM driver_documents WHERE driver_id = $1 ORDER BY type',
        [driverId],
      ),
    ]);
    const row = driver.rows[0] ?? emptyRow(driverId);
    const documents = docs.rows.map((r) => ({
      type: r.type,
      uploadedAt: r.uploaded_at.toISOString(),
      sizeBytes: r.size_bytes,
    }));
    const have = new Set(documents.map((d) => d.type));
    return {
      row,
      details: toDetails(row),
      documents,
      missingDocuments: REQUIRED_DRIVER_DOCUMENTS.filter((t) => !have.has(t)),
    };
  }

  /** Whether this driver exists (has saved details at least once). */
  async exists(driverId: string): Promise<boolean> {
    const { rowCount } = await this.pool.query('SELECT 1 FROM drivers WHERE user_id = $1', [driverId]);
    return rowCount === 1;
  }

  async readDocument(
    driverId: string,
    type: DriverDocumentType,
  ): Promise<{ data: Buffer; contentType: string } | null> {
    const { rows } = await this.pool.query<{ storage_key: string; content_type: string }>(
      'SELECT storage_key, content_type FROM driver_documents WHERE driver_id = $1 AND type = $2',
      [driverId, type],
    );
    if (!rows[0]) return null;
    const data = await this.storage.get(rows[0].storage_key);
    return data ? { data, contentType: rows[0].content_type } : null;
  }

  private toOnboarding(app: Application): DriverOnboarding {
    const { row } = app;
    return {
      status: row.approval_status,
      details: app.details,
      documents: app.documents,
      missingDocuments: app.missingDocuments,
      readyToSubmit: !!app.details && app.missingDocuments.length === 0,
      canEdit: canEditDriverApplication(row.approval_status),
      reviewNote: row.review_note,
      submittedAt: row.submitted_at?.toISOString() ?? null,
    };
  }
}

const locked = () =>
  new AppException(HttpStatus.CONFLICT, 'application_locked', 'Your application is under review or approved');
const detailsRequired = () =>
  new AppException(HttpStatus.CONFLICT, 'details_required', 'Fill in your details first');

function emptyRow(userId: string): DriverRow {
  return {
    user_id: userId,
    vehicle_type: 'car',
    approval_status: 'incomplete',
    gender: null,
    cnic: null,
    licence_number: null,
    licence_expiry: null,
    vehicle_make: null,
    vehicle_model: null,
    vehicle_year: null,
    vehicle_colour: null,
    vehicle_plate: null,
    submitted_at: null,
    reviewed_at: null,
    review_note: null,
    created_at: new Date(),
  };
}

/** null until the driver has saved the details form (drivers created before onboarding have none). */
export function toDetails(row: DriverRow): DriverDetails | null {
  if (
    !row.gender ||
    !row.cnic ||
    !row.licence_number ||
    !row.licence_expiry ||
    !row.vehicle_make ||
    !row.vehicle_model ||
    row.vehicle_year === null ||
    !row.vehicle_colour ||
    !row.vehicle_plate
  ) {
    return null;
  }
  return {
    gender: row.gender,
    cnic: row.cnic,
    licenceNumber: row.licence_number,
    licenceExpiry: row.licence_expiry,
    vehicle: {
      type: row.vehicle_type,
      make: row.vehicle_make,
      model: row.vehicle_model,
      year: row.vehicle_year,
      colour: row.vehicle_colour,
      plate: row.vehicle_plate,
    },
  };
}
