# Signal Apply runner deployment

This guide puts Signal Apply's **rehearsal-only** worker on a private Linux VM. It means the worker can stay online without your laptop. It does not turn on real employer-site automation; that remains Milestone 6.

## What you need

- A small persistent Ubuntu 22.04+ VM. Oracle Cloud Always Free is a workable no-cost option if capacity is available; any VM with Docker works.
- SSH access to that VM. Use an SSH key, not a password.
- Your Supabase project URL and **secret** key (`sb_secret_...`). This key belongs only on the VM, never in GitHub Pages or this repository.
- The runner-claim migration and runner-health migration applied in Supabase.

## 1. Prepare the VM

Install Docker Engine plus the Compose plugin using Docker's official Ubuntu instructions. Then clone your private Signal repository:

```bash
git clone https://github.com/Aditya-Ramachandran/Signal.git
cd Signal/runner
```

Keep the VM private: permit SSH only, protect it with a security group/firewall, and do **not** open browser, VNC, or debugging ports.

## 2. Apply the database migrations

In Supabase SQL Editor, run these files once, in order:

1. `supabase/migrations/20261108_signal_apply_runner.sql`
2. `supabase/migrations/20261108_application_runner_health.sql`

The first lets the server-side worker safely claim an approved request. The second stores its liveness signal. Neither permits browser writes.

## 3. Add VM-only secrets

On the VM, create `runner/.env` from the tracked example:

```bash
cp .env.example .env
nano .env
chmod 600 .env
```

Set at least:

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=sb_secret_your_secret_key
SIGNAL_RUNNER_ID=signal-apply-vm-1
RUNNER_REHEARSAL_ONLY=true
RUNNER_POLL_INTERVAL_SECONDS=60
RUNNER_HEADLESS=true
```

Leave `RUNNER_REHEARSAL_ONLY=true`. It is a hard safety boundary: the worker will reject a configuration that tries to disable it.

## 4. Start and verify

Build and start the restricted service:

```bash
docker compose up -d --build
docker compose logs -f runner
```

You should see an `online` line and a 60-second polling interval. Confirm Docker will restart it after a reboot:

```bash
docker compose ps
sudo reboot
# SSH back in, then:
cd Signal/runner && docker compose ps
```

The service should show `Up`. To run a one-off health check inside the same secret-bearing environment:

```bash
docker compose exec runner npm run health
```

## Browser profile and takeover boundary

Compose stores Chromium's profile in the VM-only `signal-apply-browser` volume. It is not committed or exposed through a port. Use an encrypted VM volume when your provider offers the choice.

For now, the only safe takeover path is SSH administration:

```bash
ssh your-vm
cd Signal/runner
docker compose logs -f runner
docker compose stop
```

There is intentionally no public browser-control endpoint, VNC server, CAPTCHA bypass, or OTP collector. When Milestone 6 can genuinely encounter a login, OTP, or CAPTCHA, we will add an explicit paused-for-you state and a private, authenticated takeover channel—never an exposed browser port.

## Updating the runner

```bash
cd Signal
git pull --ff-only
cd runner
docker compose up -d --build
```

Check the logs after every update. If a worker reports `degraded`, stop it, inspect the logs, and fix the configuration before restarting it.

## What this milestone proves

- A private cloud process can claim approved rehearsal work without your desktop.
- Service credentials and browser state stay outside the frontend and Git history.
- The service restarts safely and reports liveness.

It does not prove live job-site automation or submission. Those require the Workday adapter, human review, and a final one-time approval in later milestones.
