import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createAdminClient } from '@/lib/db/supabase-admin';
import {
    signMemberToken,
    hashToken,
    getTokenExpiresAt,
    MEMBER_COOKIE_NAME,
    getMemberCookieOptions,
} from '@/lib/membership/auth';

const MAX_ATTEMPTS = 5;

function hashCode(code: string, siteId: string): string {
    return createHash('sha256').update(`${siteId}:${code}`).digest('hex');
}

/**
 * POST /api/membership/otp/verify
 * Body: { siteId, email, code }
 * On success: finds-or-creates a member row (status='guest' if new), issues
 * the standard member session cookie, and returns the member id/email/name.
 */
export async function POST(request: NextRequest) {
    try {
        const { siteId, email, code } = await request.json();
        if (!siteId || !email || !code) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        const emailLower = String(email).trim().toLowerCase();
        const codeStr = String(code).trim();
        const admin = createAdminClient();

        const { data: otp } = await admin
            .from('member_otps')
            .select('id, code_hash, expires_at, attempts')
            .eq('site_id', siteId)
            .eq('email', emailLower)
            .maybeSingle();

        if (!otp) {
            return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
        }

        if (new Date(otp.expires_at).getTime() < Date.now()) {
            await admin.from('member_otps').delete().eq('id', otp.id);
            return NextResponse.json({ error: 'Code has expired' }, { status: 400 });
        }

        if (otp.attempts >= MAX_ATTEMPTS) {
            await admin.from('member_otps').delete().eq('id', otp.id);
            return NextResponse.json({ error: 'Too many attempts. Request a new code.' }, { status: 400 });
        }

        if (otp.code_hash !== hashCode(codeStr, siteId)) {
            await admin
                .from('member_otps')
                .update({ attempts: otp.attempts + 1 })
                .eq('id', otp.id);
            return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
        }

        // Code matched — consume it, find or create the member.
        await admin.from('member_otps').delete().eq('id', otp.id);

        let { data: member } = await admin
            .from('members')
            .select('id, email, name, status, avatar_url, package_id')
            .eq('site_id', siteId)
            .eq('email', emailLower)
            .maybeSingle();

        if (!member) {
            const { data: created } = await admin
                .from('members')
                .insert({
                    site_id: siteId,
                    email: emailLower,
                    password_hash: null,
                    status: 'guest',
                    email_verified: true,
                })
                .select('id, email, name, status, avatar_url, package_id')
                .single();
            member = created || null;
        } else if (member.status === 'guest') {
            // First successful OTP also verifies the email for an existing guest.
            await admin
                .from('members')
                .update({ email_verified: true, last_login_at: new Date().toISOString() })
                .eq('id', member.id);
        } else {
            await admin
                .from('members')
                .update({ last_login_at: new Date().toISOString() })
                .eq('id', member.id);
        }

        if (!member) {
            return NextResponse.json({ error: 'Could not create session' }, { status: 500 });
        }

        if (member.status === 'suspended' || member.status === 'cancelled') {
            return NextResponse.json({ error: 'Account is not available' }, { status: 403 });
        }

        // Issue the same JWT + session row as a password sign-in so the rest
        // of the membership stack treats this identically.
        const token = await signMemberToken({
            memberId: member.id,
            siteId,
            email: member.email,
        });

        const expiresAt = getTokenExpiresAt();
        await admin.from('member_sessions').insert({
            member_id: member.id,
            site_id: siteId,
            token_hash: hashToken(token),
            user_agent: request.headers.get('user-agent') || null,
            ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
            expires_at: expiresAt.toISOString(),
        });

        const response = NextResponse.json({
            success: true,
            member: {
                id: member.id,
                email: member.email,
                name: member.name,
                avatarUrl: member.avatar_url,
                packageId: member.package_id,
            },
        });
        response.cookies.set(MEMBER_COOKIE_NAME, token, getMemberCookieOptions());
        return response;
    } catch (error) {
        console.error('OTP verify error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
