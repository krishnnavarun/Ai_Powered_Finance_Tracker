import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { installFakeApi } from '@/test/fakeApi';
import { installFakePlanning } from '@/test/fakePlanning';
import { findToast, renderApp } from '@/test/utils';

const phone = {
  name: 'New phone',
  targetAmount: 6000000,
  savedAmount: 1500000,
  deadline: '2026-12-31',
  monthsLeft: 4,
};

function setUp(
  goals = [
    phone,
    { name: 'Emergency fund', targetAmount: 1000000, savedAmount: 1000000, status: 'done' },
  ],
) {
  installFakeApi({ wallets: [{ name: 'HDFC' }] });
  return installFakePlanning({ goals });
}

const card = (name) => screen.findByRole('article', { name });

describe('goals page', () => {
  it('shows progress and how much to save each month', async () => {
    setUp();
    renderApp('/goals');

    const goal = await card('New phone');
    expect(within(goal).getByRole('img', { name: '25% saved' })).toBeInTheDocument();
    expect(goal).toHaveTextContent('₹15,000 of ₹60,000');
    expect(goal).toHaveTextContent('Save ₹11,250 a month to reach it by December 2026');

    const done = await card('Emergency fund');
    expect(done).toHaveTextContent('Done');
    expect(done).toHaveTextContent('Goal reached — well done!');
    expect(within(done).queryByRole('button', { name: 'Add money' })).not.toBeInTheDocument();

    expect(screen.getByRole('region', { name: 'All goals' })).toHaveTextContent('₹25,000');
  });

  it('adds money to a goal', async () => {
    const user = userEvent.setup();
    const planning = setUp();
    renderApp('/goals');

    await user.click(within(await card('New phone')).getByRole('button', { name: 'Add money' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add money' });
    await user.type(within(dialog).getByLabelText('Amount'), '2500');
    await user.type(within(dialog).getByLabelText('Note (optional)'), 'Diwali bonus');
    await user.click(within(dialog).getByRole('button', { name: 'Add money' }));

    await findToast('Added ₹2,500 to "New phone"');
    expect(planning.db.requests.at(-1).body).toEqual({ amount: 250000, note: 'Diwali bonus' });
    expect(await card('New phone')).toHaveTextContent('₹17,500 of ₹60,000');
  });

  it('celebrates when a goal is reached', async () => {
    const user = userEvent.setup();
    setUp();
    renderApp('/goals');

    await user.click(within(await card('New phone')).getByRole('button', { name: 'Add money' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add money' });
    await user.type(within(dialog).getByLabelText('Amount'), '45000');
    await user.click(within(dialog).getByRole('button', { name: 'Add money' }));

    await findToast('🎉 You reached "New phone"!');
    expect(await card('New phone')).toHaveTextContent('Goal reached — well done!');
  });

  it('won’t take out more than is saved', async () => {
    const user = userEvent.setup();
    const planning = setUp();
    renderApp('/goals');

    await user.click(
      within(await card('New phone')).getByRole('button', { name: 'Actions for New phone' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Take money out' }));
    const dialog = await screen.findByRole('dialog', { name: 'Take money out' });
    await user.type(within(dialog).getByLabelText('Amount'), '20000');
    await user.click(within(dialog).getByRole('button', { name: 'Take out' }));

    expect(await within(dialog).findByText('You have ₹15,000 saved')).toBeInTheDocument();
    expect(planning.db.requests).toHaveLength(0);
  });

  it('adds a new goal', async () => {
    const user = userEvent.setup();
    const planning = setUp([]);
    renderApp('/goals');

    await user.click((await screen.findAllByRole('button', { name: 'Add goal' }))[0]);
    const dialog = await screen.findByRole('dialog', { name: 'Add a goal' });
    await user.type(within(dialog).getByLabelText('What are you saving for?'), 'Goa trip');
    await user.type(within(dialog).getByLabelText('Amount needed'), '25,000');
    await user.type(within(dialog).getByLabelText('Already saved (optional)'), '5000');
    await user.type(within(dialog).getByLabelText('By when? (optional)'), '2027-03-31');
    await user.click(within(dialog).getByRole('button', { name: 'Add goal' }));

    await findToast('Goal added');
    expect(planning.db.requests.at(-1).body).toEqual({
      name: 'Goa trip',
      targetAmount: 2500000,
      savedAmount: 500000,
      deadline: '2027-03-31',
      linkedWalletId: null,
      color: '#0f766e',
    });
    expect(await card('Goa trip')).toBeInTheDocument();
  });

  it('pauses a goal', async () => {
    const user = userEvent.setup();
    const planning = setUp();
    renderApp('/goals');

    await user.click(
      within(await card('New phone')).getByRole('button', { name: 'Actions for New phone' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Pause' }));

    await findToast('Goal paused');
    expect(planning.db.requests.at(-1).body).toEqual({ status: 'paused' });
    expect(await card('New phone')).toHaveTextContent('Paused');
  });

  it('invites the user to start a first goal', async () => {
    setUp([]);
    renderApp('/goals');
    expect(await screen.findByText('Start your first goal')).toBeInTheDocument();
  });
});
