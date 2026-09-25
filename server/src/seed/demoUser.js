import crypto from 'node:crypto';
import { refreshInsights } from '../jobs/insights.job.js';
import { Category } from '../models/Category.js';
import { User } from '../models/User.js';
import { register } from '../services/auth.service.js';
import { createBudget } from '../services/budget.service.js';
import { createGoal } from '../services/goal.service.js';
import { createRule } from '../services/recurring.service.js';
import { insertTransactions } from '../services/transaction.service.js';
import { createWallet } from '../services/wallet.service.js';
import { addDays, addMonths, localDateOf } from '../utils/dates.js';

// "Try the demo": every click gets its own fresh sandbox account with six months of
// realistic data, so visitors can change anything without spoiling it for others.
// Demo accounts are recognised by their email domain and removed after a day
// (jobs/cleanup.job.js). ".invalid" is reserved: these addresses can never be real.
export const DEMO_EMAIL_DOMAIN = 'demo.paisa-pal.invalid';
export const DEMO_EMAIL_PATTERN = /@demo\.paisa-pal\.invalid$/;
const TIME_ZONE = 'Asia/Kolkata';

// Small seeded random numbers, so the demo looks the same every time.
function random(seed) {
  let state = seed;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    chance: (p) => next() < p,
    rupees: (min, max) => Math.round((min + next() * (max - min)) / 10) * 10 * 100, // paise
    pick: (list) => list[Math.floor(next() * list.length)],
  };
}

// Everyday spending: [category key, chance per day, min ₹, max ₹, wallet, places]
const DAILY = [
  [
    'food_dining',
    0.45,
    150,
    650,
    'gpay',
    ['Swiggy', 'Zomato', 'Chaayos', 'Behrouz Biryani', 'Third Wave Coffee'],
  ],
  ['groceries', 0.22, 400, 2400, 'card', ['DMart', 'Blinkit', 'BigBasket', 'Zepto']],
  ['transport', 0.4, 60, 380, 'gpay', ['Uber', 'Rapido', 'Ola', 'Namma Metro']],
  ['food_dining', 0.3, 20, 60, 'cash', ['Tea stall']],
  ['shopping', 0.05, 600, 3500, 'card', ['Amazon', 'Myntra', 'Decathlon']],
  ['entertainment', 0.04, 350, 900, 'card', ['BookMyShow', 'PVR']],
];

// Every month: [day, type, category key, ₹ (or [min, max]), wallet, place]
const MONTHLY = [
  [1, 'income', 'salary', 65000, 'bank', 'Acme Technologies'],
  [2, 'expense', 'rent', 15000, 'bank', 'Landlord'],
  [5, 'expense', 'subscriptions', 649, 'card', 'Netflix'],
  [7, 'expense', 'investments', 3000, 'bank', 'Groww SIP'],
  [10, 'expense', 'mobile_internet', 299, 'gpay', 'Jio'],
  [12, 'expense', 'subscriptions', 119, 'card', 'Spotify'],
  [15, 'expense', 'utilities', [900, 1800], 'gpay', 'BESCOM'],
  [20, 'expense', 'fuel', [1500, 2500], 'card', 'HP Petrol'],
];

function build({ today, keys, wallets }) {
  const r = random(42);
  const rows = [];
  const start = `${addMonths(today, -5).slice(0, 7)}-01`;
  const add = (date, type, key, amount, wallet, merchant, extra = {}) =>
    rows.push({
      type,
      amount,
      walletId: wallets[wallet]._id,
      categoryId: key ? keys[key] : null,
      merchant,
      date,
      source: 'manual',
      ...extra,
    });

  for (let date = start; date <= today; date = addDays(date, 1)) {
    const day = Number(date.slice(8, 10));
    for (const [dueDay, type, key, amount, wallet, merchant] of MONTHLY) {
      if (day === dueDay) {
        add(
          date,
          type,
          key,
          Array.isArray(amount) ? r.rupees(...amount) : amount * 100,
          wallet,
          merchant,
        );
      }
    }
    if (day === 3) {
      rows.push({
        type: 'transfer',
        amount: 300000,
        walletId: wallets.bank._id,
        toWalletId: wallets.cash._id,
        date,
        note: 'ATM withdrawal',
      });
    }
    if (day === 25) {
      rows.push({
        type: 'transfer',
        amount: 900000,
        walletId: wallets.bank._id,
        toWalletId: wallets.card._id,
        date,
        note: 'Credit card bill',
      });
    }
    if (day === 18 && r.chance(0.35)) {
      add(date, 'income', 'freelance', r.rupees(8000, 15000), 'bank', 'Freelance project');
    }
    for (const [key, chance, min, max, wallet, places] of DAILY) {
      if (r.chance(chance)) add(date, 'expense', key, r.rupees(min, max), wallet, r.pick(places));
    }
  }

  // Something for the insights to find: a big night out this week…
  add(today, 'expense', 'food_dining', 480000, 'card', 'Toit Brewpub', { note: 'Birthday dinner' });
  // …and Swiggy charging twice last night.
  const yesterday = addDays(today, -1);
  add(`${yesterday}T20:10:00+05:30`, 'expense', 'food_dining', 34500, 'gpay', 'Swiggy');
  add(`${yesterday}T20:14:00+05:30`, 'expense', 'food_dining', 34500, 'gpay', 'Swiggy');
  return rows;
}

// The next date after today that falls on this day of the month.
function nextMonthly(today, day) {
  const thisMonth = `${today.slice(0, 7)}-${String(day).padStart(2, '0')}`;
  return thisMonth > today ? thisMonth : addMonths(thisMonth, 1);
}

// Creates a demo account and returns its session ({ user, accessToken, refreshToken }).
export async function createDemoAccount(meta, now = new Date()) {
  const email = `demo-${crypto.randomBytes(6).toString('hex')}@${DEMO_EMAIL_DOMAIN}`;
  const session = await register(
    { name: 'Demo User', email, password: crypto.randomBytes(24).toString('hex') },
    meta,
  );
  const userId = session.user._id;
  await User.updateOne({ _id: userId }, { $set: { onboardingDone: true, timezone: TIME_ZONE } });
  session.user.onboardingDone = true;
  const today = localDateOf(now, TIME_ZONE);

  const make = (fields) => createWallet(userId, fields);
  const wallets = {
    bank: await make({
      name: 'HDFC Savings',
      type: 'bank',
      icon: 'landmark',
      color: '#2563eb',
      openingBalance: 4000000,
    }),
    gpay: await make({
      name: 'GPay',
      type: 'upi',
      icon: 'smartphone',
      color: '#0f766e',
      openingBalance: 300000,
    }),
    cash: await make({
      name: 'Cash',
      type: 'cash',
      icon: 'banknote',
      color: '#ca8a04',
      openingBalance: 200000,
    }),
    card: await make({
      name: 'ICICI Card',
      type: 'card',
      icon: 'credit-card',
      color: '#7c3aed',
      openingBalance: 0,
      creditLimit: 10000000,
    }),
  };
  const categories = await Category.find({ userId }).lean();
  const keys = Object.fromEntries(categories.map((c) => [c.systemKey, c._id]));

  const rows = build({ today, keys, wallets });
  // The UPI wallet is topped up from the bank every month.
  for (
    let date = `${addMonths(today, -5).slice(0, 7)}-04`;
    date <= today;
    date = addMonths(date, 1)
  ) {
    rows.push({
      type: 'transfer',
      amount: 1500000,
      walletId: wallets.bank._id,
      toWalletId: wallets.gpay._id,
      date,
      note: 'Top up UPI',
    });
  }
  await insertTransactions(userId, rows);

  const month = today.slice(0, 7);
  for (const [key, rupees] of [
    ['food_dining', 9000],
    ['groceries', 7000],
    ['transport', 3000],
    [null, 45000],
  ]) {
    await createBudget(userId, { month, categoryId: key ? keys[key] : null, limit: rupees * 100 });
  }
  await createGoal(userId, {
    name: 'Emergency fund',
    targetAmount: 15000000,
    savedAmount: 6000000,
    deadline: addMonths(today, 10),
    icon: 'piggy-bank',
    color: '#0f766e',
  });
  await createGoal(userId, {
    name: 'Goa trip',
    targetAmount: 2500000,
    savedAmount: 900000,
    deadline: addMonths(today, 3),
    icon: 'plane',
    color: '#ca8a04',
  });

  const rule = (day, type, key, rupees, wallet, merchant) =>
    createRule(userId, {
      template: {
        type,
        amount: rupees * 100,
        walletId: wallets[wallet]._id,
        categoryId: keys[key],
        merchant,
      },
      frequency: 'monthly',
      startDate: nextMonthly(today, day),
    });
  await rule(1, 'income', 'salary', 65000, 'bank', 'Acme Technologies');
  await rule(2, 'expense', 'rent', 15000, 'bank', 'Landlord');
  await rule(5, 'expense', 'subscriptions', 649, 'card', 'Netflix');
  await rule(7, 'expense', 'investments', 3000, 'bank', 'Groww SIP');

  await refreshInsights(String(userId));
  return session;
}
