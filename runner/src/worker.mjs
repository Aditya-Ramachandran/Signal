import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { runnerConfig } from './config.mjs';
import { prepareFictionalWorkday } from './rehearsal.mjs';

function clientFor(config) {
  return createClient(config.supabaseUrl, config.secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function audit(client, request, eventType, detail) {
  const { error } = await client.from('application_run_events').insert({ request_id: request.id, user_id: request.user_id, event_type: eventType, detail });
  if (error) throw error;
}

async function updateRequest(client, request, values) {
  const { error } = await client.from('application_requests').update(values).eq('id', request.id).eq('runner_id', values.runner_id ?? request.runner_id);
  if (error) throw error;
}

async function heartbeat(client, config, state, detail = {}) {
  const { error } = await client.from('application_runner_health').upsert({
    runner_id: config.runnerId,
    state,
    detail,
    last_seen_at: new Date().toISOString(),
  }, { onConflict: 'runner_id' });
  if (error) throw error;
}

async function ensureActive(client, request) {
  const { data, error } = await client.from('application_requests').select('status').eq('id', request.id).single();
  if (error) throw error;
  if (data.status === 'cancelled') throw new Error('Request was cancelled by the applicant.');
  if (data.status !== 'running') throw new Error(`Request is no longer runnable (status: ${data.status}).`);
}

async function claimOne(client, runnerId) {
  const { data, error } = await client.rpc('claim_next_application_request', { p_runner_id: runnerId });
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function healthcheck(config = runnerConfig()) {
  const client = clientFor(config);
  const { error } = await client.from('application_requests').select('id').limit(1);
  if (error) throw error;
  await heartbeat(client, config, 'online', { rehearsalOnly: true });
  return { ok: true, runnerId: config.runnerId, rehearsalOnly: true };
}

export async function workOnce(config = runnerConfig()) {
  const client = clientFor(config);
  await heartbeat(client, config, 'online', { rehearsalOnly: true });
  const request = await claimOne(client, config.runnerId);
  if (!request) return { ok: true, claimed: false, reason: 'No approved Workday rehearsal request is waiting.' };

  try {
    await heartbeat(client, config, 'working', { rehearsalOnly: true, requestId: request.id });
    await audit(client, request, 'runner_claimed', { runnerId: config.runnerId, rehearsalOnly: true });
    await ensureActive(client, request);
    const rehearsal = await prepareFictionalWorkday(request.profile_snapshot, config);
    await ensureActive(client, request);
    await audit(client, request, 'rehearsal_prepared', rehearsal);
    await updateRequest(client, request, { status: 'needs_you', runner_id: config.runnerId, screenshot_count: 0, ai_step_count: 0, estimated_cost_cents: 0 });
    await heartbeat(client, config, 'online', { rehearsalOnly: true });
    return { ok: true, claimed: true, requestId: request.id, rehearsal };
  } catch (error) {
    const detail = { message: error instanceof Error ? error.message : 'Unknown runner error', rehearsalOnly: true };
    await audit(client, request, 'rehearsal_stopped', detail);
    await updateRequest(client, request, { status: detail.message.includes('cancelled') ? 'cancelled' : 'failed', runner_id: config.runnerId });
    await heartbeat(client, config, 'degraded', detail);
    throw error;
  }
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function runForever(config = runnerConfig()) {
  let stopping = false;
  const stop = () => { stopping = true; };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  const client = clientFor(config);
  await heartbeat(client, config, 'online', { rehearsalOnly: true, mode: 'continuous' });
  console.log(`Signal Apply runner ${config.runnerId} is online. Polling every ${config.pollIntervalSeconds}s.`);

  while (!stopping) {
    try {
      await workOnce(config);
    } catch (error) {
      console.error(error);
    }
    if (!stopping) await wait(config.pollIntervalSeconds * 1000);
  }

  await heartbeat(client, config, 'offline', { rehearsalOnly: true, reason: 'Runner stopped' });
  return { ok: true, stopped: true };
}

const command = process.argv[2];
if (command) {
  const run = command === 'health' ? healthcheck : command === 'work-once' ? workOnce : command === 'run' ? runForever : command === 'rehearse' ? async () => prepareFictionalWorkday({ contact: { fullName: 'Test Candidate', email: 'test@example.com', phone: '+91 90000 00000', location: 'Bengaluru' }, links: { linkedin: 'https://linkedin.com/in/test' } }, runnerConfig(process.env, { needsSupabase: false })) : null;
  if (!run) throw new Error('Use: health, rehearse, work-once, or run.');
  run().then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error); process.exitCode = 1; });
}
