import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";

export async function apiRequest(baseUrl, token, path, options = {}) {
  const base = new URL(baseUrl);
  if (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname))) {
    throw new Error("API requires HTTPS (HTTP is allowed only for localhost tests).");
  }
  if (base.username || base.password || base.search || base.hash || base.pathname !== "/") {
    throw new Error("Base URL must be an origin without credentials, path or query.");
  }
  if (!/^[A-Za-z0-9_-]{43,256}$/.test(token ?? "")) throw new Error("Configure SUPPLIER_NOTES_API_TOKEN securely in the client environment.");
  const destination = new URL(path, base);
  if (destination.origin !== base.origin || destination.username || destination.password) {
    throw new Error("API requests cannot forward the credential to another origin.");
  }
  const response = await fetch(destination, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
    redirect: "error", // Never forward the credential to a file-host redirect.
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`API returned HTTP ${response.status}. Reconcile before retrying any upload.`);
  return response;
}

async function main() {
  const [command, payloadPath, invoicePath, confirmation] = process.argv.slice(2);
  const base = process.env.SUPPLIER_NOTES_API_BASE_URL || "https://mpm-dashboard-v2.vercel.app";
  const token = process.env.SUPPLIER_NOTES_API_TOKEN;
  if (command === "manual" || command === "create-supplier") {
    if (!payloadPath || invoicePath !== "--confirmed") throw new Error("Usage: manual|create-supplier payload.json --confirmed (only for authorized input).");
    const payload = JSON.parse(await readFile(payloadPath, "utf8"));
    const path = command === "manual" ? "/api/supplier-notes/manual" : "/api/supplier-notes/masters";
    const response = await apiRequest(base, token, path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const { data } = await response.json();
    console.log(JSON.stringify({ status: "created-unverified", id: data.id, noteNo: data.noteNo, name: data.name, reused: data.reused }));
    return;
  }
  if (command === "masters") {
    const response = await apiRequest(base, token, "/api/supplier-notes/masters");
    console.log(JSON.stringify(await response.json(), null, 2));
    return;
  }
  if (command === "settle") {
    if (!payloadPath || invoicePath !== "--confirmed") {
      throw new Error("Usage: settle payload.json --confirmed (only after reconciliation).");
    }
    const payload = JSON.parse(await readFile(payloadPath, "utf8"));
    if (!payload.id || !Number.isSafeInteger(payload.expectedAmount) || !Number.isSafeInteger(payload.expectedPaidAmount) || !/^\d{4}-\d{2}-\d{2}$/.test(payload.paymentDate ?? "")) {
      throw new Error("Incomplete reviewed settlement payload.");
    }
    const path = `/api/supplier-notes/${encodeURIComponent(payload.id)}/settle`;
    const response = await apiRequest(base, token, path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const { data } = await response.json();
    console.log(JSON.stringify({ status: "settled-unverified", id: data.id, paidAmount: data.paidAmount, paymentDate: data.paymentDate, reused: data.reused }));
    return;
  }
  if (command === "list") {
    const response = await apiRequest(base, token, "/api/supplier-notes");
    const { data } = await response.json();
    console.log(JSON.stringify(data.map(n => ({ id: n.id, supplierName: n.supplierName, noteNo: n.noteNo, noteDate: n.noteDate, amount: n.amount, hasInvoice: n.hasInvoice })), null, 2));
    return;
  }
  if (command !== "upload" || !payloadPath || !invoicePath || confirmation !== "--confirmed") {
    throw new Error("Usage: node scripts/supplier-notes-api.mjs masters|list OR settle payload.json --confirmed OR upload payload.json invoice.pdf --confirmed.");
  }
  const payload = JSON.parse(await readFile(payloadPath, "utf8"));
  if (!payload.supplierName || !payload.noteNo || !payload.noteDate || !payload.items?.length) throw new Error("Incomplete reviewed payload.");
  const existing = await (await apiRequest(base, token, "/api/supplier-notes")).json();
  const normalize = value => String(value).toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^PT|^CV/, "");
  if (existing.data.some(n => normalize(n.supplierName) === normalize(payload.supplierName) && normalize(n.noteNo) === normalize(payload.noteNo))) {
    throw new Error("Supplier + note number already exists; no POST performed. Review revisions manually.");
  }
  const mime = /\.pdf$/i.test(invoicePath) ? "application/pdf" : /\.jpe?g$/i.test(invoicePath) ? "image/jpeg" : /\.png$/i.test(invoicePath) ? "image/png" : null;
  if (!mime) throw new Error("Supported invoice originals: PDF, JPEG, PNG.");
  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  form.append("invoiceFile", new Blob([await readFile(invoicePath)], { type: mime }), basename(invoicePath));
  // Exactly one attempt. Errors/timeouts can follow a partial write; never retry.
  const result = await (await apiRequest(base, token, "/api/supplier-notes", { method: "POST", body: form })).json();
  console.log(JSON.stringify({ status: "uploaded-unverified", id: result.data.id, noteNo: result.data.noteNo, itemCount: result.data.itemCount }));
  // Caller must persist this ID, GET-check values/items, and hash-check the
  // downloaded invoice before recording uploaded-verified.
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    // Do not print request headers, payloads, credentials, or response bodies.
    console.error("API operation failed. Check configuration/HTTP access; reconcile dashboard state before retrying an upload.");
    process.exitCode = 1;
  });
}
