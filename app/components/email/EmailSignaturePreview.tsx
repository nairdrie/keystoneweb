'use client';

/**
 * White-background HTML preview of the email signature appended to outbound mail.
 * Mirrors the HTML rendered by /api/ops/email/send and /api/ops/support/[id]/reply.
 */
export default function EmailSignaturePreview({
  senderName,
  fromEmail,
}: {
  senderName: string;
  fromEmail: string;
}) {
  return (
    <div className="rounded-md border border-gray-700 bg-white p-4">
      <table cellPadding={0} cellSpacing={0} style={{ fontFamily: 'Arial, sans-serif' }}>
        <tbody>
          <tr>
            <td style={{ paddingRight: 16, borderRight: '2px solid #2563eb', verticalAlign: 'top' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://keystoneweb.ca/assets/logo/keystone-logo.png"
                alt="Keystone Web Design"
                style={{ height: 48, width: 'auto', display: 'block' }}
              />
            </td>
            <td style={{ paddingLeft: 16, verticalAlign: 'top' }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>{senderName}</p>
              <p style={{ margin: '2px 0 0 0', fontSize: 13, color: '#6b7280' }}>Keystone Web Design</p>
              <p style={{ margin: '8px 0 0 0', fontSize: 12, color: '#9ca3af' }}>{fromEmail}</p>
              <p style={{ margin: '4px 0 0 0', fontSize: 12 }}>
                <span style={{ color: '#2563eb' }}>keystoneweb.ca</span>
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
