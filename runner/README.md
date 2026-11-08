# Signal Apply runner — Milestone 4

This is a local safety rehearsal, not a real application bot.

- It claims one already-approved Workday request through a service-role-only database RPC.
- It opens only `fixtures/workday-rehearsal.html`.
- It fills reviewed contact fields, leaves sensitive fields untouched, never uploads, never clicks Next, and never clicks Submit.
- It writes runner events to `application_run_events` and ends in `Needs your review`.

## Local rehearsal

1. Apply the latest `supabase/schema.sql` in the Supabase SQL editor.
2. Copy `.env.example` to `.env` inside this folder and add the project URL plus Supabase **Secret key** (`sb_secret_...`). Never put this key in the frontend or commit it.
3. From `runner/`, install dependencies and Chromium:

   ```bash
   npm install
   npx playwright install chromium
   ```

4. Run the isolated form rehearsal:

   ```bash
   npm run rehearse
   ```

5. Once a Signal request is approved for preparation, run one safe worker pass:

   ```bash
   npm run work-once
   ```

`RUNNER_REHEARSAL_ONLY=true` is mandatory. A real employer URL is deliberately not used in this milestone.
