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
  return { ok: true, runnerId: config.runnerId, rehearsalOnly: true };
}

export async function workOnce(config = runnerConfig()) {
  const client = clientFor(config);
  const request = await claimOne(client, config.runnerId);
  if (!request) return { ok: true, claimed: false, reason: 'No approved Workday rehearsal request is waiting.' };

  try {
    await audit(client, request, 'runner_claimed', { runnerId: config.runnerId, rehearsalOnly: true });
    await ensureActive(client, request);
    const rehearsal = await prepareFictionalWorkday(request.profile_snapshot, config);
    await ensureActive(client, request);
    await audit(client, request, 'rehearsal_prepared', rehearsal);
    await updateRequest(client, request, { status: 'needs_you', runner_id: config.runnerId, screenshot_count: 0, ai_step_count: 0, estimated_cost_cents: 0 });
    return { ok: true, claimed: true, requestId: request.id, rehearsal };
  } catch (error) {
    const detail = { message: error instanceof Error ? error.message : 'Unknown runner error', rehearsalOnly: true };
    await audit(client, request, 'rehearsal_stopped', detail);
    await updateRequest(client, request, { status: detail.message.includes('cancelled') ? 'cancelled' : 'failed', runner_id: config.runnerId });
    throw error;
  }
}

const command = process.argv[2];
if (command) {
  const run = command === 'health' ? healthcheck : command === 'work-once' ? workOnce : command === 'rehearse' ? async () => prepareFictionalWorkday({ contact: { fullName: 'Test Candidate', email: 'test@example.com', phone: '+91 90000 00000', location: 'Bengaluru' }, links: { linkedin: 'https://linkedin.com/in/test' } }, runnerConfig(process.env, { needsSupabase: false })) : null;
  if (!run) throw new Error('Use: health, rehearse, or work-once.');
  run().then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error); process.exitCode = 1; });
}
