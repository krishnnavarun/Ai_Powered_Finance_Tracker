// Sample bank / UPI / card SMS in the formats Indian banks use. Numbers are made up.
// `expected` is what parseSms should read (only the listed fields are checked).

export const TRANSACTION_SMS = [
  {
    name: 'HDFC UPI (multi-line)',
    text: 'Sent Rs.250.00\nFrom HDFC Bank A/C *1234\nTo SWIGGY\nOn 24/09/26\nRef 426712345678\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808',
    expected: {
      type: 'expense',
      amount: 25000,
      merchant: 'Swiggy',
      date: '2026-09-24',
      account: '1234',
      bank: 'HDFC',
      reference: '426712345678',
    },
  },
  {
    name: 'HDFC UPI to a VPA',
    text: 'Money Sent! Rs.1,250.50 from HDFC Bank A/c **1234 to zomato.order@hdfcbank on 24-09-26 UPI Ref:426712345679',
    expected: {
      type: 'expense',
      amount: 125050,
      merchant: 'Zomato Order',
      date: '2026-09-24',
      account: '1234',
    },
  },
  {
    name: 'ICICI debit with payee after a semicolon',
    text: 'ICICI Bank Acct XX123 debited for Rs 1,250.00 on 24-Sep-26; SWIGGY credited. UPI:426712345680. Call 18002662 for dispute. SMS BLOCK 123 to 9215676766.',
    expected: {
      type: 'expense',
      amount: 125000,
      merchant: 'Swiggy',
      date: '2026-09-24',
      account: '123',
      bank: 'ICICI',
    },
  },
  {
    name: 'SBI UPI debit without a currency sign',
    text: 'Dear UPI user A/C X1234 debited by 250.0 on date 24Sep26 trf to RAPIDO Refno 426712345681. If not u? call 1800111109. -SBI',
    expected: {
      type: 'expense',
      amount: 25000,
      merchant: 'Rapido',
      date: '2026-09-24',
      account: '1234',
      bank: 'SBI',
    },
  },
  {
    name: 'SBI salary credit',
    text: 'Dear SBI User, your A/c X1234-credited by Rs.50000 on 30Sep26 transfer from ACME CORP Ref No 426712345682 -SBI',
    expected: {
      type: 'income',
      amount: 5000000,
      merchant: 'Acme Corp',
      date: '2026-09-30',
      bank: 'SBI',
    },
  },
  {
    name: 'Axis credit card spend',
    text: 'Spent INR 1,499.00 Axis Bank Card no. XX1234 24-09-26 14:22:10 IST AMAZON Avl Limit: INR 45,000.00 Not you? SMS BLOCK 1234 to 919951860002',
    expected: {
      type: 'expense',
      amount: 149900,
      merchant: 'Amazon',
      date: '2026-09-24',
      account: '1234',
      bank: 'Axis',
    },
  },
  {
    name: 'HDFC credit card at a merchant',
    text: 'Rs.649.00 spent on HDFC Bank Card x1234 at NETFLIX on 2026-09-24:10:22:11.Not You? To Block+Reissue Call 18002586161/SMS BLOCK CC 1234 to 7308080808',
    expected: {
      type: 'expense',
      amount: 64900,
      merchant: 'Netflix',
      date: '2026-09-24',
      account: '1234',
    },
  },
  {
    name: 'Kotak UPI to a VPA',
    text: 'Rs.500.00 debited from Kotak Bank a/c XX1234 to VPA blinkit@hdfcbank on 24-09-2026. UPI Ref 426712345683. Not you, https://kotak.com/fraud',
    expected: {
      type: 'expense',
      amount: 50000,
      merchant: 'Blinkit',
      date: '2026-09-24',
      bank: 'Kotak',
    },
  },
  {
    name: 'HDFC salary deposit with balance',
    text: 'Update! INR 60,000.00 deposited in HDFC Bank A/c XX1234 on 30-SEP-26 for SALARY SEP 2026.Avl bal INR 1,02,345.67. Cheque deposits in A/C are subject to clearing',
    expected: {
      type: 'income',
      amount: 6000000,
      merchant: 'Salary Sep 2026',
      date: '2026-09-30',
      balance: 10234567,
    },
  },
  {
    name: 'Refund',
    text: 'Refund of Rs.299.00 credited to your A/c XX1234 from AMAZON on 24-09-26',
    expected: { type: 'income', amount: 29900, merchant: 'Amazon', date: '2026-09-24' },
  },
  {
    name: 'ATM withdrawal',
    text: 'Rs.2000.00 withdrawn at ATM from A/c XX1234 on 24-09-26. Avl Bal Rs.8,000.00',
    expected: {
      type: 'expense',
      amount: 200000,
      merchant: 'ATM withdrawal',
      atm: true,
      balance: 800000,
    },
  },
  {
    name: 'Received from a person on UPI',
    text: 'You have received Rs.500 from Rahul K on 24-09-26 in your Paytm UPI. Ref 426712345684',
    expected: { type: 'income', amount: 50000, merchant: 'Rahul K', bank: 'Paytm' },
  },
];

export const SKIPPED_SMS = [
  {
    reason: 'otp',
    text: '123456 is your OTP for txn of Rs.2,500.00 at AMAZON on HDFC card XX1234. Valid for 5 mins. Do not share',
  },
  {
    reason: 'promo',
    text: 'Get a pre-approved personal loan of Rs.5,00,000 at 10.5%! Apply now: http://bank.example/loan T&C apply',
  },
  { reason: 'request', text: 'Rahul has requested Rs.500 via UPI. Pay on GPay: upi://pay?pa=r@ok' },
  {
    reason: 'failed',
    text: 'Your transaction of Rs.500 to SWIGGY has failed. Money will be refunded if debited.',
  },
  {
    reason: 'future',
    text: 'Your Netflix mandate of Rs.649 will be debited from A/c XX1234 on 25-09-26.',
  },
  { reason: 'not_transaction', text: 'Hi! Are we still meeting for lunch tomorrow?' },
];
