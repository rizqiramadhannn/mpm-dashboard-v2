import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID, createHash } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createClient } from "@libsql/client";
import { buildDateExport } from "../app/whatsapp/export.ts";
import {
  dailyData, listAvailableGroups, mediaForExport, oldestKeptWibDate,
  pruneWhatsAppCache, saveMonitoredGroups, sessionStatus, startSession, syncWibDate, todayWib,
} from "../app/whatsapp/service.ts";

const selected = "120363111111111111@g.us";
const unrelated = "120363222222222222@g.us";

test("OpenWA simulator: QR, selected group sync, originals, and seven-day cleanup", async () => {
  const databaseFile = join(tmpdir(), "mpm-whatsapp-" + randomUUID() + ".db");
  const url = "file:" + databaseFile.replaceAll("\\", "/");
  process.env.TURSO_DATABASE_URL = url;
  process.env.TURSO_AUTH_TOKEN = "test";
  process.env.OPENWA_API_KEY = "test-key";
  const client = createClient({ url, authToken: "test" });
  const migration = await readFile(new URL("../drizzle/0041_whatsapp_sync.sql", import.meta.url), "utf8");
  for (const statement of migration.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) {
    await client.execute(statement);
  }

  const date = todayWib();
  const timestamp = Math.floor(Date.parse(date + "T09:00:00+07:00") / 1000);
  const pdf = Buffer.from("%PDF-1.4\nmock original\n%%EOF");
  let started = false;
  const server = createServer((request, response) => {
    assert.equal(request.headers["x-api-key"], "test-key");
    const parsed = new URL(request.url, "http://localhost");
    const path = decodeURIComponent(parsed.pathname);
    const send = (status, body) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(body));
    };
    if (path === "/api/sessions" && request.method === "POST") return send(201, { id: "session-1" });
    if (path === "/api/sessions/session-1" && request.method === "GET") {
      return send(200, { id: "session-1", status: "qr_ready", engineLoaded: started });
    }
    if (path === "/api/sessions/session-1/start" && request.method === "POST") {
      started = true;
      return send(200, { id: "session-1", status: "qr_ready", engineLoaded: true });
    }
    if (path === "/api/sessions/session-1/qr") return send(200, { qrCode: "data:image/png;base64,aGVsbG8=", status: "qr_ready" });
    if (path === "/api/sessions/session-1/groups") {
      return send(200, [{ id: selected, name: "MPM NOTA SUPPLIER" }, { id: unrelated, name: "Unrelated group" }]);
    }
    if (path === "/api/sessions/session-1/messages") {
      assert.equal(parsed.searchParams.get("chatId"), selected);
      if (parsed.searchParams.has("after")) return send(200, { messages: [], total: 2 });
      return send(200, { messages: [
        { id: "row-1", waMessageId: "wa-pdf-1", chatId: selected, author: "6281@c.us",
          body: "Nota supplier", type: "document", mediaMimetype: "application/pdf",
          metadata: { media: { filename: "nota.pdf", mimetype: "application/pdf" } }, timestamp },
        { id: "row-2", waMessageId: "wa-text-2", chatId: selected, author: "6282@c.us",
          body: "Sudah diterima", type: "text", timestamp },
      ], total: 2 });
    }
    if (path === "/api/sessions/session-1/messages/" + selected + "/wa-pdf-1/media") {
      response.writeHead(200, { "Content-Type": "application/pdf", "Content-Length": String(pdf.length) });
      return response.end(pdf);
    }
    return send(404, { message: "unexpected " + path });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.OPENWA_BASE_URL = "http://127.0.0.1:" + server.address().port;

  try {
    const initial = await startSession();
    assert.equal(initial.session.status, "qr_ready");
    assert.match(initial.qr, /^data:image\/png;base64,/);
    assert.equal((await sessionStatus()).session.id, "session-1");
    const groups = await listAvailableGroups();
    assert.equal(groups.length, 2);
    await saveMonitoredGroups([selected]);
    const synced = await syncWibDate(date);
    assert.equal(synced.length, 1);
    assert.equal(synced[0].messageCount, 2);
    assert.equal(synced[0].mediaCount, 1);
    const daily = await dailyData(date);
    assert.equal(daily.groups.length, 1);
    assert.equal(daily.groups[0].summary.messages, 2);
    assert.equal(daily.groups[0].summary.pdfs, 1);
    assert.equal(daily.groups[0].messages.length, 2);
    const originals = await mediaForExport(date);
    assert.equal(originals.length, 1);
    assert.deepEqual(Buffer.from(originals[0].mediaBase64, "base64"), pdf);
    assert.equal(originals[0].mediaSha256, createHash("sha256").update(pdf).digest("hex"));
    const exported = await buildDateExport(date);
    assert.equal(exported.manifest.date, date);
    assert.equal(exported.manifest.groups.length, 1);
    assert.equal(exported.manifest.attachments.length, 1);
    assert.equal(exported.manifest.attachments[0].sourceId, "wa-pdf-1");
    assert.equal(Buffer.from(exported.zip).readUInt32LE(0), 0x04034b50);
    assert.equal(Buffer.from(exported.zip).includes(pdf), true);
    assert.equal((await client.execute("SELECT COUNT(*) AS count FROM whatsapp_messages WHERE group_id = ?", [unrelated])).rows[0].count, 0);

    const stale = new Date(Date.parse(oldestKeptWibDate() + "T00:00:00+07:00") - 86400000 + 7 * 3600000).toISOString().slice(0, 10);
    await client.execute({
      sql: "INSERT INTO whatsapp_messages (id, group_id, source_id, sent_at, wib_date, synced_at) VALUES (?, ?, ?, ?, ?, ?)",
      args: ["stale", selected, "old", "2020-01-01T00:00:00Z", stale, new Date().toISOString()],
    });
    await pruneWhatsAppCache();
    assert.equal((await client.execute("SELECT COUNT(*) AS count FROM whatsapp_messages WHERE id = 'stale'")).rows[0].count, 0);
  } finally {
    server.close();
    client.close();
    await unlink(databaseFile).catch(() => {});
  }
});
