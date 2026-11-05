# Phone OTP sign-in

Passengers and drivers sign in with a Pakistani mobile number and a 6-digit SMS code. There are no passwords.
One number can be both a passenger and a driver. There is **one mobile app with two modes** (like inDrive):
it signs in to the mode used last on that phone (`role: "passenger"` by default, or `"driver"`), and the
"Driver mode" / "Passenger mode" button switches without a new code (see *Switching mode* below).

## Flow

```
App                                   API                                  Redis / Postgres
 │ POST /auth/otp/request {phone, role} │                                      │
 │─────────────────────────────────────▶│ cooldown + hourly caps, store hash ─▶│ Redis (5 min TTL)
 │◀── {expiresInSeconds, resendIn…}     │ send SMS                             │
 │ POST /auth/otp/verify {phone, role, code}                                   │
 │─────────────────────────────────────▶│ check hash, burn code               │
 │                                      │ upsert user + role, new session ───▶│ Postgres
 │◀── {accessToken, refreshToken, user, isNewUser}                             │
 │ PATCH /me {name}   (first sign-in only, until the user has a name)          │
 │ … API calls with Authorization: Bearer <accessToken> …                      │
 │ POST /auth/refresh {refreshToken}  → new pair (rotation)                    │
 │ POST /auth/logout  {refreshToken}  → session revoked                        │
```

| Endpoint | Auth | Notes |
| --- | --- | --- |
| `POST /auth/otp/request` | – | `{ phone, role }`. The phone can be typed any common way (`0300…`, `+92 300…`, `92300…`) and is normalised to E.164 (`+923001234567`). |
| `POST /auth/otp/verify` | – | `{ phone, role, code }` → session. Creates the account on first sign-in. |
| `POST /auth/refresh` | – | `{ refreshToken }` → new `{ accessToken, refreshToken }` |
| `POST /auth/switch-role` | Bearer | `{ role, refreshToken }` → a new session in the other mode. See below. |
| `POST /auth/logout` | – | `{ refreshToken }` → 204. Idempotent. |
| `GET /me`, `PATCH /me` | Bearer | Profile. `PATCH` takes `{ name }` (2–60 characters). |

Errors always look like `{ statusCode, code, message, retryAfterSeconds? }`. The apps translate `code`
(`invalid_phone`, `invalid_code`, `code_expired`, `too_many_attempts`, `resend_too_soon`, `rate_limited`,
`invalid_refresh_token`, `unauthorized`, …) into English or Urdu. 429 responses also set a `Retry-After` header.

Schemas and the typed client live in `packages/shared/src/auth.ts` and `api-client.ts`.

## Switching mode (`POST /auth/switch-role`)

Every session (and access token) still has exactly **one** role, so all passenger/driver route checks stay as they
were (`assertRole` → `wrong_app` 403). Switching swaps the phone's session:

1. Needs the access token **and** the session's refresh token (proves it is the device that owns the session).
2. Refused with **409 `go_offline_first`** if the driver is online, and **409 `active_ride_exists`** if the user has
   a ride that is searching / accepted / arrived / in progress (as passenger or driver). **400 `same_role`** if
   already in that mode; admins get **403 `wrong_app`**.
3. Adds the role to `user_roles` if new (`isNewUser: true` the first time someone opens driver mode), opens a new
   session for the new role and revokes the old one.
4. The app stores the new tokens, clears its query cache and reconnects the socket, which puts it in the new
   mode's room (`passenger:<id>` or `driver:<id>`).

The old access token keeps working until it expires (at most 1 hour), as after a logout.
The last used mode is kept on the phone (`apniride.mode` in SecureStore) even after signing out.

## Limits (`backend/src/auth/otp.service.ts`)

| Limit | Value | Why |
| --- | --- | --- |
| Code lifetime | 5 min | |
| Resend cooldown | 60 s per number | |
| Codes per number | 5 / hour | SMS costs money; stops SMS bombing |
| Codes per IP | 30 / hour | Generous, because many users share carrier NAT IPs |
| Wrong guesses | 5 per code, then the code is burned | 6 digits × 5 tries × 5 codes/hour ≈ 1 in 40,000 per hour |

## Security and privacy decisions

- **Codes are never stored in plain text.** Redis holds an HMAC of `phone + code`, keyed with `OTP_SECRET`.
  Redis keys use an HMAC of the phone number, so numbers can't be read from Redis either.
- **Phone numbers are never logged or sent back in full.** The API returns `phoneMasked` (`+92 3•• ••• 4567`)
  even to the number's owner. The dev SMS sender logs the masked number.
- **Access tokens**: JWT (HS256, `JWT_SECRET`), valid for 1 hour, with claims `sub` (user id), `role` and `sid` (session id).
  They are checked without a database lookup, so logging out takes up to 1 hour to reach access tokens.
- **Refresh tokens**: 32 random bytes, valid for 60 days. Only a SHA-256 hash is stored (`auth_sessions`). They
  **rotate** on every refresh. The previous token stays valid for **2 minutes** after rotation, so a refresh
  response lost on a weak connection doesn't sign the user out.
- **Apps** keep tokens in SecureStore (Android Keystore / iOS Keychain). The shared client refreshes on a 401
  by itself, with one refresh even when several requests fail at once. It signs the user out **only** when the
  server rejects the refresh token, never just because the phone is offline. On launch the apps open from the
  saved session without waiting for the network.
- **Dev mode**: `OTP_DEV_ECHO=true` returns the code in the API response and the app shows it, so no SMS is
  needed. Env validation refuses to start in production with `OTP_DEV_ECHO=true` or `SMS_PROVIDER=console`.

## Not done yet

- Real SMS gateway (implement `SmsSender` in `backend/src/auth/sms.sender.ts`, add it to `SMS_PROVIDER`).
  Consider WhatsApp OTP as a cheaper fallback, and an Android SMS Retriever hash in the message for one-tap autofill.
- `trust proxy` for correct client IPs behind a load balancer (the per-IP cap currently uses `req.ip`).
- Revoking all sessions for a user (e.g. "sign out of all devices", or blocking a driver).
