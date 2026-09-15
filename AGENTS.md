# Development database

- Sync the development database schema and data from production with `npm run db:sync-dev` before migrations/schema changes, or when the task specifically requires current production data. Ordinary code changes do not require a sync.
- The sync replaces development data. Always create a development backup first and verify restored data. Never write to production during a sync.
- Database configuration: development uses `.env.development.local`; production uses `.env.production.local`. Keep credentials out of logs and Git.
- Starting `npm run dev` or `npm run vinext:dev` does not automatically sync the database. Do not repeat a verified sync unnecessarily during the same migration session.
- For schema changes, sync first, then apply new migrations to development and verify them before using the new schema.
