import { expect, test } from '@playwright/test';

// Captures the README screenshots from a demo account (docs/screenshots at the repo root).
// Not part of the normal run (its own Playwright project). Make them with:
//   npm run screenshots

const shot = (page, name) =>
  page.screenshot({ path: `../docs/screenshots/${name}.png`, fullPage: false });

test('README screenshots', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.waitForTimeout(1500); // let the fade-in finish
  await shot(page, 'landing');

  await page.getByRole('button', { name: 'Try the demo' }).first().click();
  await expect(page.getByRole('figure', { name: 'Month-end forecast' })).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForTimeout(800);
  await shot(page, 'dashboard');

  await page.goto('/transactions');
  await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();
  await page.getByRole('button', { name: 'Add transaction' }).click();
  await page.getByRole('tab', { name: 'Paste SMS' }).click();
  await page
    .getByLabel('Paste bank SMS')
    .fill(
      'Rs.250.00 debited from HDFC Bank A/c XX1234 to VPA swiggy@axisbank on 24-09-26. UPI Ref 426712345678\n\nYour OTP is 482913. Do not share.',
    );
  await page.getByRole('button', { name: 'Read messages' }).click();
  await expect(page.getByRole('region', { name: 'Payments found' })).toBeVisible();
  await shot(page, 'sms');
  await page.keyboard.press('Escape');

  await page.goto('/insights');
  await expect(page.getByRole('region', { name: 'All insights' })).toBeVisible();
  await page.getByRole('button', { name: 'Why?' }).first().click();
  await page.waitForTimeout(500);
  await shot(page, 'insights');

  await page.goto('/recurring');
  await expect(page.getByRole('region', { name: 'Subscriptions found' })).toBeVisible();
  await shot(page, 'subscriptions');

  await page.goto('/assistant');
  await page.getByRole('button', { name: 'Where did most of my money go this month?' }).click();
  await expect(page.getByText(/You spent ₹/)).toBeVisible();
  await page.waitForTimeout(800);
  await shot(page, 'assistant');

  await page.goto('/goals');
  await expect(page.getByRole('region', { name: 'What if' })).toContainText('a month');
  await shot(page, 'goals');
});
