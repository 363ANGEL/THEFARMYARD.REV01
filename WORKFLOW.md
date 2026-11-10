# Workflow: database access

`tools/db.mjs` runs SQL against the live Supabase database using `DATABASE_URL` from `.env.local` (git-ignored, never printed or committed).

```
node tools/db.mjs path/to/file.sql
node tools/db.mjs "select nickname, role from fy.member"
```

## Rules

- **Read-only queries** (`select`, catalog lookups): run freely.
- **Anything that writes or changes schema** (insert, update, delete, DDL, function changes): show the file name and a 3-line summary, wait for the OK, then run it and report the result.
- **Every change lives in a committed `.sql` file**, idempotent (safe to run twice). No one-off statements typed straight at the database.
- The connection string and password are never printed, logged or committed.
