import { NextRequest, NextResponse } from 'next/server';
import { sendSupportRequestNotification } from '@/lib/email';

const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'support@keystoneweb.ca';

export async function POST(request: NextRequest) {
  try {
    const { name, email, company, message } = await request.json();

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Name, email, and message are required.' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }

    if (message.length > 5000) {
      return NextResponse.json({ error: 'Message is too long.' }, { status: 400 });
    }

    const subject = company
      ? `Enterprise Inquiry from ${name} (${company})`
      : `Enterprise Inquiry from ${name}`;

    await sendSupportRequestNotification(
      {
        fromName: name,
        fromEmail: email,
        subject,
        bodyPreview: message.slice(0, 500),
      },
      [CONTACT_EMAIL],
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Enterprise contact error:', error);
    return NextResponse.json({ error: 'Failed to send message. Please try again.' }, { status: 500 });
  }
}
