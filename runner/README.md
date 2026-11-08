# Signal Apply runner — Milestone 5

This is a persistent, rehearsal-only worker. It is designed to run on a private Linux VM so Signal does not require the applicant's desktop to be on.

- It claims one already-approved Workday request through a service-role-only database RPC.
- It opens only `fixtures/workday-rehearsal.html`.
- It fills reviewed contact fields, leaves sensitive fields untouched, never uploads, never clicks Next, and never clicks Submit.
- It writes runner events to `application_run_events` and ends in `Needs your review`.
- It writes a non-sensitive liveness heartbeat to `application_runner_health`.

It does **not** visit an employer site yet. Real Workday preparation begins only in Milestone 6.

## Local rehearsal

1. Apply the latest `supabase/schema.sql` in the Supabase SQL editor, including the runner-claim and runner-health migrations.
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

## Persistent VM

For an always-on deployment, use the `Dockerfile` and `compose.yaml` in this directory. The Compose service restarts after a VM reboot, keeps Chromium's profile in a VM-only volume, and keeps the Supabase secret key only in the VM's `.env` file.

Follow [the deployment guide](../docs/signal-apply-runner-deployment.md). Do not expose the browser profile, Chromium debugging port, VNC, or the runner's `.env` file to the public internet.
