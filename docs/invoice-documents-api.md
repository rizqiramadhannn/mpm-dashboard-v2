# Invoice document automation

Independent expiring bearer token. Server stores `INVOICE_DOCUMENTS_API_TOKEN_SHA256` and `INVOICE_DOCUMENTS_API_TOKEN_EXPIRES_AT`; client uses `INVOICE_DOCUMENTS_API_TOKEN`. Never reuse browser cookies or supplier write tokens.

- GET `/api/invoice-documents/:id`: invoice identity and signed TTB metadata, no file bytes.
- PATCH same URL: multipart `invoiceNo`, `expectedTtbSha256` (empty for no attachment), and one `signedTtbFile`. Only TTB fields can change. Valid PDF/JPEG/PNG up to 15 MB; exact identity and compare-and-set guard; duplicate hash is idempotent. Changes create an invoice audit record without changing payments/status.
- GET `/api/invoice-documents/:id/download`: generated invoice PDF including its signed TTB.

- POST `/api/invoice-documents/:id/settle`: record a verified final customer receipt and one PDF/JPEG/PNG proof atomically (no bank transfer). Multipart `payload` JSON (`expectedInvoiceNo`, `expectedTotalAmount`, `expectedPaidAmount`, `receiptAmount`, `paymentDate`) and `paymentProofFile`. Receipt must equal the remaining balance; date must be valid and not future. Invoice eligibility, identity, balance and concurrent changes are guarded. Existing audit/payment-history helper records the receipt and settlement date; proof is deduplicated. A matching paid invoice/proof/date returns reused without a second payment event. A paid invoice with missing proof may receive its proof on the existing settlement date. Other payment corrections are outside this token scope.

Run `node scripts/invoice-documents-api.mjs inspect <id>`, `upload-ttb <id> <invoiceNo> <file> --confirmed`, or `download <id> <invoiceNo> <output.pdf>`. Explicit user upload request authorizes `--confirmed`. After ambiguous writes, inspect before retrying. Tokens must not appear in logs.
