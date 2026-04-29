/** Derive a display name from an email address, e.g. "nick.smith@gmail.com" → "Nick Smith" */
export function nameFromEmail(email: string): string {
  const username = email.split('@')[0];
  return username
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const LOGO_URL = 'https://keystoneweb.ca/assets/logo/keystone-logo.png';
const SITE_URL = 'https://keystoneweb.ca';

/** Inline-styled HTML signature block used in outbound emails. */
export function buildSignatureHtml({
  senderName,
  fromEmail,
}: {
  senderName: string;
  fromEmail: string;
}): string {
  return `
    <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
      <table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, sans-serif;">
        <tr>
          <td style="padding-right: 16px; border-right: 2px solid #2563eb; vertical-align: top;">
            <a href="${SITE_URL}" target="_blank" style="text-decoration: none;">
              <img src="${LOGO_URL}" alt="Keystone Web Design" style="height: 48px; width: auto; display: block;" />
            </a>
          </td>
          <td style="padding-left: 16px; vertical-align: top;">
            <p style="margin: 0; font-size: 15px; font-weight: 700; color: #111827;">${escapeHtml(senderName)}</p>
            <p style="margin: 2px 0 0 0; font-size: 13px; color: #6b7280;">Keystone Web Design</p>
            <p style="margin: 8px 0 0 0; font-size: 12px; color: #9ca3af;">
              <a href="mailto:${escapeHtml(fromEmail)}" style="color: #6b7280; text-decoration: none;">${escapeHtml(fromEmail)}</a>
            </p>
            <p style="margin: 4px 0 0 0; font-size: 12px;">
              <a href="${SITE_URL}" style="color: #2563eb; text-decoration: none;">keystoneweb.ca</a>
            </p>
          </td>
        </tr>
      </table>
    </div>
  `;
}

/** Plain-text signature footer used in outbound emails. */
export function buildSignatureText({
  senderName,
  fromEmail,
}: {
  senderName: string;
  fromEmail: string;
}): string {
  return `--\n${senderName}\nKeystone Web Design\n${fromEmail}\n${SITE_URL}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
