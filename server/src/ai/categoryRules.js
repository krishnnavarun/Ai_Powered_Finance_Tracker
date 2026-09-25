import { normalizeMerchant } from '../utils/merchant.js';

// Keywords (separated by |) → default category, by systemKey so renamed categories
// still match. Words are compared whole, after the same clean-up as merchant keys;
// longer phrases win ("swiggy instamart" is groceries, "swiggy" is food).
const RULES = {
  expense: {
    food_dining:
      'swiggy|zomato|dominos|domino|pizza|pizza hut|kfc|mcdonalds|mcdonald|burger|' +
      'burger king|biryani|restaurant|cafe|starbucks|chai|dosa|eatsure|faasos|behrouz|' +
      'haldiram|haldirams|subway|lunch|dinner|breakfast|snacks|canteen|mess|bakery|food|' +
      'chaayos|third wave coffee|barbeque nation',
    groceries:
      'bigbasket|blinkit|zepto|dmart|d mart|instamart|swiggy instamart|jiomart|grofers|' +
      'reliance fresh|more supermarket|spencers|grocery|groceries|kirana|vegetables|' +
      'veggies|fruits|milk|supermarket|natures basket|ratnadeep|star bazaar',
    transport:
      'uber|ola|rapido|metro|auto|cab|taxi|bus|namma yatri|bmtc|dmrc|best bus|parking|' +
      'fastag|toll|blusmart',
    fuel:
      'petrol|diesel|fuel|hpcl|bpcl|iocl|indian oil|bharat petroleum|' +
      'hindustan petroleum|shell|cng',
    rent: 'rent|house rent|landlord|pg rent|hostel rent',
    utilities:
      'electricity|electricity bill|bescom|tneb|tangedco|msedcl|bses|tata power|' +
      'adani electricity|water bill|gas bill|lpg|indane|bharat gas|hp gas|maintenance',
    mobile_internet:
      'jio|airtel|vi|vodafone|idea|bsnl|act fibernet|broadband|recharge|wifi|hathway|' +
      'excitel|postpaid|prepaid',
    shopping:
      'amazon|flipkart|myntra|ajio|meesho|tata cliq|croma|reliance digital|decathlon|' +
      'ikea|lifestyle|shoppers stop|westside|zara|h m|pantaloons|max fashion|shopping|' +
      'clothes',
    entertainment:
      'bookmyshow|pvr|inox|movie|movies|cinema|concert|steam|playstation|gaming|district',
    subscriptions:
      'netflix|spotify|amazon prime|prime video|hotstar|jiohotstar|disney|' +
      'youtube premium|youtube|icloud|apple|google one|jiosaavn|gaana|zee5|sonyliv|' +
      'chatgpt|openai|notion|canva|subscription',
    health:
      'apollo|apollo pharmacy|pharmacy|medplus|1mg|tata 1mg|pharmeasy|netmeds|hospital|' +
      'clinic|doctor|medicine|medicines|practo|diagnostics|lab|gym|cult|cultfit|dental',
    education: 'udemy|coursera|byjus|unacademy|school|college|fees|tuition|books|exam|course',
    travel:
      'irctc|makemytrip|goibibo|cleartrip|ixigo|indigo|air india|vistara|spicejet|akasa|' +
      'oyo|airbnb|redbus|hotel|flight|train|trip',
    personal_care: 'salon|haircut|spa|parlour|urban company|urbanclap|nykaa|barber|grooming',
    gifts: 'gift|gifts|fnp|ferns n petals|igp|birthday gift',
    emi_loans: 'emi|loan|bajaj finserv|home loan|car loan|loan repayment',
    investments:
      'zerodha|groww|upstox|sip|mutual fund|kuvera|smallcase|ppf|nps|fixed deposit|' +
      'angel one|indmoney',
  },
  income: {
    salary: 'salary|payroll|sal credit|stipend',
    freelance: 'freelance|upwork|fiverr|client payment|invoice',
    pocket_money: 'pocket money|allowance|dad|mom|papa|mummy|amma|appa',
    refund: 'refund|reversal|reversed|cashback',
    interest: 'interest|int pd|int credit|savings interest|fd interest',
  },
};

// Flattened once: [{ type, systemKey, phrase }], longest phrases first.
const PHRASES = Object.entries(RULES)
  .flatMap(([type, byKey]) =>
    Object.entries(byKey).flatMap(([systemKey, words]) =>
      words.split('|').map((phrase) => ({ type, systemKey, phrase: normalizeMerchant(phrase) })),
    ),
  )
  .filter((rule) => rule.phrase)
  .sort((a, b) => b.phrase.split(' ').length - a.phrase.split(' ').length);

// The default category (systemKey) that the merchant or note points to, or null.
//   ruleCategory({ type: 'expense', merchant: 'SWIGGY*Order' }) → 'food_dining'
export function ruleCategory({ type, merchant, note }) {
  const text = ` ${normalizeMerchant(`${merchant ?? ''} ${note ?? ''}`)} `;
  if (!text.trim()) return null;
  const match = PHRASES.find((rule) => rule.type === type && text.includes(` ${rule.phrase} `));
  return match?.systemKey ?? null;
}
