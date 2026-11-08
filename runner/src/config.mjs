const required = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY'];

export function runnerConfig(env = process.env, { needsSupabase = true } = {}) {
  const missing = required.filter((name) => !env[name]?.trim());
  if (needsSupabase && missing.length) throw new Error(`Runner is missing ${missing.join(', ')}.`);
  if (env.RUNNER_REHEARSAL_ONLY !== 'true') throw new Error('Milestone 4 is rehearsal-only. Set RUNNER_REHEARSAL_ONLY=true.');

  const maxSteps = Number(env.RUNNER_MAX_STEPS || 24);
  if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 100) throw new Error('RUNNER_MAX_STEPS must be a whole number between 1 and 100.');

  return {
    supabaseUrl: env.SUPABASE_URL || '',
    secretKey: env.SUPABASE_SECRET_KEY || '',
    runnerId: env.SIGNAL_RUNNER_ID?.trim() || 'local-rehearsal',
    maxSteps,
    headless: env.RUNNER_HEADLESS !== 'false',
  };
}
