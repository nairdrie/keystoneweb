import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { runAIBuilder } from '@/lib/ai/builder-engine';
import { checkAndRecordUsage, getUsageRemaining, UserPlan } from './rate-limit';
import { getUserEffectiveLimits } from '@/lib/addons';

function getPlan(status: string | undefined, plan: string | undefined): UserPlan {
  if (status !== 'active') return 'free';
  if (plan?.toLowerCase().includes('pro')) return 'pro';
  return 'basic';
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('subscription_status, subscription_plan, subscription_started_at')
      .eq('user_id', user.id)
      .single();

    const plan = getPlan(subscription?.subscription_status, subscription?.subscription_plan);
    const effectiveLimits = await getUserEffectiveLimits(user.id, supabase);
    const remaining = await getUsageRemaining(
      user.id,
      plan,
      subscription?.subscription_started_at ?? null,
      supabase,
      effectiveLimits.aiMultiplier
    );

    return NextResponse.json({ remaining });
  } catch (err) {
    console.error('AI Builder usage check error:', err);
    return NextResponse.json({ error: 'Failed to fetch usage' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { prompt, history, siteState, availablePalettes, isNewSite, enableMultiPage } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Missing prompt.' }, { status: 400 });
    }

    if (prompt.length > 1000) {
      return NextResponse.json({ error: 'Prompt is too long. Please keep it under 1000 characters.' }, { status: 400 });
    }

    const sanitizedHistory = (Array.isArray(history) ? history : [])
      .slice(-20)
      .map((message: unknown) => {
        const record = message && typeof message === 'object' ? message as Record<string, unknown> : {};
        return {
          role: record.role === 'assistant' ? 'assistant' as const : 'user' as const,
          content: typeof record.content === 'string' ? record.content.slice(0, 1000) : '',
        };
      });

    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('subscription_status, subscription_plan, subscription_started_at')
      .eq('user_id', user.id)
      .single();

    const plan = getPlan(subscription?.subscription_status, subscription?.subscription_plan);
    const aiLimits = await getUserEffectiveLimits(user.id, supabase);
    const rateLimitResult = await checkAndRecordUsage(
      user.id,
      plan,
      subscription?.subscription_started_at ?? null,
      supabase,
      aiLimits.aiMultiplier
    );

    if (!rateLimitResult.allowed) {
      return NextResponse.json({
        error: rateLimitResult.message,
        remaining: rateLimitResult.remaining,
        ...(rateLimitResult.upgradeRequired ? { upgradeRequired: true } : {}),
      }, { status: 429 });
    }

    const apiKey = process.env.AI_BUILDER_API_KEY;
    const apiProvider = process.env.AI_BUILDER_PROVIDER || 'anthropic';
    const modelId = process.env.AI_BUILDER_MODEL || (apiProvider === 'anthropic' ? 'claude-sonnet-4-5-20250514' : 'gpt-4o-mini');

    if (!apiKey) {
      return NextResponse.json({ error: 'AI Builder is not configured. Please set AI_BUILDER_API_KEY.' }, { status: 500 });
    }

    let result;
    try {
      result = await runAIBuilder({
        apiKey,
        provider: apiProvider,
        modelId,
        prompt: prompt.trim(),
        history: sanitizedHistory,
        siteState,
        availablePalettes: Array.isArray(availablePalettes) ? availablePalettes : [],
        isNewSite: Boolean(isNewSite),
        enableMultiPage: Boolean(enableMultiPage),
        maxTokens: enableMultiPage ? 8192 : 4096,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'No valid JSON found in AI response') {
        console.error('AI Builder: failed to parse response as JSON.');
        return NextResponse.json({
          operations: [],
          message: 'Sorry, I had trouble processing that request. Please try again.',
          parseError: true,
          remaining: rateLimitResult.remaining,
        });
      }
      throw error;
    }

    return NextResponse.json({
      operations: result.operations,
      message: result.message,
      remaining: rateLimitResult.remaining,
    });
  } catch (err) {
    console.error('AI Builder error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again in a moment.' }, { status: 500 });
  }
}
