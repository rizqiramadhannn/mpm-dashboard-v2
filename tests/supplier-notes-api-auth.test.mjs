import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { isSupplierNotesApiScope, validateSupplierNotesApiToken } from "../app/supplier-notes-api-auth.ts";

const token = "a".repeat(43);
const hash = createHash("sha256").update(token).digest("hex");
const expiry = "2026-09-30T00:00:00Z";
const now = Date.parse("2026-09-15T00:00:00Z");

test("automation scope only permits reviewed nota operations and file GET", () => {
  for (const [path, methods] of [
    ["/api/supplier-notes", ["GET", "POST"]],
    ["/api/supplier-notes/masters", ["GET", "POST"]],
    ["/api/supplier-notes/manual", ["POST"]],
    ["/api/supplier-notes/manual/id_123/correct", ["POST"]],
    ["/api/supplier-notes/manual/id_123/reopen", ["POST"]],
    ["/api/supplier-notes/manual/id_123/settle", ["POST"]],
    ["/api/supplier-notes/id_123/settle", ["POST"]],
    ["/supplier/nota-supplier/download/id_123", ["GET"]],
  ]) {
    for (const method of ["GET", "POST", "PATCH", "DELETE", "PUT", "OPTIONS"]) {
      assert.equal(isSupplierNotesApiScope(path, method), methods.includes(method));
    }
  }
  for (const path of ["/api/finance/sync", "/api/invoices", "/api/supplier-note-imports", "/api/supplier-notes/evil", "/dashboard", "/admin/users", "/supplier/nota-supplier/download/id/extra"]) {
    assert.equal(isSupplierNotesApiScope(path, "GET"), false);
    assert.equal(isSupplierNotesApiScope(path, "POST"), false);
  }
});

test("token must match a configured hash and unexpired credential", async () => {
  assert.equal(await validateSupplierNotesApiToken(`Bearer ${token}`, hash, expiry, now), true);
  assert.equal(await validateSupplierNotesApiToken(`bearer ${token}`, hash.toUpperCase(), expiry, now), true);
  for (const auth of [null, "", "Basic abc", `Bearer ${"b".repeat(43)}`, `Bearer ${token} extra`, "Bearer short"]) {
    assert.equal(await validateSupplierNotesApiToken(auth, hash, expiry, now), false);
  }
  for (const configured of [undefined, "", "invalid", "0".repeat(64)]) {
    assert.equal(await validateSupplierNotesApiToken(`Bearer ${token}`, configured, expiry, now), false);
  }
  for (const expiration of [undefined, "", "invalid", "2026-09-15T00:00:00Z", "2026-09-14T00:00:00Z"]) {
    assert.equal(await validateSupplierNotesApiToken(`Bearer ${token}`, hash, expiration, now), false);
  }
});
