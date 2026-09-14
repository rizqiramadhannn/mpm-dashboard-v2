# Development database

- Before development work, sync the development database schema and data from production with `npm run db:sync-dev`. The user has authorized this recurring sync.
- The sync replaces development data. Always create a development backup first and verify restored data. Never write to production during a sync.
- Database configuration: development uses `.env.development.local`; production uses `.env.production.local`. Keep credentials out of logs and Git.
- `npm run dev` and `npm run vinext:dev` sync automatically before starting. If the database was already synced during the current development session, do not repeat the sync unnecessarily.
- For schema changes, sync first, then apply new migrations to development and verify them before using the new schema.
