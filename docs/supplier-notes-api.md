# Supplier-note automation API

Browser login is unchanged. Automation uses a separate Bearer credential, not a
browser cookie. Disabled by default; missing/invalid/expired configuration fails closed.

Configure on the deployed server:

- `SUPPLIER_NOTES_API_TOKEN_SHA256`: SHA-256 hex digest of a cryptographically random token.
- `SUPPLIER_NOTES_API_TOKEN_EXPIRES_AT`: explicit ISO-8601 UTC expiry.

Generate at least 32 random bytes encoded as base64url (43 characters); keep the
raw token only in a protected local secret/environment, never Git, chat, logs or
client-side NEXT_PUBLIC variables. Set `SUPPLIER_NOTES_API_TOKEN` in the local
automation process. Set `SUPPLIER_NOTES_API_BASE_URL` to the deployed HTTPS origin
(default: the Vercel production origin). Rotate by replacing the server hash and
client token. Revoke immediately by removing the server hash or expiring it.
This is a service credential: it can read all supplier notes and create notes,
including automatic supplier creation; issue only to the approved automation.

Allowed scope:

- GET/POST `/api/supplier-notes`
- GET `/api/supplier-notes/masters` (names, IDs, codes and terms only)
- POST `/api/supplier-notes/masters` with `{ "name": "Supplier name" }`
  for an explicitly authorized new supplier; normalized existing names are reused.
- POST `/api/supplier-notes/manual` with `noteDate`, `supplierId`,
  `purchasePurpose`, `customerId`, `idempotencyKey` and `items` containing
  `description`, `quantity`, `unitPrice` and optional `uom` (`Pcs` or `Set`).
  Optional `paidAmount` is an integer from 0 to the calculated total;
  `paymentDate` is an optional valid date for nonzero payments. The server
  calculates BELUM BAYAR/DP/LUNAS and remaining payment. Payment values are
  part of idempotency identity; omitted payments retain legacy unpaid hashes.
- GET `/supplier/nota-supplier/download/<id>` for file verification
- POST `/api/supplier-notes/manual/<id>/settle` for an explicitly authorized
  settlement of an existing manual note, with `expectedAmount` and
  `expectedPaidAmount` from the final review. It marks the total paid, preserves
  date/items/PDF, records audit atomically, reuses already-settled results and
  rejects changed amounts with 409. It cannot modify uploaded supplier invoices.

PATCH, DELETE, pending imports, Finance, admin and other pages/APIs are denied.
Bearer failures never fall back to a browser cookie. Do not grant public access.

```powershell
node scripts/supplier-notes-api.mjs masters
node scripts/supplier-notes-api.mjs list
# Only after the final reviewed payload and original file are approved:
node scripts/supplier-notes-api.mjs upload approved-payload.json original.pdf --confirmed
node scripts/supplier-notes-api.mjs create-supplier supplier.json --confirmed
node scripts/supplier-notes-api.mjs manual manual-payload.json --confirmed
```

Before upload, verify source SHA-256 against the approved review. The client
checks existing supplier+number and sends one multipart POST without retries.
It prints only the resulting ID with `uploaded-unverified`. Persist the ID,
GET-check all values/items, and download/hash-check the original before marking
verified. Timeout/error requires reconciliation; note+items are not atomic.
Redirects are refused so the token is never forwarded to external file hosts.

Manual notes calculate item totals on the server and generate the NM number/PDF
atomically with note, items and audit. The API actor uses a stable
`supplier-notes-api` idempotency namespace with a null audit user ID; no browser
user is created. Persist a unique key before the first POST and reuse the exact
payload/key only when reconciling an uncertain outcome. Changing the payload
with the same key returns 409. Bulk consists of sequential one-note requests;
the entire batch is not atomic. Verify GET values/items and generated PDF
contents before reporting success. Original-file hash comparison applies to
uploaded invoices, not generated manual PDFs.

Production activation requires deploying this code and setting both server
variables; local changes do not activate the Vercel endpoint. No new database
schema or authentication-secret reuse is required.
