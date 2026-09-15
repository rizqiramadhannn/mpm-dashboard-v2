import assert from "node:assert/strict";
import test from "node:test";
import { apiRequest } from "../scripts/supplier-notes-api.mjs";

test("client adds Bearer, disables redirects and sends multipart without forcing a boundary", async t => {
  const token = "a".repeat(43);
  const form = new FormData();
  form.append("payload", "{}");
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls++;
    assert.equal(url.href, "https://example.com/api/supplier-notes");
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    assert.equal(options.headers["Content-Type"], undefined);
    assert.equal(options.redirect, "error");
    assert.equal(options.body, form);
    assert.ok(options.signal instanceof AbortSignal);
    return new Response("{}", { status: 201 });
  });
  await apiRequest("https://example.com", token, "/api/supplier-notes", { method: "POST", body: form });
  assert.equal(calls, 1);
});

test("client rejects insecure origins and missing secrets before any network access", async t => {
  t.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected network access"); });
  for (const base of ["http://example.com", "https://user:pass@example.com", "https://example.com/other", "https://example.com/?secret=yes"]) {
    await assert.rejects(apiRequest(base, "a".repeat(43), "/api/supplier-notes"));
  }
  await assert.rejects(apiRequest("https://example.com", undefined, "/api/supplier-notes"));
  for (const path of ["https://other.example/api/supplier-notes", "//other.example/api/supplier-notes", "https://user:pass@example.com/api/supplier-notes"]) {
    await assert.rejects(apiRequest("https://example.com", "a".repeat(43), path));
  }
});

test("client never retries uncertain failures or 409 responses", async t => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return new Response("private error body", { status: 409 }); });
  await assert.rejects(apiRequest("https://example.com", "a".repeat(43), "/api/supplier-notes", { method: "POST" }), /HTTP 409/);
  assert.equal(calls, 1);
  t.mock.method(globalThis, "fetch", async () => { calls++; throw new Error("timeout"); });
  await assert.rejects(apiRequest("https://example.com", "a".repeat(43), "/api/supplier-notes", { method: "POST" }), /timeout/);
  assert.equal(calls, 2);
});
