import { expect, test } from '@playwright/test';

// The main journey: sign up → set up → add a payment by typing → see the dashboard
// change → ask the assistant about it.
test('a new user signs up, adds a payment in words and asks about it', async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Save more. Worry less.');
  await page.getByRole('link', { name: 'Get started' }).click();

  // Sign up
  await page.getByLabel('Name').fill('Asha Rao');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.getByRole('button', { name: 'Create account' }).click();

  // Onboarding: month, one UPI wallet with ₹5,000, AI on
  await expect(page.getByRole('heading', { name: 'Your month' })).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('radio', { name: 'UPI' }).click();
  await page.getByLabel('Name').fill('GPay');
  await page.getByLabel('Money in it now').fill('5000');
  await page.getByRole('button', { name: 'Add wallet' }).click();
  await expect(page.getByRole('region', { name: 'Wallets added' })).toContainText('GPay');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Finish' }).click();

  // Dashboard: add a payment by typing it
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.getByLabel('Describe a payment').fill('spent 250 on biryani today from GPay');
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Add a transaction' });
  await expect(dialog.getByLabel('Amount')).toHaveValue('250');
  await expect(dialog.getByLabel('Category')).toHaveText(/Food & Dining/);
  await dialog.getByRole('button', { name: 'Add transaction' }).click();
  await expect(page.getByText('Transaction added').first()).toBeVisible();

  // The dashboard updates
  await expect(page.getByText('Money out this month').locator('..').locator('..')).toContainText(
    '₹250',
  );

  // Ask the assistant
  await page.getByRole('link', { name: 'Assistant' }).first().click();
  await page.getByRole('button', { name: 'Where did most of my money go this month?' }).click();
  await expect(page.getByRole('region', { name: 'Conversation' })).toContainText(
    'You spent ₹250 this month. Most of it went on Food & Dining.',
  );
});

test('the demo opens straight into a full dashboard', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the demo' }).first().click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('region', { name: 'Tips for you' })).toContainText(
    /Charged twice|Unusual/,
  );
});
