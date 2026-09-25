// Sample bank statement exports (CSV). Account numbers and names are made up.

// HDFC style: account details first, separate Withdrawal / Deposit columns, dd/mm/yy.
export const HDFC_CSV = `HDFC BANK Ltd.,,,,,,
Account Statement,,,,,,
Account No :,XXXXXXXX1234,,,,,
,,,,,,
Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance
01/09/26,NEFT CR-HDFC0000001-ACME CORP-SALARY SEP,0000426712345601,01/09/26,,"60,000.00","1,10,000.00"
02/09/26,UPI/DR/426712345678/SWIGGY/YESB/swiggy@ybl/Payment,0000426712345678,02/09/26,250.00,,"1,09,750.00"
05/09/26,POS 4455 DMART PURCHASE,0000000000004455,05/09/26,"1,845.50",,"1,07,904.50"
10/09/26,UPI/DR/426712345699/Rahul K/OKAXIS/rahulk@okaxis/dinner,0000426712345699,10/09/26,600.00,,"1,07,304.50"
15/09/26,ACH D- BAJAJ FINANCE LTD-EMI,0000000000000015,15/09/26,"4,500.00",,"1,02,804.50"
,,,,,,
,Opening Balance,,,,,"50,000.00"
`;

// One signed Amount column, ISO dates, UTF-8 byte-order mark.
const BOM = String.fromCharCode(0xfeff);
export const SIGNED_CSV = `${BOM}Date,Description,Amount,Balance
2026-09-03,NETFLIX.COM,-649.00,9351.00
2026-09-04,Interest credit,12.40,9363.40
2026-09-07,UBER INDIA SYSTEMS,-180,9183.40
`;

// Amount + Dr/Cr column, dd-Mon-yyyy dates, a quoted description with a comma.
export const DRCR_CSV = `Txn Date,Transaction Details,Amount,Dr/Cr
24-Sep-2026,"ZOMATO, BANGALORE",349.00,DR
25-Sep-2026,REFUND AMAZON,299.00,CR
`;

// US-style month-first dates (a second number above 12 gives it away).
export const US_DATES_CSV = `Date,Description,Debit,Credit
09/03/2026,Coffee,4.50,
09/24/2026,Salary,,1000.00
`;

// No recognisable header at all.
export const NO_HEADER_CSV = `a,b,c
1,2,3
`;
