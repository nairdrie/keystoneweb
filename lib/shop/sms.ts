/**
 * Text messages for the Shop tab (estimate approval and pay links), sent with
 * the platform's Twilio number when TWILIO_* is configured, the same way the
 * ops autopilot texts leads. These are transactional messages about a repair
 * the customer asked for. Without Twilio the UI falls back to the phone's own
 * SMS app with the message filled in.
 */

import { ShopRuleError } from './access';
export { smsConfigured } from './env';

/** North American numbers to E.164; anything already starting with + is kept. */
export function toE164(phone: string | null | undefined): string | null {
  const raw = (phone || '').trim();
  if (!raw) return null;
  if (raw.startsWith('+')) {
    const d = raw.replace(/[^\d]/g, '');
    return d.length >= 8 ? `+${d}` : null;
  }
  const d = raw.replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return null;
}

export async function sendShopSms(to: string | null | undefined, body: string): Promise<void> {
  const number = toE164(to);
  if (!number) throw new ShopRuleError('That phone number can’t get texts. Check it on the customer file.', undefined, 400);
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: number, From: process.env.TWILIO_FROM_NUMBER!, Body: body.slice(0, 600) }).toString(),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    console.error('[shop/sms] Twilio error', res.status, (await res.text().catch(() => '')).slice(0, 300));
    throw new ShopRuleError('The text didn’t send. Copy the link and send it yourself.', undefined, 502);
  }
}
