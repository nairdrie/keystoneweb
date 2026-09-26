import { NextRequest } from 'next/server';
import { deletePayment } from '@/lib/shop/actions/invoices';
import { owner, run } from '@/lib/shop/http';

export const runtime = 'nodejs';

// DELETE /api/shop/payments/:id — undo a payment entered by mistake (within a week).
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const { id } = await params;
    return deletePayment(await owner(request), id);
  });
}
