import { z } from 'zod';
import { vehicleTypeSchema } from './fares';

// ---------------------------------------------------------------------------
// Driver onboarding: personal + vehicle details, document photos, admin review.
//
//   incomplete ──submit──► pending ──admin approves──► approved ──admin suspends──► suspended
//       ▲                    │                                                       │
//       │                    └──admin rejects──► rejected ──fix + submit──► pending   └─approve─► approved
//   (details and documents can only be edited while incomplete or rejected)
// ---------------------------------------------------------------------------

export const driverApprovalStatusSchema = z.enum(['incomplete', 'pending', 'approved', 'rejected', 'suspended']);
export type DriverApprovalStatus = z.infer<typeof driverApprovalStatusSchema>;

/** Statuses in which the driver may change their details and documents. */
export const EDITABLE_DRIVER_STATUSES = ['incomplete', 'rejected'] as const satisfies readonly DriverApprovalStatus[];
export const canEditDriverApplication = (status: DriverApprovalStatus) =>
  (EDITABLE_DRIVER_STATUSES as readonly DriverApprovalStatus[]).includes(status);

/** As printed on the CNIC. "other" covers the NADRA "X" card. */
export const genderSchema = z.enum(['male', 'female', 'other']);
export type Gender = z.infer<typeof genderSchema>;

// --- CNIC -------------------------------------------------------------------

/** "35202-1234567-1", "3520212345671" or with spaces → "3520212345671". null if it can't be a CNIC. */
export function normalizeCnic(input: string): string | null {
  const digits = input.replace(/[\s-]/g, '');
  return /^[1-9]\d{12}$/.test(digits) ? digits : null;
}

/** "3520212345671" → "35202-1234567-1" (how it is printed on the card). */
export function formatCnic(digits: string): string {
  return digits.length === 13 ? `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}` : digits;
}

/**
 * NADRA convention: the last CNIC digit is odd for men and even for women.
 * Only a hint for the reviewer (a mismatch means "look closely"), never a hard rule.
 */
export function cnicGender(digits: string): 'male' | 'female' | null {
  const last = Number(digits.at(-1));
  if (digits.length !== 13 || Number.isNaN(last)) return null;
  return last % 2 === 1 ? 'male' : 'female';
}

export const cnicSchema = z.string().transform((value, ctx) => {
  const cnic = normalizeCnic(value);
  if (!cnic) {
    ctx.addIssue({ code: 'custom', message: 'invalid_cnic' });
    return z.NEVER;
  }
  return cnic;
});

// --- Dates ------------------------------------------------------------------

/** Today's date in Pakistan (UTC+5, no DST) as YYYY-MM-DD. */
export function todayInPakistan(now = new Date()): string {
  return new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Accepts "2027-03-31" or the way people write dates in Pakistan: "31-03-2027", "31/03/2027", "31.03.2027".
 * Returns YYYY-MM-DD, or null if it isn't a real date.
 */
export function parseDate(input: string): string | null {
  const s = input.trim();
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
    if (!match) return null;
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

/** "2027-03-31" → "31-03-2027" (for showing and editing in the app). */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}-${m}-${y}` : iso;
}

// --- Licence and vehicle ----------------------------------------------------

/** Licence numbers differ per province, so only the characters and length are checked. */
export const licenceNumberSchema = z
  .string()
  .transform((v) => v.replace(/\s+/g, '').toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9][A-Z0-9/-]{3,24}$/, 'invalid_licence'));

export const licenceExpirySchema = z.string().transform((value, ctx) => {
  const date = parseDate(value);
  if (!date) {
    ctx.addIssue({ code: 'custom', message: 'invalid_date' });
    return z.NEVER;
  }
  if (date < todayInPakistan()) {
    ctx.addIssue({ code: 'custom', message: 'licence_expired' });
    return z.NEVER;
  }
  return date;
});

/** "lea 1234", "LEA-12-1234", "ict ab 123" → "LEA-1234", "LEA-12-1234", "ICT-AB-123". */
export function normalizePlate(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[\s_.-]+/g, '-');
}

export const plateSchema = z
  .string()
  .transform(normalizePlate)
  .pipe(
    z
      .string()
      .regex(/^[A-Z0-9]+(-[A-Z0-9]+){0,3}$/, 'invalid_plate')
      .min(4, 'invalid_plate')
      .max(15, 'invalid_plate')
      .refine((p) => /[A-Z]/.test(p) && /\d/.test(p), 'invalid_plate'),
  );

const text = (min: number, max: number) => z.string().trim().min(min, 'required').max(max, 'too_long');

export const vehicleYearSchema = z.coerce
  .number({ message: 'invalid_year' })
  .int('invalid_year')
  .min(1980, 'invalid_year')
  .refine((y) => y <= new Date().getFullYear() + 1, 'invalid_year');

export const vehicleDetailsBodySchema = z.object({
  type: vehicleTypeSchema,
  make: text(2, 30),
  model: text(1, 30),
  year: vehicleYearSchema,
  colour: text(2, 20),
  plate: plateSchema,
});

/** PUT /driver/onboarding/details. The name comes from the user profile (PATCH /me). */
export const driverDetailsBodySchema = z.object({
  gender: genderSchema,
  cnic: cnicSchema,
  licenceNumber: licenceNumberSchema,
  licenceExpiry: licenceExpirySchema,
  vehicle: vehicleDetailsBodySchema,
});
export type DriverDetailsBody = z.input<typeof driverDetailsBodySchema>;

/** Details as stored and returned by the API (already normalised: CNIC = 13 digits, dates = YYYY-MM-DD). */
export const driverDetailsSchema = z.object({
  gender: genderSchema,
  cnic: z.string(),
  licenceNumber: z.string(),
  licenceExpiry: z.string(),
  vehicle: z.object({
    type: vehicleTypeSchema,
    make: z.string(),
    model: z.string(),
    year: z.number().int(),
    colour: z.string(),
    plate: z.string(),
  }),
});
export type DriverDetails = z.infer<typeof driverDetailsSchema>;

// --- Documents --------------------------------------------------------------

export const driverDocumentTypeSchema = z.enum([
  /** Clear face photo; passengers will see it on the ride screen later. */
  'selfie',
  'cnic_front',
  'cnic_back',
  'licence',
  /** Registration book / smart card. */
  'vehicle_registration',
  /** Whole vehicle from the front, number plate readable. */
  'vehicle_photo',
  /** Police character certificate. Optional for now: it takes weeks to get one. */
  'police_certificate',
]);
export type DriverDocumentType = z.infer<typeof driverDocumentTypeSchema>;

export const DRIVER_DOCUMENT_TYPES = driverDocumentTypeSchema.options;
export const REQUIRED_DRIVER_DOCUMENTS = DRIVER_DOCUMENT_TYPES.filter(
  (t) => t !== 'police_certificate',
) as readonly DriverDocumentType[];

/** Uploads are JPEG or PNG photos. The driver app shrinks them to ~200 KB before sending. */
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

export const driverDocumentSchema = z.object({
  type: driverDocumentTypeSchema,
  uploadedAt: z.string(),
  sizeBytes: z.number().int(),
});
export type DriverDocument = z.infer<typeof driverDocumentSchema>;

// --- The driver's own application -------------------------------------------

/** GET /driver/onboarding: everything the onboarding screens need. */
export const driverOnboardingSchema = z.object({
  status: driverApprovalStatusSchema,
  details: driverDetailsSchema.nullable(),
  documents: z.array(driverDocumentSchema),
  /** Required documents not uploaded yet. */
  missingDocuments: z.array(driverDocumentTypeSchema),
  /** True when details are saved and every required document is uploaded. */
  readyToSubmit: z.boolean(),
  canEdit: z.boolean(),
  /** Why the application was rejected or the account suspended (shown to the driver). */
  reviewNote: z.string().nullable(),
  submittedAt: z.string().nullable(),
});
export type DriverOnboarding = z.infer<typeof driverOnboardingSchema>;

/** Error codes for onboarding the apps translate. Validation codes come from the schemas above. */
export const onboardingErrorCodeSchema = z.enum([
  'invalid_cnic',
  'invalid_licence',
  'invalid_date',
  'licence_expired',
  'invalid_plate',
  'invalid_year',
  'required',
  'too_long',
  'cnic_taken',
  'details_required',
  'documents_missing',
  'application_locked',
  'invalid_image',
  'file_too_large',
]);
export type OnboardingErrorCode = z.infer<typeof onboardingErrorCodeSchema>;

/** Sent to the driver app when an admin approves, rejects or suspends them. */
export const driverReviewedEventSchema = z.object({ status: driverApprovalStatusSchema });
