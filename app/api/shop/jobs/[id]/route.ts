import { NextRequest } from 'next/server';
import { ShopRuleError } from '@/lib/shop/access';
import { requireJob } from '@/lib/shop/actions/common';
import { addNote, closeJob, markDone, markReturned, moveJob, reopenJob, updateJob } from '@/lib/shop/actions/jobs';
import { createRevision, startEstimate } from '@/lib/shop/actions/estimates';
import { issueInvoice, saveAdjustments } from '@/lib/shop/actions/invoices';
import { releaseOnCredit, setHold } from '@/lib/shop/actions/liens';
import { complianceChecklist } from '@/lib/shop/rules';
import { ownerJson, ownerOnly, run, tech, techJson } from '@/lib/shop/http';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/shop/jobs/:id — the job file (tech devices can read it too).
export async function GET(request: NextRequest, { params }: Ctx) {
  return run(async () => {
    const { id } = await params;
    const access = await tech(request);
    const detail = await requireJob(access, id);
    return { ...detail, checklist: complianceChecklist(detail) };
  });
}

// PATCH /api/shop/jobs/:id — complaint, diagnosis, key tag, odometer, next step, estimate fee.
export async function PATCH(request: NextRequest, { params }: Ctx) {
  return run(async () => {
    const { id } = await params;
    const { access, body } = await ownerJson(request);
    return updateJob(access, id, body);
  });
}

const TECH_ACTIONS = new Set(['move', 'done', 'note']);

// POST /api/shop/jobs/:id — { action, ... }
export async function POST(request: NextRequest, { params }: Ctx) {
  return run(async () => {
    const { id } = await params;
    const { access, body } = await techJson<Record<string, unknown>>(request);
    const action = String(body.action || '');
    if (!TECH_ACTIONS.has(action)) ownerOnly(access);
    switch (action) {
      case 'move': return moveJob(access, id, body);
      case 'done': return markDone(access, id, body.kind === 'repair' ? 'repair' : 'diagnosis');
      case 'note': return addNote(access, id, body);
      case 'returned': return markReturned(access, id);
      case 'close': return closeJob(access, id, body.reason === 'cancelled' ? 'cancelled' : 'no_charge', body.note);
      case 'reopen': return reopenJob(access, id);
      case 'start_estimate': return startEstimate(access, id);
      case 'revision': return createRevision(access, id, []);
      case 'adjustments': return saveAdjustments(access, id, body.adjustments);
      case 'invoice': return issueInvoice(access, id, body);
      case 'hold': return setHold(access, id, body.hold !== false);
      case 'release': return releaseOnCredit(access, id, body, request);
      default: throw new ShopRuleError('Unknown action.', undefined, 400);
    }
  });
}
