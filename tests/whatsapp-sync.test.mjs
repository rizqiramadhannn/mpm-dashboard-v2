import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeMessage, oldestKeptWibDate, todayWib, validWibDate } from "../app/whatsapp/service.ts";
import { summarizeDailyMessages } from "../app/whatsapp/summary.ts";

test("WIB dates use UTC+7 and reject invalid calendar dates", () => {
  assert.equal(todayWib(new Date("2026-09-24T18:00:00Z")), "2026-09-25");
  assert.equal(oldestKeptWibDate(new Date("2026-09-24T18:00:00Z")), "2026-09-19");
  assert.equal(validWibDate("2026-02-30"), false);
  assert.equal(validWibDate("2026-09-25"), true);
});

test("OpenWA persisted group messages retain WhatsApp media identity", () => {
  const group = "120363000000000000@g.us";
  const item = normalizeMessage({
    id: "database-row-id",
    waMessageId: "true_120363000000000000@g.us_ABC",
    chatId: group,
    author: "628123456789@c.us",
    body: "Nota supplier",
    type: "document",
    mediaMimetype: "application/pdf",
    metadata: { filename: "nota.pdf" },
    timestamp: 1790298000,
  }, group);
  assert.equal(item?.sourceId, "true_120363000000000000@g.us_ABC");
  assert.equal(item?.mediaId, item?.sourceId);
  assert.equal(item?.mediaMime, "application/pdf");
  assert.equal(item?.mediaName, "nota.pdf");
  assert.equal(item?.hasTargetMedia, true);
  assert.equal(normalizeMessage({ id: "wrong", chatId: "other@g.us", timestamp: 1790298000 }, group), null);
  assert.equal(normalizeMessage({ id: "no-time", chatId: group, createdAt: "2026-09-25T00:00:00Z" }, group), null);
});

test("daily digest samples the whole WIB day and reports peak activity", () => {
  const times = ["2026-09-24T18:00:00Z", "2026-09-25T02:00:00Z", "2026-09-25T08:00:00Z", "2026-09-25T13:00:00Z"];
  const items = times.map((sentAt, index) => ({
    sentAt, senderId: index < 2 ? "a" : "b", senderName: index < 2 ? "A" : "B",
    body: "message " + index, mediaMime: index === 1 ? "application/pdf" : "",
    mediaStatus: index === 1 ? "saved" : "none",
  }));
  const summary = summarizeDailyMessages(items);
  assert.equal(summary.messages, 4);
  assert.equal(summary.pdfs, 1);
  assert.deepEqual(summary.periods.map((period) => period.messages), [1, 1, 1, 1]);
  assert.equal(summary.excerpts.at(-1).text, "message 3");
  assert.match(summary.overview, /4 pesan/);
});