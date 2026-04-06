/**
 * Shared email HTML builder for membership emails.
 * Pure function — safe to import in both server and client contexts.
 */

export interface EmailBranding {
  logoUrl?: string;
  headerColor?: string;
  accentColor?: string;
  footerText?: string;
}

export function buildMemberEmailHtml(opts: {
  heading: string;
  bodyLines: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  note?: string;
  branding?: EmailBranding;
}): string {
  const headerColor = opts.branding?.headerColor || '#1e293b';
  const accentColor = opts.branding?.accentColor || '#1e293b';
  const footerText  = opts.branding?.footerText  || '';

  const logoHtml = opts.branding?.logoUrl
    ? `<img src="${opts.branding.logoUrl}" style="max-height:44px;max-width:200px;display:block;object-fit:contain;" alt="Logo" />`
    : `<span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">✦</span>`;

  const ctaHtml = opts.ctaLabel && opts.ctaUrl
    ? `<div style="text-align:center;margin:32px 0;">
        <a href="${opts.ctaUrl}" style="display:inline-block;padding:13px 32px;background:${accentColor};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;letter-spacing:0.01em;">${opts.ctaLabel}</a>
       </div>`
    : '';

  const bodyHtml = opts.bodyLines
    .filter(l => l.trim())
    .map(line => `<p style="color:#64748b;font-size:15px;line-height:1.7;margin:0 0 14px;">${line}</p>`)
    .join('');

  const noteHtml = opts.note
    ? `<p style="color:#94a3b8;font-size:13px;margin:24px 0 0;">${opts.note}</p>`
    : '';

  const footerHtml = footerText
    ? `<tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;">
        <p style="color:#94a3b8;font-size:13px;margin:0;">${footerText}</p>
       </td></tr>`
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
      <tr><td style="background:${headerColor};padding:20px 32px;">${logoHtml}</td></tr>
      <tr><td style="padding:40px 32px;">
        <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#0f172a;line-height:1.3;">${opts.heading}</h1>
        ${bodyHtml}
        ${ctaHtml}
        ${noteHtml}
      </td></tr>
      ${footerHtml}
    </table>
  </td></tr>
</table>
</body></html>`;
}
