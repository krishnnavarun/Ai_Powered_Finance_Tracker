import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

// Sends an email through Resend's REST API when it's set up (RESEND_API_KEY + EMAIL_FROM).
// Without it nothing is sent and { sent: false } comes back — email is optional.
// Tests pass their own `fetchImpl` and `config`.
export async function sendEmail(
  { to, subject, text, html },
  { fetchImpl = fetch, config = env } = {},
) {
  if (!config.RESEND_API_KEY || !config.EMAIL_FROM)
    return { sent: false, reason: 'not-configured' };
  try {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ from: config.EMAIL_FROM, to: [to], subject, text, html }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, 'email not sent');
      return { sent: false, reason: `status-${res.status}` };
    }
    return { sent: true };
  } catch (error) {
    logger.warn({ err: error.message }, 'email not sent');
    return { sent: false, reason: 'network' };
  }
}
