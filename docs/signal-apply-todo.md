# Signal Apply — build TODO

Signal Apply is an approval-gated application assistant. It may prepare direct employer-hosted Workday applications, but it never submits without a fresh user approval. LinkedIn Easy Apply and Indeed Apply remain manual application-pack handoffs because those platforms prohibit third-party automated application submission.

## Milestone 1 — Private application foundation

- [x] Define user-scoped application profile data.
- [x] Define private resume metadata and Storage bucket policies.
- [x] Define immutable application-request snapshots and approval timestamps.
- [x] Define answer-memory and runner-event records.
- [x] Enable RLS for every new user-owned table and Storage object.
- [x] Run the schema in the Supabase SQL Editor and verify the tables/policies.

**Done when:** one signed-in user cannot read another user’s profile, resume metadata, application request, answer memory, or run events.

## Milestone 2 — Application profile backend

- [x] Add typed server/client data helpers for the new profile and request records.
- [x] Define resumable profile versions and selected-resume rules.
- [x] Add validation for URLs, profile snapshot shape, file metadata, and allowed request states.
- [ ] Add backend tests for RLS-safe request creation.

**Done when:** Signal can create a frozen, valid application packet without any browser automation.

## Milestone 3 — Mobile application queue

- [x] Add `Agent-ready`, `Manual application pack`, and `Unsupported` application states to jobs.
- [x] Build the phone approval screen from the mockup.
- [x] Let the user select a resume and approve preparation for exactly one job.
- [x] Show request states: waiting, running, needs you, ready to submit, submitted, failed, cancelled.

**Done when:** a phone can create and monitor a real application request through preparation approval. Future runner events render faithfully when Milestone 4 writes them.

## Milestone 4 — Runner contract and local rehearsal

- [x] Create a separate Node/Playwright runner service in the repository.
- [x] Add secure server-side authentication to claim one application request.
- [x] Add health checks, cancellation, idempotency, step limits, and audit events.
- [x] Build a local fictional Workday-style rehearsal form with no OpenAI calls.
- [ ] Apply the runner-claim migration in Supabase and complete one database-backed rehearsal.

**Done when:** the runner can safely prepare a fictional application, never submit, and report verifiable state back to Signal.

## Milestone 5 — Cloud runner deployment

- [x] Add a persistent Linux VM deployment package and encrypted-volume guidance.
- [x] Add a restart-safe Docker service.
- [x] Keep private environment secrets outside the repository.
- [x] Add non-sensitive runner liveness heartbeats.
- [ ] Add a secure manual-takeover path for login, OTP, and CAPTCHA (Milestone 6, when a real browser journey exists).

**Done when:** the runner can be online without the user’s desktop and Signal accurately reports its health. The final VM provisioning steps remain for its owner.

## Milestone 6 — Workday deterministic adapter

- [ ] Detect supported Workday forms and required fields.
- [ ] Fill reviewed profile fields and known select options through Playwright.
- [ ] Attach only the explicitly selected resume.
- [ ] Cache verified field mappings with a page fingerprint.
- [ ] Pause on sensitive, legal, unknown, or changed fields.

**Done when:** five supervised Workday applications can be prepared with no automatic submission.

## Milestone 7 — Final approval and verified submission

- [ ] Render the reviewed application summary, skipped fields, and evidence.
- [ ] Issue a short-lived final-submit approval.
- [ ] Permit one submit click only after that approval.
- [ ] Verify the confirmation page and sync the Signal job to Applied.

**Done when:** one real application is submitted only after the final phone confirmation and has an auditable result.

## Milestone 8 — AI fallback and cost controls

- [ ] Use deterministic Workday behavior first; call Luna only for recovery.
- [ ] Add strict per-job step, screenshot, and cost caps.
- [ ] Add an $8 monthly application-agent budget and a kill switch.
- [ ] Log model usage and compare actual spend across ten supervised applications.

**Done when:** a difficult form stops safely at its budget rather than retrying or overspending.

## Milestone 9 — LinkedIn and Indeed manual packs

- [ ] Build a mobile copy-ready application pack with the selected resume and approved answers.
- [ ] Open official LinkedIn Easy Apply or Indeed Apply links without automating them.
- [ ] Let the user mark the manual application as Applied after confirmation.

**Done when:** mobile manual applications are fast, structured, and accurately tracked without prohibited platform automation.
