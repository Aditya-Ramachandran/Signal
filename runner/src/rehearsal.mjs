import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const fixtureUrl = pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/workday-rehearsal.html')).href;

export async function prepareFictionalWorkday(profileSnapshot, { maxSteps, headless }) {
  let steps = 0;
  const takeStep = (name) => {
    steps += 1;
    if (steps > maxSteps) throw new Error(`Step limit reached before ${name}.`);
  };
  const browser = await chromium.launch({ headless });
  try {
    const page = await browser.newPage();
    takeStep('opening rehearsal form');
    await page.goto(fixtureUrl, { waitUntil: 'domcontentloaded' });

    const values = {
      fullName: profileSnapshot.contact?.fullName || '',
      email: profileSnapshot.contact?.email || '',
      phone: profileSnapshot.contact?.phone || '',
      location: profileSnapshot.contact?.location || '',
      linkedin: profileSnapshot.links?.linkedin || '',
    };
    const filled = [];
    const skipped = [];
    for (const [field, value] of Object.entries(values)) {
      const input = page.locator(`[data-signal-field="${field}"]`);
      if (!value) { skipped.push({ field, reason: 'No reviewed value' }); continue; }
      takeStep(`filling ${field}`);
      await input.fill(value);
      const actual = await input.inputValue();
      if (actual !== value) throw new Error(`Verification failed for ${field}.`);
      filled.push(field);
    }

    takeStep('checking sensitive fields');
    const sensitiveCount = await page.locator('[data-signal-sensitive="true"]').count();
    if (sensitiveCount) skipped.push({ field: 'work authorization', reason: 'Sensitive—left for applicant review' });

    takeStep('checking submission boundary');
    const submit = page.locator('#submit-application');
    if (await submit.count() !== 1) throw new Error('Rehearsal form is missing its submission boundary.');
    if (await page.evaluate(() => document.body.dataset.submitted || '') !== '') throw new Error('The rehearsal form was submitted unexpectedly.');

    return { fixtureUrl, steps, filled, skipped, submitted: false };
  } finally {
    await browser.close();
  }
}
