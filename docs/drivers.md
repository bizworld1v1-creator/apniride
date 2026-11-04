# Driver onboarding and approval

A driver can only go online after an admin has checked their details and documents.
(This replaced the old dev flag `DRIVER_AUTO_APPROVE`.)

## Status flow

```
incomplete ──submit──► pending ──approve──► approved ──suspend──► suspended
    ▲                     │                     ▲                     │
    │                     └──reject──► rejected │                     │
    │                                     │     └──────approve────────┘
    └─────────── (fix, then submit) ◄─────┘
```

| Status | Driver can edit | Can go online | Driver sees |
| --- | --- | --- | --- |
| `incomplete` | yes | no | "Start / continue registration" |
| `pending` | no | no | "Application under review" |
| `approved` | no | yes | the normal home screen |
| `rejected` | yes | no | the reason + "Fix and send again" |
| `suspended` | no | no | the reason + "contact support" (sent offline at once; a ride already under way can be finished) |

The admin's reason (`review_note`) is shown to the driver for `rejected` and `suspended`, and cleared when they
resubmit. When an admin acts, the driver app gets a `driver:reviewed` socket event and refreshes immediately.

## What the driver provides

**Details** (`PUT /driver/onboarding/details`; the name comes from the user profile):

| Field | Rule |
| --- | --- |
| Gender | `male`, `female`, `other` (NADRA "X" card). Needed for the female-driver option |
| CNIC | 13 digits, typed with or without dashes. **One driver account per CNIC** (`cnic_taken`) |
| Licence number | 4–25 letters/digits/`-`/`/` (formats differ per province) |
| Licence expiry | `DD-MM-YYYY` or `YYYY-MM-DD`, must not be in the past (Pakistan date, UTC+5) |
| Vehicle | type (bike / car), make, model, year (1980 to next year), colour, number plate (`lea 1234` → `LEA-1234`) |

**Photos** (`PUT /driver/onboarding/documents/:type`, multipart field `file`):

| Type | Required |
| --- | --- |
| `selfie` (passengers will see it later) | yes |
| `cnic_front`, `cnic_back` | yes |
| `licence` | yes |
| `vehicle_registration` (book or card) | yes |
| `vehicle_photo` (number plate readable) | yes |
| `police_certificate` | **no** for now: getting one takes weeks |

- The app shrinks each photo to at most 1280 px wide, JPEG 60 % (~150–300 KB), before uploading. Each photo
  uploads on its own and is retried on network errors, so a weak connection only repeats one photo.
- The server accepts only real JPEG / PNG files (checked by their first bytes, not the name), up to 5 MB.
- Uploading again replaces the photo. Photos need the details first (`details_required`).
- `POST /driver/onboarding/submit` → `pending`. Fails with `documents_missing` / `details_required`. Repeating it
  while pending is fine. After submitting, edits fail with `application_locked`.

## Storage and privacy

- Files go through `FileStorage` (`backend/src/storage/file-storage.ts`). Today that is local disk under
  `UPLOAD_DIR` (default `backend/uploads/`, gitignored). For several servers, add an S3-compatible
  implementation (e.g. Cloudflare R2) and swap it in `StorageModule`.
- Photos are **never served publicly**. Only the admin API returns them, with `Cache-Control: no-store`.
- Each upload gets a new random file name; the old file is deleted once the new one is saved.
- CNIC, licence and photos are personal data: don't log them, and delete downloaded review copies.

## Reviewing drivers

In the **admin panel** ([admin.md](admin.md)): Drivers → *Waiting for review* (oldest first) → open a driver,
compare the photos with the details, then Approve or Reject with a reason. Approved drivers can be suspended
(with a reason) and reinstated later. Every decision is in the audit log with the admin's name.

To approve yourself for phone testing: register in the driver app, send it for review, then approve yourself
in the panel.

**CNIC gender hint:** by NADRA convention the last CNIC digit is odd for men and even for women. A mismatch
isn't proof of anything, it just means "look at the card closely".

### Admin API (admin sign-in token)

| | |
| --- | --- |
| `GET /admin/drivers?status=pending` | List (max 200). Pending is oldest submission first |
| `GET /admin/drivers/:id` | Details, documents, missing documents, `cnicGenderMatches`, review note, history |
| `GET /admin/drivers/:id/documents/:type` | The photo |
| `POST /admin/drivers/:id/approve` | From `pending` or `suspended` |
| `POST /admin/drivers/:id/reject` `{ reason }` | From `pending` |
| `POST /admin/drivers/:id/suspend` `{ reason }` | From `approved` |

Repeating an action that already happened returns the driver unchanged; any other wrong starting status fails
with `invalid_driver_state`.

## Error codes the apps translate

`invalid_cnic`, `invalid_licence`, `invalid_date`, `licence_expired`, `invalid_plate`, `invalid_year`,
`required`, `too_long`, `cnic_taken`, `details_required`, `documents_missing`, `application_locked`,
`invalid_image`, `file_too_large`, `driver_not_approved`.

## Not done yet

- Changing vehicle after approval (needs a new review; for now, an admin would have to do it).
- NADRA / licence verification APIs, police certificate requirement, vehicle inspection, live selfie before
  each shift.
- Licence expiry is only checked at registration; nothing suspends a driver when it later expires.
- If Android closes the app while the camera is open (low memory on cheap phones), that photo is lost and the
  driver has to take it again (`ImagePicker.getPendingResultAsync` could recover it).
