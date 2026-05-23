import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized: User authentication required' },
                { status: 401 }
            );
        }

        // Exclude `subscription_status_change` rows — they're $0 status updates,
        // not financial transactions. The matching `invoice.paid` row (created by
        // the same renewal) carries the real amount and hosted invoice URL.
        const { data: transactions, error } = await supabase
            .from('stripe_transactions')
            .select('id, transaction_type, description, amount_cents, currency, status, invoice_url, invoice_pdf, period_start, period_end, created_at')
            .eq('user_id', user.id)
            .neq('transaction_type', 'subscription_status_change')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            console.error('Supabase error fetching billing history:', error);
            return NextResponse.json(
                { error: 'Failed to fetch billing history' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            transactions: transactions || []
        });
    } catch (error) {
        console.error('Error in billing history route:', error);
        return NextResponse.json(
            { error: 'Failed to retrieve billing history' },
            { status: 500 }
        );
    }
}
