# WhatsApp Sync setup

The MPM Dashboard menu is visible only to users whose role is superadmin. The daily digest gives message and media counts, a WIB activity breakdown, active senders, and text excerpts sampled across the whole day. It is a factual digest, not an AI interpretation of chat meaning. The page creates or starts one OpenWA session, displays its QR, lists groups, and lets a superadmin choose which group IDs to monitor. The dashboard never sends WhatsApp messages.

## Local Windows test

OpenWA is free and self-hosted. It runs as a separate long-lived process. A Git fork is unnecessary. The ignored work/openwa-runtime directory contains upstream OpenWA 0.23.6 and portable Node 22.19.0 for this PC.

The Windows npm install of better-sqlite3 13.0.3 incorrectly invokes node-gyp even though the package ships a Windows prebuilt binary. The working local setup is npm ci --ignore-scripts, followed by the two Baileys patch scripts and npm run build. The better-sqlite3 binary was executed successfully with an in-memory SQLite query. No C++ Build Tools or Docker are needed for this test setup.

Local configuration has been written to ignored OpenWA .env and dashboard .env.development.local with a generated API key. Keep these files private. OpenWA uses ENGINE_TYPE=baileys and port 2785. Both local processes were started hidden on this PC; they are not configured to start after a reboot.

1. Open http://127.0.0.1:3000/admin/whatsapp and sign in as superadmin.
2. The OpenWA session is already created and reached qr_ready. Scan its QR through WhatsApp on the phone: Linked Devices > Link a Device. The dashboard polls status and then loads groups.
3. Select only the groups to monitor and save. Choose a WIB date in the last seven days, sync it, review group coverage, and download the ZIP. The ZIP contains manifest.json and successfully saved image/PDF originals. Missing or oversized media remains visible in the manifest.
4. If the processes are no longer running, restart OpenWA with portable Node 22 from its directory using node dist/main.js, then run npm run dev in the dashboard directory. Keep both processes alive for a local daily test. To reconnect OpenWA after a later restart, set AUTO_START_SESSIONS=true in its .env after pairing.
OpenWA history starts with what its connected session has actually received or recovered. A new session may not contain all older group messages. A dashboard status of scanned means the available OpenWA pages were scanned, not that WhatsApp's entire history was proven complete.

## Scheduled sync and retention

The dashboard stores today plus the previous six WIB dates. Manual read/sync and the maintenance endpoint prune older message, media, and daily-sync rows. The Vercel cron configuration calls the maintenance endpoint at 00:10 WIB, syncing the completed previous day. Set CRON_SECRET in Vercel before production deployment. The endpoint also accepts WHATSAPP_CRON_TOKEN for a local scheduler; send it as a Bearer token. Group settings and the OpenWA session ID are durable.

The Vercel dashboard server must be able to reach OPENWA_BASE_URL. If OpenWA runs only on a Windows PC, localhost in Vercel does not reach that PC. Use manual local testing first. For production daily sync, OpenWA needs an always-on reachable host with persistent session storage and HTTPS or a private network. Keep its API key server-side. OpenWA retains its own data separately; the dashboard's seven-day cleanup does not delete OpenWA's database or media archive.

## Data and security

Only selected group IDs are imported. The API checks the current superadmin session for all browser operations and validates same-origin mutations. QR codes and OpenWA API keys are never stored in the dashboard database. ZIP exports require superadmin access and include message text and originals, so handle them as sensitive files. The dashboard does not classify invoices or post transactions; the collect-whatsapp-nota-supplier skill can read the ZIP for the exact supplier group and perform those checks.

## Local runtime verified on this PC

OpenWA built and started with the Baileys engine. Its authenticated sessions API returned HTTP 200, and a real unpaired session reached qr_ready. The dashboard adapter retrieved that QR without logging the image or API key. The dashboard login page returned HTTP 200 and its WhatsApp API denied an unauthenticated request with HTTP 401. Phone pairing, actual group messages, and media downloads remain unverified until a WhatsApp account is linked.
OpenWA currently persists message history from the linked account without a built-in age purge. The dashboard selects groups and enforces seven-day retention only in its own database. For strict source-side group isolation, use a dedicated WhatsApp account joined only to monitored groups or maintain a custom OpenWA change; a chat-scoped API key limits API reads but does not stop OpenWA from receiving other chats.

## Verification without a phone

Run node --import ./tests/manual-note-loader.mjs --test tests/whatsapp-sync.test.mjs tests/whatsapp-integration.test.mjs. The integration test uses a temporary local SQLite database and a simulated OpenWA HTTP server. It verifies QR response handling, selected-group filtering, dated message and PDF sync, original bytes in the ZIP, and expiry cleanup. This does not replace a live phone pairing and real group-history check.