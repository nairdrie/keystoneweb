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

        const { data: subscription, error } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is no rows returned, which is fine
            console.error('Supabase error fetching user subscription:', error);
            return NextResponse.json(
                { error: 'Failed to fetch subscription status' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            subscription: subscription || null
        });
    } catch (error) {
        console.error('Error in user subscription route:', error);
        return NextResponse.json(
            { error: 'Failed to retrieve subscription' },
            { status: 500 }
        );
    }
}
