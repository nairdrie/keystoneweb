import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { sendMemberOtpEmail } from '@/lib/email';

const CODE_TTL_MS = 10 * 60 * 1000;

function generateCode(): string {
    // 6 digits, zero-padded. Math.random is fine here — the code's entropy is
    // gated by attempt-count and TTL on the verify side, not its randomness.
    return String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
}

function hashCode(code: string, siteId: string): string {
    // Per-site salt so codes can't be replayed across sites if a hash leaks.
    return createHash('sha256').update(`${siteId}:${code}`).digest('hex');
}

/**
 * POST /api/membership/otp/request
 * Body: { siteId, email }
 * Always returns 200 to avoid leaking which emails have accounts.
 */
export async function POST(request: NextRequest) {
    try {
        const { siteId, email } = await request.json();
        if (!siteId || !email) {
            return NextResponse.json({ success: true });
        }

        const emailLower = String(email).trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailLower)) {
            return NextResponse.json({ success: true });
        }

        const admin = createAdminClient();
        const code = generateCode();
        const codeHash = hashCode(code, siteId);
        const expiresAt = new Date(Date.now() + CODE_TTL_MS);

        await admin
            .from('member_otps')
            .upsert(
                {
                    site_id: siteId,
                    email: emailLower,
                    code_hash: codeHash,
                    expires_at: expiresAt.toISOString(),
                    attempts: 0,
                    created_at: new Date().toISOString(),
                },
                { onConflict: 'site_id,email' },
            );

        // Best-effort branding for the email shell.
        const [{ data: site }, { data: settings }] = await Promise.all([
            admin.from('sites').select('site_slug').eq('id', siteId).single(),
            admin.from('membership_settings').select('branding').eq('site_id', siteId).single(),
        ]);

        // Try to use the existing display name on the member row, if any.
        const { data: existing } = await admin
            .from('members')
            .select('name')
            .eq('site_id', siteId)
            .eq('email', emailLower)
            .maybeSingle();

        await sendMemberOtpEmail({
            memberEmail: emailLower,
            memberName: existing?.name || undefined,
            siteName: site?.site_slug || undefined,
            branding: (settings?.branding as any) || undefined,
            code,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('OTP request error:', error);
        // Still 200 to prevent enumeration via timing/error differences.
        return NextResponse.json({ success: true });
    }
}
