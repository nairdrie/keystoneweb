import { Resend } from 'resend';
import { IS_STAGING } from '@/lib/env/domain';

const realResend = new Resend(process.env.RESEND_API_KEY);

/**
 * Resend client that no-ops on staging. Staging deploys log what they would
 * have sent instead of actually hitting Resend — prevents test flows (bookings,
 * orders, password resets) from emailing real customers while still letting
 * the send path run end-to-end.
 */
export const resend = {
  emails: {
    async send(payload: Parameters<typeof realResend.emails.send>[0]) {
      if (IS_STAGING) {
        const p = payload as { from?: unknown; to?: unknown; subject?: unknown };
        console.log('[staging] email send skipped', {
          from: p.from,
          to: p.to,
          subject: p.subject,
        });
        return { data: { id: 'staging-skipped' }, error: null } as Awaited<
          ReturnType<typeof realResend.emails.send>
        >;
      }
      return realResend.emails.send(payload);
    },
  },
};
