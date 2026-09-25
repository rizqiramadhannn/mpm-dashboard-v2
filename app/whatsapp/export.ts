import { createBinaryZip } from "../components/binaryZip";
import { dailyData, mediaForExport } from "./service";

export async function buildDateExport(date: string) {
  const data = await dailyData(date);
  const allowed = new Set(data.groups.map((group) => group.id));
  const attachments: { messageId: string; groupId: string; sourceId: string; path: string; sha256: string; mimeType: string }[] = [];
  const files: { name: string; content: Uint8Array }[] = [];
  for (const message of await mediaForExport(date)) {
    if (!allowed.has(message.groupId)) continue;
    const extension = message.mediaMime === "application/pdf" ? ".pdf" : message.mediaMime === "image/png" ? ".png" : ".jpg";
    const name = message.mediaName && /\.[a-z0-9]{2,5}$/i.test(message.mediaName)
      ? message.mediaName.replace(/[^a-z0-9._-]/gi, "_").slice(0, 100) : "attachment" + extension;
    const path = "originals/" + message.groupId.replace(/[^a-z0-9._-]/gi, "_") + "/" + message.id + "-" + name;
    attachments.push({ messageId: message.id, groupId: message.groupId, sourceId: message.sourceId, path, sha256: message.mediaSha256, mimeType: message.mediaMime });
    files.push({ name: path, content: new Uint8Array(Buffer.from(message.mediaBase64, "base64")) });
  }
  const manifest = { source: "mpm-dashboard-openwa", ...data, attachments };
  files.unshift({ name: "manifest.json", content: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) });
  return { zip: createBinaryZip(files), manifest };
}
