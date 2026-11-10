import { expect, test } from '@playwright/test';

test('check-in → workout → log flow', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');

  // one-time disclaimer
  await expect(page.getByRole('dialog', { name: 'Before you start' })).toBeVisible();
  await page.getByRole('button', { name: 'I understand' }).click();

  // daily check-in
  await expect(page.getByRole('heading', { name: 'Daily check-in' })).toBeVisible();
  await page.getByRole('radio', { name: 'Gym' }).click();
  await page.getByRole('radio', { name: '45' }).click();
  await page.getByRole('radio', { name: 'Normal' }).click();
  await page.getByRole('button', { name: 'Build today’s session' }).click();

  // today's session card
  await expect(page.getByRole('button', { name: 'Start workout' })).toBeVisible();
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByRole('button', { name: /Start — timer begins now/ }).click();

  // log the first set of the first exercise
  const firstLoad = page.getByLabel('Set 1 load').first();
  if (await firstLoad.isVisible()) await firstLoad.fill('40');
  await page.getByLabel(/Set 1 (reps|seconds|minutes)/).first().fill('10');
  await page.getByLabel('Set 1 RPE').first().selectOption('8');
  await page.getByRole('button', { name: 'Set 1 done' }).first().click();
  await expect(page.getByRole('timer')).toBeVisible(); // rest timer started
  await page.getByRole('timer').getByRole('button', { name: 'Skip' }).click();

  // exercise pictures are present
  await expect(page.locator('img[alt$="start position"]').first()).toBeVisible();

  await page.getByRole('button', { name: 'Finish & save' }).click();
  await expect(page.getByRole('heading', { name: /Session saved \(partial\)|Session complete/ })).toBeVisible();
  await page.getByRole('button', { name: 'Back to Today' }).click();
  await expect(page.getByText(/Partly done|Done ✓/)).toBeVisible();

  // log food
  await page.getByRole('link', { name: 'Log' }).click();
  await page.getByRole('button', { name: '+ Add' }).first().click();
  await page.getByPlaceholder(/Search/).fill('chapati');
  await page.getByRole('button', { name: /Chapati \/ roti/ }).click();
  await page.getByRole('button', { name: /^Add \d+ kcal$/ }).click();
  await expect(page.getByText('Chapati / roti')).toBeVisible();

  // weight
  await page.getByRole('radio', { name: 'Weight & waist' }).click();
  await page.getByPlaceholder('kg').fill('99.6');
  await page.getByRole('button', { name: 'Save' }).first().click();
  await expect(page.getByText('99.6 kg')).toBeVisible();

  // calendar shows today
  await page.getByRole('link', { name: 'Plan' }).click();
  await expect(page.getByRole('button', { name: /: (Partial|Completed)$/ })).toBeVisible();

  // progress renders
  await page.getByRole('link', { name: 'Progress' }).click();
  await expect(page.getByRole('heading', { name: 'Adherence' })).toBeVisible();

  expect(errors).toEqual([]);
});

test('exercise card alternates images and pauses on tap', async ({ page }) => {
  await page.goto('./#/exercise/db-bench-press');
  await page.getByRole('button', { name: 'I understand' }).click();
  const btn = page.getByRole('button', { name: /Pause Dumbbell bench press animation/ });
  await expect(btn).toBeVisible();
  await btn.click();
  await expect(page.getByText('Paused · tap to play')).toBeVisible();
  await expect(page.getByText('How to do it')).toBeVisible();
});
